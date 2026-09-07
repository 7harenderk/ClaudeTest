const { Document, Packer, Paragraph, TextRun, AlignmentType, convertInchesToTwip } = require('docx');

const DARK_NAVY = '1F3864';
const TEXT_BLACK = '1A1A1A';

const DEFAULT_STYLE = {
  fontFamily: 'Calibri',
  marginInches: 1.0,
  nameSize: 30, // 15pt
  bodySize: 22, // 11pt
  lineSpacing: 288 // ~1.2
};

function buildCoverLetterDocx(letter, candidate, styleOverride = {}) {
  const style = { ...DEFAULT_STYLE, ...(styleOverride || {}) };
  const children = [];

  children.push(
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: candidate.name || letter.signOff || '', bold: true, size: style.nameSize, color: DARK_NAVY, font: style.fontFamily })]
    })
  );
  const contactParts = [candidate.location, candidate.email, candidate.linkedin].filter(Boolean);
  if (contactParts.length) {
    children.push(
      new Paragraph({
        spacing: { after: 260 },
        children: [new TextRun({ text: contactParts.join('  |  '), size: 19, color: TEXT_BLACK, font: style.fontFamily })]
      })
    );
  }

  children.push(
    new Paragraph({
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          size: style.bodySize,
          color: TEXT_BLACK,
          font: style.fontFamily
        })
      ]
    })
  );

  if (letter.companyName) {
    children.push(
      new Paragraph({
        spacing: { after: 220 },
        children: [new TextRun({ text: letter.companyName, size: style.bodySize, color: TEXT_BLACK, font: style.fontFamily })]
      })
    );
  }

  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: letter.salutation || 'Dear Hiring Manager,', size: style.bodySize, color: TEXT_BLACK, font: style.fontFamily })]
    })
  );

  (letter.paragraphs || []).forEach((p) => {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 200, line: style.lineSpacing },
        children: [new TextRun({ text: p, size: style.bodySize, color: TEXT_BLACK, font: style.fontFamily })]
      })
    );
  });

  children.push(
    new Paragraph({
      spacing: { after: 260 },
      children: [new TextRun({ text: letter.closing || 'Sincerely,', size: style.bodySize, color: TEXT_BLACK, font: style.fontFamily })]
    })
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: letter.signOff || candidate.name || '', bold: true, size: style.bodySize, color: TEXT_BLACK, font: style.fontFamily })]
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(style.marginInches),
              bottom: convertInchesToTwip(style.marginInches),
              left: convertInchesToTwip(style.marginInches),
              right: convertInchesToTwip(style.marginInches)
            }
          }
        },
        children
      }
    ]
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildCoverLetterDocx, DEFAULT_STYLE };
