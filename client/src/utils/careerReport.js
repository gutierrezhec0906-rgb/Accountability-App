import { jsPDF } from 'jspdf';

const C = {
  navy:   [15, 32, 68],
  teal:   [13, 148, 136],
  cyan:   [8, 145, 178],
  purple: [124, 58, 237],
  pink:   [190, 24, 93],
  amber:  [180, 83, 9],
  green:  [21, 128, 61],
  white:  [255, 255, 255],
  light:  [248, 250, 252],
  muted:  [100, 116, 132],
  border: [210, 218, 228],
  text:   [30, 41, 59],
  line:   [150, 160, 175],
};

const PILLAR_COLOR = { Leadership: C.navy, Technical: C.cyan, Interpersonal: C.purple };

// Generate + save a printable Career Development Plan PDF.
// Empty fields render as blank write-on lines so the same PDF works as a
// hand-writable template.
export function generateCareerPDF(plan, { userName = '', skillsSummary = null } = {}) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = 595, PH = 842, MARGIN = 40, CW = PW - MARGIN * 2;
  let y = MARGIN;

  function newPage() { pdf.addPage(); y = MARGIN; }
  function space(n) { if (y + n > PH - MARGIN) newPage(); }
  function safe(s) { return (s == null ? '' : String(s)).replace(/[^\x00-\xFF]/g, ''); }

  function text(str, x, size, color, bold, maxW, align = 'left') {
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    const s = safe(str);
    if (maxW) { const lines = pdf.splitTextToSize(s, maxW); pdf.text(lines, x, y, { align }); return lines.length; }
    pdf.text(s, x, y, { align });
    return 1;
  }

  // Blank underlines for hand-writing when a value is empty.
  function blankLines(n = 2, startX = MARGIN, width = CW) {
    for (let i = 0; i < n; i++) {
      space(20);
      pdf.setDrawColor(...C.line); pdf.setLineWidth(0.5);
      pdf.line(startX, y + 8, startX + width, y + 8);
      y += 20;
    }
  }

  // Label + value (or blank lines). blanks = how many write-on lines when empty.
  function field(label, value, { blanks = 2, indent = 0 } = {}) {
    const x = MARGIN + indent;
    space(18);
    text(label, x, 9, C.muted, true, CW - indent);
    y += 13;
    const v = (value || '').trim();
    if (v) {
      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.text);
      const lines = pdf.splitTextToSize(safe(v), CW - indent);
      for (const ln of lines) { space(15); pdf.text(ln, x, y + 8); y += 15; }
      y += 6;
    } else {
      blankLines(blanks, x, CW - indent);
      y += 2;
    }
  }

  function sectionHeader(num, title, color) {
    space(40);
    pdf.setFillColor(...color);
    pdf.roundedRect(MARGIN, y, CW, 26, 4, 4, 'F');
    pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.white);
    pdf.text(safe(`${num}.  ${title}`), MARGIN + 12, y + 17);
    y += 38;
  }

  // ── Title band ──
  pdf.setFillColor(...C.navy);
  pdf.rect(0, 0, PW, 92, 'F');
  pdf.setFontSize(20); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.white);
  pdf.text('Career Development Plan', MARGIN, 44);
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(147, 197, 253);
  pdf.text('Employee-owned - Company-aligned - Time-bound', MARGIN, 64);
  pdf.setFontSize(9); pdf.setTextColor(203, 213, 225);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  pdf.text(`Prepared: ${dateStr}`, PW - MARGIN, 44, { align: 'right' });
  y = 112;

  // Name / role header fields
  field('Leader / Employee Name', userName || '', { blanks: 1 });
  field('Coach Name & Relationship',
    plan.coach?.name ? `${plan.coach.name}${plan.coach.relationship ? '  -  ' + plan.coach.relationship : ''}` : '',
    { blanks: 1 });

  // ── Section 1 — Where am I now (skills snapshot) ──
  sectionHeader(1, 'Where Am I Now?  (Skills Development Matrix)', C.teal);
  if (skillsSummary) {
    const colW = CW / 3;
    ['Leadership', 'Technical', 'Interpersonal'].forEach((p, i) => {
      const s = skillsSummary[p] || {};
      const x = MARGIN + i * colW;
      pdf.setDrawColor(...C.border); pdf.setLineWidth(0.5);
      pdf.roundedRect(x + 2, y, colW - 6, 46, 3, 3, 'S');
      text(p, x + 10, 9, PILLAR_COLOR[p], true);
      y += 16;
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.text);
      pdf.text(safe(`Self: ${s.self ?? '__'} / 5     Peer: ${s.peer ?? '__'} / 5`), x + 10, y + 4);
      y -= 16;
    });
    y += 58;
  } else {
    field('Current proficiency (Leadership / Technical / Interpersonal)', '', { blanks: 3 });
  }

  // ── Section 2 — Where do I want to go ──
  sectionHeader(2, 'Where Do I Want To Go?', C.cyan);
  field('Career Aspiration (next role, expanded responsibility, or skill mastery)', plan.aspiration, { blanks: 3 });
  field('Personal Motivation (why this growth matters to me)', plan.motivation, { blanks: 3 });
  const tl = plan.timeline ? `${plan.timeline} months` : '';
  field('Target Timeline (6 / 12 / 18 months)', tl, { blanks: 1 });

  // ── Section 3 — Coach & company ──
  sectionHeader(3, 'Coach & Company Alignment', C.purple);
  field('Coach Name', plan.coach?.name, { blanks: 1 });
  field('Role / Relationship (Manager, Mentor, SME, Peer, External, Cross-functional)', plan.coach?.relationship, { blanks: 1 });
  field('Coaching Frequency (weekly / bi-weekly / monthly)', plan.coach?.frequency, { blanks: 1 });
  field('Coaching Commitment Confirmed', plan.coach?.committed ? 'Yes - confirmed' : '', { blanks: 1 });
  field('Skills Gaps the Organization Needs Filled', plan.companyNeeds?.skillsGaps, { blanks: 3 });
  field('Strategic Priorities This Growth Supports', plan.companyNeeds?.strategicPriorities, { blanks: 3 });
  field('Resources the Company Will Provide', plan.companyNeeds?.resources, { blanks: 3 });

  // ── Section 4 — Development plan (per pillar) ──
  sectionHeader(4, 'The Development Plan', C.pink);
  ['Leadership', 'Technical', 'Interpersonal'].forEach(p => {
    const row = plan.pillars?.[p] || {};
    space(24);
    pdf.setFillColor(...PILLAR_COLOR[p]);
    pdf.roundedRect(MARGIN, y, CW, 20, 3, 3, 'F');
    text(p, MARGIN + 10, 10, C.white, true);
    y += 30;
    field('Development Goal', row.goal, { blanks: 2, indent: 12 });
    field('Action Steps', row.actions, { blanks: 2, indent: 12 });
    field('Resources', row.resources, { blanks: 1, indent: 12 });
    const t = row.timeline ? row.timeline : '';
    field('Timeline', t, { blanks: 1, indent: 12 });
    field('Progress', (row.progress != null && row.progress !== 0) ? `${row.progress}%` : '', { blanks: 1, indent: 12 });
    y += 6;
  });

  // ── Section 5 — Milestones & progress notes ──
  sectionHeader(5, 'Milestones & Progress Notes', C.amber);
  const MS = [
    { key: 'd30', label: '30-Day Quick Win' },
    { key: 'd90', label: '90-Day Checkpoint' },
    { key: 'm6',  label: '6-Month Formal Review' },
    { key: 'm12', label: '12-Month Completion / Renewal' },
  ];
  MS.forEach(m => {
    const ms = plan.milestones?.[m.key] || {};
    const ci = plan.checkIns?.[m.key] || {};
    space(22);
    text(m.label, MARGIN, 10, C.amber, true);
    const dt = ms.date ? `Target: ${ms.date}` : 'Target: ____________';
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
    pdf.text(safe(dt), PW - MARGIN, y + 8, { align: 'right' });
    y += 20;
    field('Success looks like', ms.text, { blanks: 1, indent: 12 });
    field('Progress notes / comments', ci.note, { blanks: 2, indent: 12 });
    y += 4;
  });

  // ── Signatures ──
  space(70);
  y += 10;
  pdf.setDrawColor(...C.line); pdf.setLineWidth(0.5);
  const half = (CW - 30) / 2;
  pdf.line(MARGIN, y, MARGIN + half, y);
  pdf.line(MARGIN + half + 30, y, MARGIN + CW, y);
  y += 14;
  text('Leader / Employee Signature & Date', MARGIN, 8, C.muted, false);
  text('Coach Signature & Date', MARGIN + half + 30, 8, C.muted, false);

  // Footer on every page
  const pages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
    pdf.text('Leadership Flow Technologies - Accountability App', MARGIN, PH - 20);
    pdf.text(`Page ${i} of ${pages}`, PW - MARGIN, PH - 20, { align: 'right' });
  }

  const safeName = (userName || 'Career_Plan').replace(/\s+/g, '_');
  pdf.save(`Career_Development_Plan_${safeName}.pdf`);
}
