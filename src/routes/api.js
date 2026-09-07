const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { selectModel, PROVIDERS } = require('../config/models');
const { chat, extractJSON, LLMError } = require('../services/llmClient');
const { extractText } = require('../services/fileExtract');
const { extractKeywordsHeuristic, scoreAgainstKeywords } = require('../services/atsScore');
const { buildResumeDocx, DEFAULT_STYLE: RESUME_STYLE } = require('../services/docxBuilder');
const { buildCoverLetterDocx, DEFAULT_STYLE: LETTER_STYLE } = require('../services/coverLetterBuilder');
const { renderAndCountPages, estimatePages } = require('../services/pageFit');
const { resumeWordCount, resumeToPlainText, letterWordCount } = require('../services/textUtil');
const fileStore = require('../services/fileStore');
const prompts = require('../prompts');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const sampleResume = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/sample-resume.json'), 'utf-8'));

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function getApiKeys(body) {
  return {
    anthropic: body.anthropicKey || '',
    openai: body.openaiKey || ''
  };
}

async function llmJSON({ apiKeys, tier, override, system, userPrompt, maxTokens }) {
  const { provider, model } = selectModel(apiKeys, tier, override);
  const { text } = await chat({
    provider,
    apiKey: apiKeys[provider],
    model,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: maxTokens || 4000,
    temperature: 0.7
  });
  return { data: extractJSON(text), provider, model };
}

// ---------------------------------------------------------------------------
// Static config for the frontend
// ---------------------------------------------------------------------------
router.get('/models', (req, res) => {
  res.json({
    providers: Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, { label: v.label, models: v.models }]))
  });
});

router.get('/sample-resume', (req, res) => {
  res.json({ resume: sampleResume });
});

// ---------------------------------------------------------------------------
// File upload -> extracted text (used for resume / JD file / extra context)
// ---------------------------------------------------------------------------
router.post(
  '/extract-file',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const text = await extractText(req.file.buffer ? writeTempAndReturnPath(req.file) : req.file.path, req.file.originalname);
    res.json({ text, filename: req.file.originalname });
  })
);

// multer memoryStorage gives us a buffer, not a path; extractText expects a path
// for pdf-parse/mammoth-friendly streaming, so spool small uploads to a temp file.
function writeTempAndReturnPath(file) {
  const os = require('os');
  const tmpPath = path.join(os.tmpdir(), `upload-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`);
  fs.writeFileSync(tmpPath, file.buffer);
  return tmpPath;
}

// ---------------------------------------------------------------------------
// JD analysis
// ---------------------------------------------------------------------------
router.post(
  '/analyze-jd',
  asyncHandler(async (req, res) => {
    const { jdText, modelOverride } = req.body;
    if (!jdText || !jdText.trim()) return res.status(400).json({ error: 'jdText is required.' });
    const apiKeys = getApiKeys(req.body);
    const { system, user } = prompts.jdAnalysisPrompt();
    const { data, provider, model } = await llmJSON({
      apiKeys,
      tier: 'fast',
      override: modelOverride,
      system,
      userPrompt: user(jdText),
      maxTokens: 2000
    });
    const heuristicKeywords = extractKeywordsHeuristic(jdText);
    res.json({ analysis: data, heuristicKeywords, modelUsed: { provider, model } });
  })
);

// ---------------------------------------------------------------------------
// Resume parsing (freeform text -> structured schema)
// ---------------------------------------------------------------------------
router.post(
  '/parse-resume',
  asyncHandler(async (req, res) => {
    const { resumeText, modelOverride } = req.body;
    if (!resumeText || !resumeText.trim()) return res.status(400).json({ error: 'resumeText is required.' });
    const apiKeys = getApiKeys(req.body);
    const { system, user } = prompts.parseResumePrompt();
    const { data, provider, model } = await llmJSON({
      apiKeys,
      tier: 'balanced',
      override: modelOverride,
      system,
      userPrompt: user(resumeText),
      maxTokens: 3000
    });
    res.json({ resume: data, modelUsed: { provider, model } });
  })
);

// ---------------------------------------------------------------------------
// Page-fit loops
// ---------------------------------------------------------------------------
const MAX_FIT_ITERATIONS = 4;

async function fitResume({ resumeJson, apiKeys, tier, override, targetPages = 2 }) {
  let current = resumeJson;
  let style = { ...RESUME_STYLE };
  let fontShrinkSteps = 0;
  const MAX_FONT_SHRINK_STEPS = 2; // 10.5pt -> 10pt -> 9.5pt, floor below
  let marginTried = false;
  let verified = true;
  let pages = null;
  let iterations = 0;

  for (let i = 0; i < MAX_FIT_ITERATIONS; i++) {
    iterations = i + 1;
    const docxBuffer = await buildResumeDocx(current, style);
    const result = await renderAndCountPages(docxBuffer);
    if (!result.verified) {
      // No LibreOffice available -- fall back to a word-count estimate and stop.
      verified = false;
      pages = estimatePages(resumeWordCount(current), 430);
      break;
    }
    pages = result.pages;
    if (pages === targetPages) break;

    if (pages > targetPages) {
      // Try a smaller font / tighter margin first (cheap, no LLM call).
      if (fontShrinkSteps < MAX_FONT_SHRINK_STEPS && style.bodySize > 19) {
        style = { ...style, bodySize: style.bodySize - 1, bulletSize: style.bulletSize - 1 };
        fontShrinkSteps++;
        continue;
      }
      if (!marginTried && style.marginInches > 0.45) {
        style = { ...style, marginInches: 0.45 };
        marginTried = true;
        continue;
      }
      // Style knobs exhausted -- ask the model to condense content.
      const { system, user } = prompts.adjustLengthPrompt('condense');
      const { data } = await llmJSON({ apiKeys, tier, override, system, userPrompt: user(current), maxTokens: 3000 });
      current = data;
    } else {
      // pages < targetPages: try slightly larger font / margin first.
      if (style.marginInches < 0.7) {
        style = { ...style, marginInches: Math.min(0.7, style.marginInches + 0.1) };
        continue;
      }
      const { system, user } = prompts.adjustLengthPrompt('expand');
      const { data } = await llmJSON({ apiKeys, tier, override, system, userPrompt: user(current), maxTokens: 3000 });
      current = data;
    }
  }

  const finalDocx = await buildResumeDocx(current, style);
  return { resumeJson: current, docxBuffer: finalDocx, pages, verified, iterations, style };
}

async function fitCoverLetter({ letterJson, candidate, apiKeys, tier, override, targetPages = 1 }) {
  let current = letterJson;
  let style = { ...LETTER_STYLE };
  let marginAdjusted = false;
  let verified = true;
  let pages = null;
  let iterations = 0;

  for (let i = 0; i < MAX_FIT_ITERATIONS; i++) {
    iterations = i + 1;
    const docxBuffer = await buildCoverLetterDocx(current, candidate, style);
    const result = await renderAndCountPages(docxBuffer);
    if (!result.verified) {
      verified = false;
      pages = estimatePages(letterWordCount(current), 380);
      break;
    }
    pages = result.pages;
    if (pages === targetPages) break;

    if (pages > targetPages) {
      if (!marginAdjusted && style.marginInches > 0.75) {
        style = { ...style, marginInches: 0.8 };
        marginAdjusted = true;
        continue;
      }
      const { system, user } = prompts.adjustCoverLetterLengthPrompt('condense');
      const { data } = await llmJSON({ apiKeys, tier, override, system, userPrompt: user(current), maxTokens: 1500 });
      current = data;
    } else {
      const { system, user } = prompts.adjustCoverLetterLengthPrompt('expand');
      const { data } = await llmJSON({ apiKeys, tier, override, system, userPrompt: user(current), maxTokens: 1500 });
      current = data;
    }
  }

  const finalDocx = await buildCoverLetterDocx(current, candidate, style);
  return { letterJson: current, docxBuffer: finalDocx, pages, verified, iterations, style };
}

// ---------------------------------------------------------------------------
// Main generation endpoint: tailor resume + write cover letter + fit both to
// their target page counts + build downloadable .docx files.
// ---------------------------------------------------------------------------
router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const { resumeJson, jdText, jdAnalysis, additionalContext, customInstructions, modelOverride } = req.body;
    if (!resumeJson) return res.status(400).json({ error: 'resumeJson is required (parse a resume first).' });
    if (!jdText || !jdText.trim()) return res.status(400).json({ error: 'jdText is required.' });
    const apiKeys = getApiKeys(req.body);

    // 1. Make sure we have a JD analysis (re-use if the client already fetched one).
    let analysis = jdAnalysis;
    if (!analysis) {
      const { system, user } = prompts.jdAnalysisPrompt();
      const r = await llmJSON({ apiKeys, tier: 'fast', override: modelOverride, system, userPrompt: user(jdText), maxTokens: 2000 });
      analysis = r.data;
    }

    // 2. Tailor the resume content to the JD.
    const originalWordCount = resumeWordCount(resumeJson);
    const lengthGuidance = `Aim for a total body word count close to ${originalWordCount} words (the original fits exactly 2 pages in this template) -- keep bullet counts per role similar to the source.`;
    const { system: tSys, user: tUser } = prompts.tailorResumePrompt();
    const tailorResult = await llmJSON({
      apiKeys,
      tier: 'flagship',
      override: modelOverride,
      system: tSys,
      userPrompt: tUser({ resumeJson, jdText, jdAnalysis: analysis, additionalContext, customInstructions, lengthGuidance }),
      maxTokens: 4500
    });
    const { changeNotes, ...tailoredResume } = tailorResult.data;

    // 3. Fit the resume to exactly 2 pages (verified render loop when possible).
    const resumeFit = await fitResume({
      resumeJson: tailoredResume,
      apiKeys,
      tier: 'balanced',
      override: modelOverride,
      targetPages: 2
    });

    // 4. Write the cover letter, then fit it to exactly 1 page.
    const { system: cSys, user: cUser } = prompts.coverLetterPrompt();
    const letterResult = await llmJSON({
      apiKeys,
      tier: 'flagship',
      override: modelOverride,
      system: cSys,
      userPrompt: cUser({ resumeJson: resumeFit.resumeJson, jdText, jdAnalysis: analysis, customInstructions, lengthGuidance: 'Fill one full page but do not overflow it.' }),
      maxTokens: 1800
    });
    const letterFit = await fitCoverLetter({
      letterJson: letterResult.data,
      candidate: resumeFit.resumeJson,
      apiKeys,
      tier: 'balanced',
      override: modelOverride,
      targetPages: 1
    });

    // 5. Transparent before/after ATS keyword score.
    const keywordList = (analysis.keywords && analysis.keywords.length ? analysis.keywords : extractKeywordsHeuristic(jdText));
    const beforeScore = scoreAgainstKeywords(resumeToPlainText(resumeJson), keywordList);
    const afterScore = scoreAgainstKeywords(resumeToPlainText(resumeFit.resumeJson), keywordList);

    // 6. Store the generated files for download.
    const resumeFileId = fileStore.put(
      resumeFit.docxBuffer,
      `${(resumeFit.resumeJson.name || 'resume').replace(/\s+/g, '_')}_Resume.docx`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    const coverLetterFileId = fileStore.put(
      letterFit.docxBuffer,
      `${(resumeFit.resumeJson.name || 'candidate').replace(/\s+/g, '_')}_Cover_Letter.docx`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    res.json({
      jdAnalysis: analysis,
      resume: resumeFit.resumeJson,
      changeNotes: changeNotes || [],
      coverLetter: letterFit.letterJson,
      atsScore: { before: beforeScore, after: afterScore, keywordsUsed: keywordList },
      pageFit: {
        resume: { pages: resumeFit.pages, verified: resumeFit.verified, iterations: resumeFit.iterations, target: 2 },
        coverLetter: { pages: letterFit.pages, verified: letterFit.verified, iterations: letterFit.iterations, target: 1 }
      },
      modelUsed: { provider: tailorResult.provider, model: tailorResult.model },
      files: { resumeFileId, coverLetterFileId }
    });
  })
);

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------
router.get('/download/:fileId', (req, res) => {
  const entry = fileStore.get(req.params.fileId);
  if (!entry) return res.status(404).json({ error: 'File not found or expired. Please regenerate.' });
  res.setHeader('Content-Type', entry.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${entry.filename}"`);
  res.send(entry.buffer);
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
router.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err instanceof LLMError ? 502 : 500;
  res.status(status).json({ error: err.message || 'Unexpected server error.' });
});

module.exports = router;
