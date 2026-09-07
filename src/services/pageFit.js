// Renders a generated .docx through LibreOffice (headless) to a real PDF and
// counts the actual pages. This is what lets the app promise an *exact* page
// count instead of an estimate: we measure the true rendered output and, if it
// doesn't match, adjust and re-measure, rather than guessing from a word count.
//
// LibreOffice is optional: if `soffice`/`libreoffice` isn't on PATH, the caller
// falls back to a heuristic word-count estimate (see estimatePages below) and
// the UI is told the page count is estimated, not verified.

const { execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let cachedBinary; // undefined = not checked yet, null = not found, string = path

function findSofficeBinary() {
  return new Promise((resolve) => {
    if (cachedBinary !== undefined) return resolve(cachedBinary);
    execFile('which', ['soffice'], (err, stdout) => {
      if (!err && stdout.trim()) {
        cachedBinary = stdout.trim();
        return resolve(cachedBinary);
      }
      execFile('which', ['libreoffice'], (err2, stdout2) => {
        cachedBinary = !err2 && stdout2.trim() ? stdout2.trim() : null;
        resolve(cachedBinary);
      });
    });
  });
}

async function convertDocxToPdf(docxBuffer, { timeoutMs = 45000 } = {}) {
  const binary = await findSofficeBinary();
  if (!binary) return null;

  const workDir = path.join(os.tmpdir(), `resume-fit-${uuidv4()}`);
  await fs.mkdir(workDir, { recursive: true });
  const inputPath = path.join(workDir, 'doc.docx');
  await fs.writeFile(inputPath, docxBuffer);

  try {
    await new Promise((resolve, reject) => {
      execFile(
        binary,
        [
          '--headless',
          '--nologo',
          '--nofirststartwizard',
          `-env:UserInstallation=file://${workDir}/profile`,
          '--convert-to',
          'pdf',
          '--outdir',
          workDir,
          inputPath
        ],
        { timeout: timeoutMs },
        (err, stdout, stderr) => {
          if (err) return reject(new Error(`LibreOffice conversion failed: ${stderr || err.message}`));
          resolve();
        }
      );
    });
    const pdfPath = path.join(workDir, 'doc.pdf');
    const pdfBuffer = await fs.readFile(pdfPath);
    return pdfBuffer;
  } finally {
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function countPdfPages(pdfBuffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(pdfBuffer);
  return data.numpages;
}

/** Returns { pages, pdfBuffer, verified } or { pages: null, verified: false } if
 * LibreOffice isn't available. */
async function renderAndCountPages(docxBuffer) {
  try {
    const pdfBuffer = await convertDocxToPdf(docxBuffer);
    if (!pdfBuffer) return { pages: null, verified: false, pdfBuffer: null };
    const pages = await countPdfPages(pdfBuffer);
    return { pages, verified: true, pdfBuffer };
  } catch (e) {
    return { pages: null, verified: false, pdfBuffer: null, error: e.message };
  }
}

/** Rough fallback when LibreOffice isn't installed: ~430 words fits a dense
 * professional resume page at 10.5pt/0.55in margins; ~380 for a cover letter
 * page at 11pt/1in margins. Only used as a last resort. */
function estimatePages(wordCount, wordsPerPage = 430) {
  return Math.max(1, Math.ceil(wordCount / wordsPerPage));
}

module.exports = { renderAndCountPages, estimatePages, findSofficeBinary };
