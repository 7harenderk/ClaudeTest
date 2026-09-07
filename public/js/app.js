(function () {
  'use strict';

  const state = {
    resume: null,
    contextFiles: [], // { filename, text }
    jdAnalysis: null,
    modelsConfig: null
  };

  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------------
  // API key persistence (session-only, per tab)
  // ---------------------------------------------------------------------
  function loadKeys() {
    try {
      $('anthropicKey').value = sessionStorage.getItem('ras_anthropicKey') || '';
      $('openaiKey').value = sessionStorage.getItem('ras_openaiKey') || '';
    } catch (e) { /* sessionStorage unavailable, skip */ }
  }
  function saveKeys() {
    try {
      sessionStorage.setItem('ras_anthropicKey', $('anthropicKey').value);
      sessionStorage.setItem('ras_openaiKey', $('openaiKey').value);
    } catch (e) { /* ignore */ }
  }
  $('anthropicKey').addEventListener('input', saveKeys);
  $('openaiKey').addEventListener('input', saveKeys);

  function getApiKeyFields() {
    return { anthropicKey: $('anthropicKey').value.trim(), openaiKey: $('openaiKey').value.trim() };
  }

  function getModelOverride() {
    const val = $('modelChoice').value;
    if (val === 'auto') return null;
    const [provider, model] = val.split('::');
    return { provider, model };
  }

  async function loadModelsConfig() {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      state.modelsConfig = data.providers;
      const select = $('modelChoice');
      Object.entries(data.providers).forEach(([providerKey, cfg]) => {
        Object.entries(cfg.models).forEach(([tier, modelId]) => {
          const opt = document.createElement('option');
          opt.value = `${providerKey}::${modelId}`;
          opt.textContent = `${cfg.label} — ${modelId} (${tier})`;
          select.appendChild(opt);
        });
      });
    } catch (e) { /* leave just the Auto option */ }
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function setStatus(el, msg, isError) {
    el.textContent = msg;
    el.className = 'status' + (isError ? ' error' : '');
  }

  function showGlobalError(msg) {
    const box = $('globalError');
    if (!msg) { box.hidden = true; box.textContent = ''; return; }
    box.hidden = false;
    box.textContent = msg;
  }

  async function postJSON(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request to ${url} failed (${res.status})`);
    return data;
  }

  async function uploadFileForText(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/extract-file', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to read file.');
    return data.text;
  }

  // ---------------------------------------------------------------------
  // Resume input
  // ---------------------------------------------------------------------
  function setResume(resume) {
    state.resume = resume;
    $('resumeJsonBox').value = JSON.stringify(resume, null, 2);
    setStatus($('resumeStatus'), `Loaded: ${resume.name || 'resume'} (${(resume.experience || []).length} roles)`, false);
  }

  $('loadSampleBtn').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/sample-resume');
      const data = await res.json();
      setResume(data.resume);
    } catch (e) {
      setStatus($('resumeStatus'), 'Could not load sample resume.', true);
    }
  });

  $('resumeFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus($('resumeStatus'), 'Reading file...', false);
    try {
      const text = await uploadFileForText(file);
      setStatus($('resumeStatus'), 'Structuring resume with the LLM...', false);
      const { anthropicKey, openaiKey } = getApiKeyFields();
      const data = await postJSON('/api/parse-resume', { resumeText: text, anthropicKey, openaiKey, modelOverride: getModelOverride() });
      setResume(data.resume);
    } catch (err) {
      setStatus($('resumeStatus'), err.message, true);
    }
  });

  $('applyResumeJsonBtn').addEventListener('click', () => {
    try {
      const parsed = JSON.parse($('resumeJsonBox').value);
      state.resume = parsed;
      setStatus($('resumeStatus'), 'Edits applied.', false);
    } catch (e) {
      setStatus($('resumeStatus'), 'Invalid JSON — fix and try again.', true);
    }
  });

  // ---------------------------------------------------------------------
  // Additional context
  // ---------------------------------------------------------------------
  function renderContextFileList() {
    const box = $('contextFileList');
    box.innerHTML = '';
    state.contextFiles.forEach((f, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = f.filename + '  ✕';
      chip.style.cursor = 'pointer';
      chip.title = 'Remove';
      chip.addEventListener('click', () => {
        state.contextFiles.splice(i, 1);
        renderContextFileList();
      });
      box.appendChild(chip);
    });
  }

  $('contextFiles').addEventListener('change', async (e) => {
    for (const file of Array.from(e.target.files)) {
      try {
        const text = await uploadFileForText(file);
        state.contextFiles.push({ filename: file.name, text });
      } catch (err) {
        showGlobalError(`Could not read ${file.name}: ${err.message}`);
      }
    }
    renderContextFileList();
    e.target.value = '';
  });

  function getAdditionalContext() {
    const parts = [];
    state.contextFiles.forEach((f) => parts.push(`--- ${f.filename} ---\n${f.text}`));
    const pasted = $('contextText').value.trim();
    if (pasted) parts.push(`--- Pasted context ---\n${pasted}`);
    return parts.join('\n\n');
  }

  // ---------------------------------------------------------------------
  // Job description
  // ---------------------------------------------------------------------
  $('jdFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await uploadFileForText(file);
      $('jdText').value = text;
    } catch (err) {
      showGlobalError(`Could not read JD file: ${err.message}`);
    }
  });

  $('analyzeJdBtn').addEventListener('click', async () => {
    const jdText = $('jdText').value.trim();
    if (!jdText) return showGlobalError('Paste or upload a job description first.');
    showGlobalError(null);
    const box = $('jdAnalysisResult');
    box.innerHTML = '<p class="muted">Analyzing…</p>';
    try {
      const { anthropicKey, openaiKey } = getApiKeyFields();
      const data = await postJSON('/api/analyze-jd', { jdText, anthropicKey, openaiKey, modelOverride: getModelOverride() });
      state.jdAnalysis = data.analysis;
      renderJdAnalysis(data.analysis);
    } catch (err) {
      box.innerHTML = '';
      showGlobalError(err.message);
    }
  });

  function renderJdAnalysis(a) {
    const box = $('jdAnalysisResult');
    box.innerHTML = `
      <p class="kv"><b>Role:</b> ${escapeHtml(a.jobTitle || '—')}${a.company ? ' at ' + escapeHtml(a.company) : ''}</p>
      <p class="kv"><b>Seniority:</b> ${escapeHtml(a.seniorityLevel || '—')}</p>
      <h3>Key ATS keywords</h3>
      <div class="chip-list">${(a.keywords || []).map((k) => `<span class="chip">${escapeHtml(k)}</span>`).join('')}</div>
      <h3>Likely pain points this hire solves</h3>
      <ul>${(a.likelyPainPoints || []).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
    `;
  }

  // ---------------------------------------------------------------------
  // Generate
  // ---------------------------------------------------------------------
  const progressSteps = [
    'Reading the job description…',
    'Extracting ATS keywords and priorities…',
    'Reframing your experience to match…',
    'Fitting the resume to exactly two pages…',
    'Writing your cover letter…',
    'Fitting the cover letter to one page…'
  ];

  function startProgress() {
    $('resultsEmpty').hidden = true;
    $('resultsContent').hidden = true;
    const box = $('progressBox');
    box.hidden = false;
    let i = 0;
    $('progressText').textContent = progressSteps[0];
    const timer = setInterval(() => {
      i = Math.min(i + 1, progressSteps.length - 1);
      $('progressText').textContent = progressSteps[i];
    }, 3200);
    return () => { clearInterval(timer); box.hidden = true; };
  }

  $('generateBtn').addEventListener('click', async () => {
    showGlobalError(null);
    if (!state.resume) return showGlobalError('Load or upload your resume first (step 2).');
    const jdText = $('jdText').value.trim();
    if (!jdText) return showGlobalError('Paste or upload a job description first (step 4).');
    const { anthropicKey, openaiKey } = getApiKeyFields();
    if (!anthropicKey && !openaiKey) return showGlobalError('Add at least one LLM API key (step 1).');

    const stop = startProgress();
    try {
      const data = await postJSON('/api/generate', {
        resumeJson: state.resume,
        jdText,
        jdAnalysis: state.jdAnalysis,
        additionalContext: getAdditionalContext(),
        customInstructions: $('customInstructions').value.trim(),
        anthropicKey,
        openaiKey,
        modelOverride: getModelOverride()
      });
      renderResults(data);
    } catch (err) {
      showGlobalError(err.message);
    } finally {
      stop();
    }
  });

  function renderResults(data) {
    $('resultsContent').hidden = false;

    $('scoreBefore').textContent = data.atsScore.before.percent + '%';
    $('scoreAfter').textContent = data.atsScore.after.percent + '%';
    $('matchedKeywords').innerHTML = data.atsScore.after.matched.map((k) => `<span class="chip">${escapeHtml(k)}</span>`).join('') || '<span class="muted small">None yet.</span>';
    $('missingKeywords').innerHTML = data.atsScore.after.missing.map((k) => `<span class="chip missing">${escapeHtml(k)}</span>`).join('') || '<span class="muted small">None — full coverage.</span>';

    $('changeNotes').innerHTML = (data.changeNotes || []).map((n) => `<li>${escapeHtml(n)}</li>`).join('') || '<li class="muted">No notes returned.</li>';

    renderFitStatus($('resumeFitStatus'), data.pageFit.resume, 'Resume');
    renderFitStatus($('letterFitStatus'), data.pageFit.coverLetter, 'Cover letter');

    $('downloadResumeBtn').href = `/api/download/${data.files.resumeFileId}`;
    $('downloadLetterBtn').href = `/api/download/${data.files.coverLetterFileId}`;

    $('modelUsedNote').textContent = `Written with ${data.modelUsed.provider} · ${data.modelUsed.model}`;

    $('resumePreview').innerHTML = renderResumePreviewHTML(data.resume);
    $('letterPreview').innerHTML = renderLetterPreviewHTML(data.coverLetter, data.resume);
  }

  function renderFitStatus(el, fit, label) {
    if (fit.verified) {
      el.className = 'fit-status ok';
      el.textContent = `✓ ${label}: verified exactly ${fit.pages} page${fit.pages === 1 ? '' : 's'} (target ${fit.target}), rendered with LibreOffice.`;
    } else {
      el.className = 'fit-status warn';
      el.textContent = `≈ ${label}: estimated ~${fit.pages} page${fit.pages === 1 ? '' : 's'} (target ${fit.target}) — LibreOffice isn't installed on the server, so this is a word-count estimate, not a verified render. Open the .docx to confirm.`;
    }
  }

  function renderResumePreviewHTML(r) {
    const contact = [r.location, ...(r.phones || []), r.email, r.linkedin].filter(Boolean).join(' &nbsp;|&nbsp; ');
    let html = `<h1>${escapeHtml(r.name || '')}</h1>`;
    if (r.tagline) html += `<div class="dp-tagline">${escapeHtml(r.tagline)}</div>`;
    html += `<div class="dp-contact">${contact}</div>`;
    if (r.summary) html += `<h2>Executive Summary</h2><p>${escapeHtml(r.summary)}</p>`;
    if (r.competencies?.length) {
      html += `<h2>Core Competencies</h2><div class="dp-comp-grid">${r.competencies.map((c) => `<div>▸ ${escapeHtml(c)}</div>`).join('')}</div>`;
    }
    if (r.experience?.length) {
      html += `<h2>Professional Experience</h2>`;
      r.experience.forEach((job) => {
        html += `<div class="dp-job-title">${escapeHtml(job.title || '')}</div>`;
        html += `<div class="dp-job-meta">${escapeHtml(job.company || '')} <span>| ${escapeHtml(job.location || '')} | ${escapeHtml(job.dates || '')}</span></div>`;
        html += `<ul>${(job.bullets || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
      });
    }
    if (r.earlierCareer?.length) html += `<h2>Earlier Career</h2><ul>${r.earlierCareer.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
    if (r.boardGovernance?.length) html += `<h2>Board &amp; Governance</h2><ul>${r.boardGovernance.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
    if (r.education?.length) html += `<h2>Education</h2><ul>${r.education.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
    if (r.certifications?.length) html += `<h2>Certifications</h2><ul>${r.certifications.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
    return html;
  }

  function renderLetterPreviewHTML(letter, candidate) {
    let html = `<h1>${escapeHtml(candidate.name || letter.signOff || '')}</h1>`;
    const contact = [candidate.location, candidate.email, candidate.linkedin].filter(Boolean).join(' &nbsp;|&nbsp; ');
    if (contact) html += `<div class="dp-contact">${contact}</div>`;
    if (letter.companyName) html += `<p><b>${escapeHtml(letter.companyName)}</b></p>`;
    html += `<p>${escapeHtml(letter.salutation || 'Dear Hiring Manager,')}</p>`;
    (letter.paragraphs || []).forEach((p) => (html += `<p>${escapeHtml(p)}</p>`));
    html += `<p>${escapeHtml(letter.closing || 'Sincerely,')}<br/><b>${escapeHtml(letter.signOff || candidate.name || '')}</b></p>`;
    return html;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  loadKeys();
  loadModelsConfig();
})();
