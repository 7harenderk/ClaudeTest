const fs = require('fs/promises');
const path = require('path');

async function extractText(filePath, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);

  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  if (ext === '.txt' || ext === '.md') {
    return buffer.toString('utf-8');
  }
  // Best-effort fallback: try to read as text.
  return buffer.toString('utf-8');
}

module.exports = { extractText };
