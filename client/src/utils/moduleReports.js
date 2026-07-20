import { newDoc, C } from './pdfKit';

const SMART_ROWS = [
  { key: 'specific',   label: 'S — Specific' },
  { key: 'measurable', label: 'M — Measurable' },
  { key: 'achievable', label: 'A — Achievable' },
  { key: 'relevant',   label: 'R — Relevant' },
  { key: 'timeBound',  label: 'T — Time-Bound' },
];

// ── SMART Goals ─────────────────────────────────────────────────────────────
export function generateSmartGoalsPDF(goals = [], { userName = '' } = {}) {
  const k = newDoc();
  k.titleBand('SMART Goals', 'Specific - Measurable - Achievable - Relevant - Time-Bound');
  k.field('Leader / Employee Name', userName, { blanks: 1 });

  const list = goals.length ? goals : [null]; // one blank template if none
  list.forEach((g, i) => {
    k.sectionHeader(g ? `Goal ${i + 1}:  ${g.title || 'Untitled'}` : `Goal ${i + 1}`, C.navy);
    if (g) {
      const meta = [g.status && `Status: ${g.status}`, g.dueDate && `Due: ${g.dueDate}`].filter(Boolean).join('     ');
      if (meta) { k.text(meta, k.MARGIN, 9, C.muted, false); k.y += 16; }
    } else {
      k.field('Goal Title', '', { blanks: 1 });
    }
    SMART_ROWS.forEach(r => k.field(r.label, g ? g[r.key] : '', { blanks: 2, indent: 8 }));
    k.y += 6;
  });

  k.finish(`SMART_Goals_${(userName || 'Plan').replace(/\s+/g, '_')}.pdf`);
}

// ── Skills Development Matrix ────────────────────────────────────────────────
export function generateSkillsMatrixPDF(matrix = [], { userName = '' } = {}) {
  const k = newDoc();
  const { pdf, MARGIN, CW } = k;
  k.titleBand('Skills Development Matrix', 'Self-assessment and peer ratings across skill domains');
  k.field('Leader / Employee Name', userName, { blanks: 1 });

  const cats = matrix.length ? matrix : [
    { category: 'Leadership', skills: [] }, { category: 'Technical', skills: [] }, { category: 'Interpersonal', skills: [] },
  ];

  cats.forEach(cat => {
    k.sectionHeader(cat.category, C.navy);
    // Column header
    k.space(20);
    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.muted);
    pdf.text('SKILL', MARGIN + 4, k.y + 8);
    pdf.text('SELF (1-5)', MARGIN + CW - 150, k.y + 8);
    pdf.text('PEER (1-5)', MARGIN + CW - 70, k.y + 8);
    k.y += 12;
    pdf.setDrawColor(...C.border); pdf.setLineWidth(0.5); pdf.line(MARGIN, k.y, MARGIN + CW, k.y);
    k.y += 6;

    const rows = (cat.skills && cat.skills.length) ? cat.skills : [null, null, null, null];
    rows.forEach(s => {
      k.space(20);
      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.text);
      if (s) {
        pdf.text(k.safe(s.name), MARGIN + 4, k.y + 8);
        pdf.text(k.safe(String(s.self ?? '__')), MARGIN + CW - 135, k.y + 8);
        pdf.text(k.safe(s.peer > 0 ? String(s.peer) : '__'), MARGIN + CW - 55, k.y + 8);
      } else {
        // Blank write-on row
        pdf.setDrawColor(...C.line);
        pdf.line(MARGIN + 4, k.y + 8, MARGIN + CW - 160, k.y + 8);
        pdf.line(MARGIN + CW - 150, k.y + 8, MARGIN + CW - 90, k.y + 8);
        pdf.line(MARGIN + CW - 70, k.y + 8, MARGIN + CW - 10, k.y + 8);
      }
      k.y += 20;
    });
    k.y += 8;
  });

  k.finish(`Skills_Matrix_${(userName || 'Plan').replace(/\s+/g, '_')}.pdf`);
}

// ── Kaizen Event Plan (single event) ────────────────────────────────────────
export function generateKaizenPDF(kz = {}, { userName = '' } = {}) {
  const k = newDoc();
  k.titleBand('Kaizen Event Plan', kz.title || 'Continuous Improvement Event');
  const meta = [kz.status && `Status: ${kz.status}`, kz.date && `Date: ${kz.date}`, userName && `Facilitator: ${userName}`].filter(Boolean).join('     ');
  if (meta) { k.text(meta, k.MARGIN, 9, C.muted, false); k.y += 18; }

  k.sectionHeader('Phase 1 — Prepare', C.green);
  k.field('Scope — Specific process or area', kz.scope, { blanks: 2 });
  k.field('Goal — Measurable target', kz.goal, { blanks: 2 });
  k.field('Team — Members, facilitator, sponsor', kz.team, { blanks: 2 });
  k.field('Baseline Data — Current-state metrics', kz.baselineData, { blanks: 2 });

  k.sectionHeader('Phase 2 — The Event', C.cyan);
  k.field('Gemba Walk & Process Map Findings', kz.gembaFindings, { blanks: 2 });
  k.field('Wastes Identified (DOWNTIME)', (kz.wastesIdentified || []).join(', '), { blanks: 1 });
  k.field('Root Cause Analysis (5 Whys, Fishbone, Pareto)', kz.rootCauses, { blanks: 2 });
  k.field('Future State Design & Priorities', kz.futureState, { blanks: 2 });
  k.field('Implement & Test — Changes and results', kz.implementationNotes, { blanks: 2 });
  k.field('Standardize & Report-Out', kz.standardWork, { blanks: 2 });

  k.sectionHeader('Phase 3 — Sustain', C.purple);
  k.field('Results Tracking — Metrics vs. target', kz.resultsTracking, { blanks: 2 });

  // Follow-up owners grid
  k.space(18);
  k.text('Follow-Up Owners (Action / Owner / Deadline)', k.MARGIN, 9, C.muted, true);
  k.y += 14;
  const acts = (kz.followUpActions && kz.followUpActions.length) ? kz.followUpActions : [null, null, null];
  const { pdf, MARGIN, CW } = k;
  acts.forEach(r => {
    k.space(18);
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.text);
    if (r) {
      pdf.text(k.safe(r.action || '-'), MARGIN + 4, k.y + 8, { maxWidth: CW - 210 });
      pdf.text(k.safe(r.owner || '-'), MARGIN + CW - 190, k.y + 8);
      pdf.text(k.safe(r.deadline || '-'), MARGIN + CW - 90, k.y + 8);
    } else {
      pdf.setDrawColor(...C.line);
      pdf.line(MARGIN + 4, k.y + 8, MARGIN + CW - 200, k.y + 8);
      pdf.line(MARGIN + CW - 190, k.y + 8, MARGIN + CW - 100, k.y + 8);
      pdf.line(MARGIN + CW - 90, k.y + 8, MARGIN + CW - 10, k.y + 8);
    }
    k.y += 18;
  });
  k.y += 6;

  // Audit schedule
  const ad = kz.auditDates || {};
  const auditStr = [ad.d30 && `30-day: ${ad.d30}`, ad.d60 && `60-day: ${ad.d60}`, ad.d90 && `90-day: ${ad.d90}`].filter(Boolean).join('     ') || kz.auditSchedule || '';
  k.field('Audit Schedule (30 / 60 / 90-day checks)', auditStr, { blanks: 1 });
  k.field('Wins — Results & momentum to share', kz.wins, { blanks: 2 });

  k.finish(`Kaizen_${(kz.title || 'Event').replace(/\s+/g, '_')}.pdf`);
}
