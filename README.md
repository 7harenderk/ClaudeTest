# Resume ATS Alignment Studio

A small self-hosted web app that tailors your resume and writes a matching cover letter
for a specific job description — in your own resume's look, in your own voice, with a
transparent before/after ATS keyword score, and a **verified** page count (exactly
2 pages for the resume, exactly 1 for the cover letter) rather than a guess.

## What it does

1. You paste in a job description (or upload one).
2. It extracts the hard skills, keywords, and priorities an ATS/recruiter is scanning for.
3. It rewrites your resume's summary, competencies, and bullet points to align with that
   language — without inventing employers, titles, dates, or numbers that aren't in your
   source material.
4. It renders the result to a real `.docx` styled like the sample resume format
   (dark-navy header, three-column competencies, clean bullets), converts it through
   LibreOffice to a PDF, and **counts the actual rendered pages**. If it's not exactly
   2 pages, it adjusts font size/margins first and, if needed, asks the model to condense
   or expand content — then re-renders and re-counts, up to a few passes.
5. It writes a one-page cover letter for the same job and fits it the same way.
6. You download both as `.docx` files, ready to open in Word/Google Docs.

## Why an API key field, and why "auto-select best LLM"?

You bring your own LLM API key (Anthropic and/or OpenAI). The key is sent from your
browser to this app's own local server for each request, forwarded straight to the
provider, and never written to disk or logged. Nothing is stored server-side beyond an
in-memory, time-limited cache of the generated `.docx` files so you can download them.

"Auto" model selection means: if you provide an Anthropic key, it's used for the actual
writing (the highest-stakes step) with a faster/cheaper model handling quick JD keyword
extraction and small length tweaks; same idea for OpenAI. If you provide both, Anthropic
is preferred by default. You can always override the model from the dropdown.

Model IDs are centralized in `src/config/models.js` — update them there if a provider
ships new models and the defaults start erroring with "model not found".

## Requirements

- Node.js 18+
- **LibreOffice** (`soffice` on PATH) — used headless to render the `.docx` to PDF for
  the exact page-count check. Without it, the app still works, but page counts become a
  word-count *estimate* instead of a verified render (the UI tells you which one you got).
  - macOS: `brew install --cask libreoffice`
  - Debian/Ubuntu: `sudo apt-get install libreoffice`
  - Windows: install LibreOffice and ensure `soffice.exe` is on PATH.

## Setup

```bash
npm install
npm start
```

Then open http://localhost:3000.

## Using it

1. **API Key** — paste your Anthropic and/or OpenAI key. Nothing is saved beyond this
   browser tab's session.
2. **Your Resume** — click "Use Harender's sample resume" to start from the seeded
   profile, or upload your own resume (PDF/DOCX/TXT). It's parsed into a structured
   record you can inspect/edit as JSON if you want fine control.
3. **Additional Context** *(optional)* — upload a LinkedIn export, an older resume, a
   project write-up, or just paste extra background. This gives the model more true
   detail to draw on; it's never used to invent facts.
4. **Job Description** — paste or upload it, then click "Analyze job description" to see
   the extracted keywords and priorities before you generate anything.
5. **Custom Instructions** *(optional)* — tell it what to emphasize, tone, audience, etc.
6. Click **Generate**. You'll get a before/after ATS keyword match, a plain-language list
   of what changed and why, verified page counts, and two `.docx` downloads.

## Project layout

```
server.js                     Express entry point
src/config/models.js          Provider/model registry + auto-selection logic
src/services/llmClient.js     Minimal fetch-based Anthropic/OpenAI client
src/services/fileExtract.js   PDF/DOCX/TXT -> plain text
src/services/atsScore.js      Transparent keyword-overlap scoring
src/services/docxBuilder.js   Resume .docx renderer (matches the sample's look)
src/services/coverLetterBuilder.js  Cover letter .docx renderer
src/services/pageFit.js       LibreOffice render + page count, with a fallback estimate
src/services/fileStore.js     In-memory, expiring store for generated files
src/prompts/index.js          All LLM prompt text
src/routes/api.js             API endpoints + the tailor/fit orchestration
public/                       Front end (no build step, no framework)
data/sample-resume.json       Seeded sample profile ("Use Harender's sample resume")
```

## Notes and honest limitations

- The ATS score is a transparent keyword-overlap heuristic, shown with the exact matched/
  missing terms — not a claim to replicate any specific vendor's proprietary parser.
- The model is instructed hard against fabrication: it may rephrase and reprioritize your
  real experience, never invent employers, dates, titles, or numbers.
- Page-count fitting is verified by an actual LibreOffice render when available; without
  LibreOffice, it falls back to a word-count estimate and says so in the UI.
