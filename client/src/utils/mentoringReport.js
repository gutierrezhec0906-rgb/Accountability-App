import { newDoc, C } from './pdfKit';

const PILLAR_COLOR = { Leadership: C.navy, Technical: C.cyan, Interpersonal: C.purple };

// Generate + save a printable Mentoring Cycle PDF. Empty fields render as blank
// write-on lines so the same PDF works as a hand-writable template.
export function generateMentoringPDF(plan, { userName = '', skillsSummary = null, plannedSessions = 0, avgGoalCompletion = 0, goalsAchieved = 0, challenges = [] } = {}) {
  const k = newDoc();
  const { pdf, MARGIN, CW } = k;

  k.titleBand('Mentoring Cycle', plan.mentor?.name ? `Mentee: ${userName || '—'}  ·  Mentor: ${plan.mentor.name}` : `Mentee: ${userName || '—'}`);

  if (plan.cycle?.startDate) {
    k.text(`Cycle: ${plan.cycle.startDate} — ${plan.cycle.endDate}  ·  Cadence: ${plan.cadence || '—'}`, MARGIN, 9, C.muted, false, CW);
    k.y += 16;
  }

  // SECTION 1 — Match & Commit
  k.sectionHeader('1.  Match & Commit', C.purple);
  k.field('Mentor Name', plan.mentor?.name, { blanks: 1 });
  k.field('Mentor Role', plan.mentor?.role, { blanks: 1 });
  k.field('Type of Mentoring Relationship', plan.mentor?.type, { blanks: 1 });
  k.field('Focus Area', plan.mentor?.focus, { blanks: 1 });
  k.field('Commitment Confirmed', plan.mentor?.committed ? 'Yes - confirmed by both parties' : '', { blanks: 1 });

  // SECTION 2 — Goals
  k.sectionHeader('2.  Set the Goals', C.cyan);
  const goals = plan.goals && plan.goals.length ? plan.goals : [null];
  goals.forEach((g, i) => {
    k.space(60);
    pdf.setFillColor(...(g ? PILLAR_COLOR[g.pillar] || C.navy : C.navy));
    pdf.roundedRect(MARGIN, k.y, CW, 18, 3, 3, 'F');
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.white);
    pdf.text(k.safe(`Goal ${i + 1}${g ? ' - ' + g.pillar : ''}`), MARGIN + 8, k.y + 12);
    k.y += 26;
    k.field('Goal', g?.goal, { blanks: 1, indent: 8 });
    k.field('How success will be measured', g?.measure, { blanks: 1, indent: 8 });
    k.field('Timeline', g?.timeline ? `${g.timeline} days` : '', { blanks: 1, indent: 8 });
  });

  // SECTION 3 — Session Cadence + Log
  k.sectionHeader('3.  Session Cadence & Log', C.pink);
  k.field('Cadence', plan.cadence, { blanks: 1 });
  const sessions = plan.sessions && plan.sessions.length ? plan.sessions : [];
  if (!sessions.length) {
    k.text('No sessions logged yet.', MARGIN, 9, C.muted, false, CW);
    k.y += 16;
  } else {
    sessions.slice(0, 8).forEach(s => {
      k.space(70);
      pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.navy);
      pdf.text(k.safe(s.date), MARGIN, k.y + 8);
      k.y += 16;
      k.field('Progress Review', s.progressReview, { blanks: 0, indent: 8 });
      if (s.challenge) k.field('Challenge', s.challenge, { blanks: 0, indent: 8 });
      if (s.actionItem) k.field('Action Item', s.actionItem, { blanks: 0, indent: 8 });
      k.y += 4;
    });
  }

  // SECTION 4 — Track Progress
  k.sectionHeader('4.  Track Progress', C.teal);
  k.field('Average Goal Completion', `${avgGoalCompletion}%`, { blanks: 0 });
  if (skillsSummary) {
    k.text('Skill Pillars (self-assessed, /5):', MARGIN, 9, C.muted, true, CW);
    k.y += 14;
    Object.entries(skillsSummary).forEach(([p, v]) => {
      k.text(`${p}: ${v ?? '-'}`, MARGIN + 8, 9, PILLAR_COLOR[p] || C.text, false, CW - 8);
      k.y += 14;
    });
    k.y += 4;
  }
  if (challenges.length) {
    k.text('Challenges Encountered:', MARGIN, 9, C.muted, true, CW);
    k.y += 14;
    challenges.slice(0, 5).forEach(c => {
      k.text(`- ${c.date}: ${c.text}`, MARGIN + 8, 9, C.text, false, CW - 8);
      k.y += 14;
    });
  }

  // SECTION 5 — Measure & Close
  k.sectionHeader('5.  Measure & Close', C.amber);
  k.field('Sessions Completed vs. Planned', `${sessions.length} / ${plannedSessions || '-'}`, { blanks: 0 });
  k.field('Goals Achieved vs. Set', `${goalsAchieved} / ${goals.length}`, { blanks: 0 });
  if (plan.closeOut) {
    k.field('Recommendation', plan.closeOut.recommendation, { blanks: 0 });
    k.field('Closing Notes', plan.closeOut.notes, { blanks: 1 });
    k.text('Mentee Self vs. Mentor Rating (/5):', MARGIN, 9, C.muted, true, CW);
    k.y += 14;
    Object.keys(plan.closeOut.menteeSelf || {}).forEach(p => {
      k.text(`${p}: Self ${plan.closeOut.menteeSelf[p]}  ·  Mentor ${plan.closeOut.mentorAssessment[p]}`, MARGIN + 8, 9, PILLAR_COLOR[p] || C.text, false, CW - 8);
      k.y += 14;
    });
  } else {
    k.field('Recommendation (continue / graduate / reassign)', '', { blanks: 1 });
  }

  // Signatures
  k.space(70);
  k.y += 10;
  pdf.setDrawColor(...C.line); pdf.setLineWidth(0.5);
  const half = (CW - 30) / 2;
  pdf.line(MARGIN, k.y, MARGIN + half, k.y);
  pdf.line(MARGIN + half + 30, k.y, MARGIN + CW, k.y);
  k.y += 14;
  k.text('Mentee Signature & Date', MARGIN, 8, C.muted, false);
  k.text('Mentor Signature & Date', MARGIN + half + 30, 8, C.muted, false);

  const safeName = (userName || 'Mentoring_Plan').replace(/\s+/g, '_');
  k.finish(`Mentoring_Cycle_${safeName}.pdf`);
}
