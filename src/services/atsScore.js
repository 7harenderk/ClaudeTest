// A transparent, non-magical keyword-overlap score. This is NOT a claim about
// any specific vendor's ATS parser (nobody outside those vendors can honestly
// promise that). It's a simple, inspectable proxy: of the JD's important terms,
// how many appear in the resume text -- which is the mechanism most real ATS
// keyword filters actually use. Shown as "before" (original resume) vs "after"
// (tailored resume) so the improvement is honest and checkable, not asserted.

const STOPWORDS = new Set(
  ('a about above after again against all am an and any are as at be because been before being below ' +
    'between both but by could did do does doing down during each few for from further had has have having ' +
    'he her here hers herself him himself his how i if in into is it its itself just me more most my myself no ' +
    'nor not now of off on once only or other our ours ourselves out over own same she should so some such than ' +
    'that the their theirs them themselves then there these they this those through to too under until up very ' +
    'was we were what when where which while who whom why will with you your yours yourself yourselves will ' +
    'etc using use used able across per new strong including included include years experience role work team').split(' ')
);

function normalize(text) {
  return (text || '').toLowerCase();
}

function tokenize(text) {
  return normalize(text)
    .replace(/[^a-z0-9+#./&\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** Pull candidate keywords/phrases (1-3 word n-grams) out of a JD, ranked by
 * frequency. Cheap and deterministic -- used as a fallback / cross-check
 * alongside the LLM's own extraction. */
function extractKeywordsHeuristic(jdText, limit = 40) {
  const tokens = tokenize(jdText);
  const freq = new Map();
  const bump = (k) => freq.set(k, (freq.get(k) || 0) + 1);

  tokens.forEach((t) => bump(t));
  for (let i = 0; i < tokens.length - 1; i++) bump(`${tokens[i]} ${tokens[i + 1]}`);
  for (let i = 0; i < tokens.length - 2; i++) bump(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);

  return [...freq.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

function scoreAgainstKeywords(resumeText, keywords) {
  const hay = normalize(resumeText);
  const matched = [];
  const missing = [];
  keywords.forEach((kw) => {
    const needle = normalize(kw);
    if (!needle) return;
    if (hay.includes(needle)) matched.push(kw);
    else missing.push(kw);
  });
  const total = matched.length + missing.length;
  const percent = total === 0 ? 0 : Math.round((matched.length / total) * 100);
  return { percent, matched, missing, total };
}

module.exports = { extractKeywordsHeuristic, scoreAgainstKeywords, tokenize };
