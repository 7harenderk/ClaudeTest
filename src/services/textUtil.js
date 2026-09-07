function words(str) {
  return (str || '').trim().split(/\s+/).filter(Boolean).length;
}

function resumeWordCount(resume) {
  if (!resume) return 0;
  let count = words(resume.summary);
  (resume.competencies || []).forEach((c) => (count += words(c)));
  (resume.experience || []).forEach((job) => {
    count += words(job.title) + words(job.company) + words(job.location) + words(job.dates);
    (job.bullets || []).forEach((b) => (count += words(b)));
  });
  (resume.earlierCareer || []).forEach((l) => (count += words(l)));
  (resume.boardGovernance || []).forEach((l) => (count += words(l)));
  (resume.education || []).forEach((l) => (count += words(l)));
  (resume.certifications || []).forEach((l) => (count += words(l)));
  return count;
}

function resumeToPlainText(resume) {
  if (!resume) return '';
  const parts = [
    resume.name,
    resume.tagline,
    resume.summary,
    ...(resume.competencies || []),
    ...(resume.experience || []).flatMap((j) => [j.title, j.company, ...(j.bullets || [])]),
    ...(resume.earlierCareer || []),
    ...(resume.boardGovernance || []),
    ...(resume.education || []),
    ...(resume.certifications || [])
  ];
  return parts.filter(Boolean).join('\n');
}

function letterWordCount(letter) {
  if (!letter) return 0;
  return words((letter.paragraphs || []).join(' '));
}

module.exports = { words, resumeWordCount, resumeToPlainText, letterWordCount };
