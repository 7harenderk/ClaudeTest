// Builds a .docx that mirrors the visual style of the sample resume the user
// likes: dark-navy name/section headers with a thin rule, a bold accent-blue
// company line, three-column competency chips, and clean hanging-indent bullets.
//
// Font size / margins are passed in as `style` so the page-fit loop in
// routes/api.js can nudge them within a tasteful range to hit an exact page
// count without the content itself looking stretched or crammed.

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  convertInchesToTwip
} = require('docx');

const DARK_NAVY = '1F3864';
const ACCENT_BLUE = '2E74B5';
const TEXT_BLACK = '1A1A1A';
const RULE_GRAY = 'BFBFBF';

const DEFAULT_STYLE = {
  fontFamily: 'Calibri',
  marginInches: 0.55,
  nameSize: 40, // half-points -> 20pt
  taglineSize: 22, // 11pt
  contactSize: 19, // 9.5pt
  sectionHeaderSize: 22, // 11pt
  bodySize: 21, // 10.5pt
  bulletSize: 21,
  sectionSpacingBefore: 220,
  sectionSpacingAfter: 100,
  lineSpacing: 264 // ~1.1 lines (240 = single)
};

function mergeStyle(style) {
  return { ...DEFAULT_STYLE, ...(style || {}) };
}

function sectionHeading(text, style) {
  return new Paragraph({
    spacing: { before: style.sectionSpacingBefore, after: style.sectionSpacingAfter },
    border: {
      bottom: { color: DARK_NAVY, space: 2, style: BorderStyle.SINGLE, size: 6 }
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        color: DARK_NAVY,
        size: style.sectionHeaderSize,
        font: style.fontFamily
      })
    ]
  });
}

function bodyRun(text, opts = {}) {
  return new TextRun({ text, font: DEFAULT_STYLE.fontFamily, ...opts });
}

function bulletParagraph(text, style, opts = {}) {
  return new Paragraph({
    spacing: { after: 60, line: style.lineSpacing },
    indent: { left: convertInchesToTwip(0.22), hanging: convertInchesToTwip(0.16) },
    children: [
      new TextRun({ text: '•  ', font: style.fontFamily, size: style.bulletSize, color: TEXT_BLACK }),
      new TextRun({ text, font: style.fontFamily, size: style.bulletSize, color: TEXT_BLACK, ...opts })
    ]
  });
}

function competencyTable(items, style) {
  const cols = 3;
  const rows = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const tableRows = rows.map(
    (rowItems) =>
      new TableRow({
        children: Array.from({ length: cols }).map((_, i) => {
          const text = rowItems[i];
          return new TableCell({
            width: { size: 100 / cols, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            margins: { top: 40, bottom: 40, left: 0, right: 120 },
            children: [
              new Paragraph({
                spacing: { line: style.lineSpacing },
                children: text
                  ? [
                      new TextRun({ text: '▸ ', bold: true, color: ACCENT_BLUE, size: style.bodySize, font: style.fontFamily }),
                      new TextRun({ text, size: style.bodySize, color: TEXT_BLACK, font: style.fontFamily })
                    ]
                  : []
              })
            ]
          });
        })
      })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows });
}

function experienceBlock(job, style) {
  const children = [
    new Paragraph({
      spacing: { before: 140, after: 10 },
      children: [new TextRun({ text: job.title || '', bold: true, size: style.bodySize + 1, color: TEXT_BLACK, font: style.fontFamily })]
    }),
    new Paragraph({
      spacing: { after: 70 },
      children: [
        new TextRun({ text: job.company || '', bold: true, color: ACCENT_BLUE, size: style.bodySize, font: style.fontFamily }),
        new TextRun({ text: '  |  ', color: RULE_GRAY, size: style.bodySize, font: style.fontFamily }),
        new TextRun({ text: job.location || '', italics: true, color: TEXT_BLACK, size: style.bodySize, font: style.fontFamily }),
        new TextRun({ text: '  |  ', color: RULE_GRAY, size: style.bodySize, font: style.fontFamily }),
        new TextRun({ text: job.dates || '', italics: true, color: TEXT_BLACK, size: style.bodySize, font: style.fontFamily })
      ]
    })
  ];
  (job.bullets || []).forEach((b) => children.push(bulletParagraph(b, style)));
  return children;
}

function oneLinerEntries(lines, style) {
  return lines.map((line) => bulletParagraph(line, style));
}

function educationEntries(lines, style) {
  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 60, line: style.lineSpacing },
        children: [new TextRun({ text: line, size: style.bodySize, color: TEXT_BLACK, font: style.fontFamily })]
      })
  );
}

function buildResumeDocx(resume, styleOverride = {}) {
  const style = mergeStyle(styleOverride);
  const children = [];

  // Header: name, tagline, contact, rule
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: resume.name || '', bold: true, size: style.nameSize, color: DARK_NAVY, font: style.fontFamily })]
    })
  );
  if (resume.tagline) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: resume.tagline, bold: true, size: style.taglineSize, color: DARK_NAVY, font: style.fontFamily })]
      })
    );
  }
  const contactParts = [resume.location, ...(resume.phones || []), resume.email, resume.linkedin].filter(Boolean);
  children.push(
    new Paragraph({
      border: { bottom: { color: DARK_NAVY, space: 4, style: BorderStyle.SINGLE, size: 10 } },
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: contactParts.join('   |   '),
          size: style.contactSize,
          color: TEXT_BLACK,
          font: style.fontFamily
        })
      ]
    })
  );

  if (resume.summary) {
    children.push(sectionHeading('Executive Summary', style));
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 100, line: style.lineSpacing },
        children: [bodyRun(resume.summary, { size: style.bodySize, color: TEXT_BLACK })]
      })
    );
  }

  if (resume.competencies?.length) {
    children.push(sectionHeading('Core Competencies', style));
    children.push(competencyTable(resume.competencies, style));
    children.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
  }

  if (resume.experience?.length) {
    children.push(sectionHeading('Professional Experience', style));
    resume.experience.forEach((job) => children.push(...experienceBlock(job, style)));
  }

  if (resume.earlierCareer?.length) {
    children.push(sectionHeading('Earlier Career', style));
    children.push(...oneLinerEntries(resume.earlierCareer, style));
  }

  if (resume.boardGovernance?.length) {
    children.push(sectionHeading('Board & Governance', style));
    children.push(...oneLinerEntries(resume.boardGovernance, style));
  }

  if (resume.education?.length) {
    children.push(sectionHeading('Education', style));
    children.push(...educationEntries(resume.education, style));
  }

  if (resume.certifications?.length) {
    children.push(sectionHeading('Certifications', style));
    children.push(...oneLinerEntries(resume.certifications, style));
  }

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

module.exports = { buildResumeDocx, DEFAULT_STYLE };
