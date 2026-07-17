import { jsPDF } from 'jspdf';

const COLORS = {
  D: [239, 68,  68],   // red
  I: [245, 158, 11],   // amber
  S: [13,  148, 136],  // teal
  C: [30,  58,  138],  // navy
  navy:  [15,  32,  68],
  white: [255, 255, 255],
  light: [248, 250, 252],
  muted: [100, 116, 132],
  border:[226, 232, 240],
  text:  [30,  41,  59],
};

const PROFILES = {
  D: {
    name: 'Dominance',
    tagline: 'The Driver — Results-focused, bold, decisive',
    strengths: ['Drives results and takes initiative', 'Thrives under pressure and challenges', 'Decisive — moves from idea to action fast', 'Competitive and goal-oriented', 'Strong problem-solver with urgency'],
    blindspots: ['May appear blunt or dismissive of feelings', 'Can move too fast without enough input', 'Tends to overlook team emotional needs', 'Risk of burnout from constant drive'],
    develop: [
      'Practice asking "What does the team think?" before deciding.',
      'Schedule regular 1-on-1 check-ins to understand team concerns.',
      'Count to 10 before reacting — pause creates space for better decisions.',
    ],
  },
  I: {
    name: 'Influence',
    tagline: 'The Inspirer — People-focused, enthusiastic, optimistic',
    strengths: ['Inspires and energizes those around them', 'Builds relationships and earns trust quickly', 'Persuasive communicator who rallies teams', 'Creative and open to new ideas', 'Positive presence that lifts morale'],
    blindspots: ['May avoid difficult conversations or conflict', 'Can lose focus on follow-through and details', 'Risk of over-promising to keep people happy', 'Enthusiasm can overshadow planning'],
    develop: [
      'Create a personal accountability system — written commitments with deadlines.',
      'Practice delivering hard feedback with the SBI model (Situation, Behavior, Impact).',
      'Block focused work time and minimize social interruptions during deep-work hours.',
    ],
  },
  S: {
    name: 'Steadiness',
    tagline: 'The Stabilizer — Calm, reliable, team-oriented',
    strengths: ['Creates harmony and psychological safety', 'Highly dependable and consistent under stress', 'Patient listener who earns deep trust', 'Collaborative team player and peacemaker', 'Excellent at sustaining long-term relationships'],
    blindspots: ['May avoid speaking up or asserting boundaries', 'Resistance to change can slow adaptation', 'Struggles with urgency and rapid pivots', 'May absorb others\' stress without expressing own needs'],
    develop: [
      'Practice the "Yes, and" method — agree AND add your perspective immediately.',
      'Set a personal goal to initiate one change idea per month.',
      'Use "I need…" statements to assert your own requirements clearly.',
    ],
  },
  C: {
    name: 'Conscientiousness',
    tagline: 'The Analyst — Precise, systematic, quality-driven',
    strengths: ['Produces high-quality, accurate work', 'Identifies risks and prevents costly errors', 'Systematic thinker who builds solid processes', 'Fact-based decision maker with deep expertise', 'Excellent at research and root-cause analysis'],
    blindspots: ['Analysis paralysis — can delay decisions seeking more data', 'May be perceived as overly critical or nit-picky', 'Difficulty delegating due to high standards', 'Can struggle to connect emotionally with the team'],
    develop: [
      'Adopt the "80% ready" rule — ship and iterate rather than perfecting before launch.',
      'Practice "warm-up" conversations before meetings to build rapport.',
      'Set a decision deadline: if data is not conclusive by X, decide with what you have.',
    ],
  },
};

const COMMUNICATION_TIPS = {
  D: { with: 'Working with Dominance types', tips: ['Be direct and get to the point fast', 'Focus on results and bottom-line impact', 'Respect their time — avoid long preambles', 'Bring solutions, not just problems'] },
  I: { with: 'Working with Influence types', tips: ['Be warm and show genuine interest in them', 'Allow time for storytelling and social chat', 'Celebrate their ideas enthusiastically', 'Frame tasks in terms of the people impact'] },
  S: { with: 'Working with Steadiness types', tips: ['Be patient — give them time to process', 'Show appreciation for their reliability', 'Avoid sudden changes without explanation', 'Ask for their opinion — they rarely volunteer it'] },
  C: { with: 'Working with Conscientiousness types', tips: ['Provide data, evidence, and specifics', 'Give them time to think before responding', 'Avoid vague or emotional arguments', 'Acknowledge the quality of their analysis'] },
};

const BALANCE_ACTIONS = {
  D: ['Join a collaborative project where you must listen before leading.', 'Practice reflecting on team feelings after every key decision.', 'Mentor a junior team member with patience and encouragement.'],
  I: ['Lead a project that requires detailed planning and reporting.', 'Commit to following through on three promises this month — track them.', 'Practice structured note-taking in every meeting.'],
  S: ['Volunteer to present a new idea to your team this quarter.', 'Participate in at least one cross-functional change initiative.', 'Set a boundary or say "no" assertively once this week.'],
  C: ['Schedule a lunch with a colleague with no agenda — just connect.', 'Make one decision today without waiting for more data.', 'Give positive verbal feedback to someone on your team unprompted.'],
};

export function generateDISCReport(result, userName = '') {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = 595, MARGIN = 44, CW = PW - MARGIN * 2;
  let y = 0;

  function newPage() { pdf.addPage(); y = MARGIN; }
  function space(n) { if (y + n > 800) newPage(); }

  function rect(x, ry, w, h, r, fill, stroke) {
    if (fill) { pdf.setFillColor(...fill); pdf.roundedRect(x, ry, w, h, r, r, 'F'); }
    if (stroke) { pdf.setDrawColor(...stroke); pdf.setLineWidth(0.5); pdf.roundedRect(x, ry, w, h, r, r, 'S'); }
  }

  function line(x1, y1, x2, y2, color = COLORS.border, lw = 0.5) {
    pdf.setDrawColor(...color); pdf.setLineWidth(lw); pdf.line(x1, y1, x2, y2);
  }

  function text(str, x, size, color, bold, maxW, align = 'left') {
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    if (maxW) {
      const lines = pdf.splitTextToSize(String(str), maxW);
      pdf.text(lines, x, y, { align });
      return lines.length * size * 1.35;
    }
    pdf.text(String(str), x, y, { align });
    return size * 1.35;
  }

  const { scores, primary } = result;
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const secondary = sorted[1]?.[0];
  const Q_TOTAL = Object.values(scores).reduce((a, b) => a + b, 0);

  // Underrepresented = score <= 20% of total
  const underrep = sorted.filter(([, v]) => v / Q_TOTAL <= 0.15).map(([k]) => k);

  // ── PAGE 1: Cover ──────────────────────────────────────────────
  rect(0, 0, PW, 200, 0, COLORS.navy);
  y = 52;
  text('DISC PERSONALITY REPORT', PW / 2, 11, [255, 255, 255, 0.6], false, null, 'center');
  y += 16;
  text('Leadership Flow Technologies', PW / 2, 9, [200, 210, 230], false, null, 'center');
  y += 30;
  text(userName || 'Assessment Participant', PW / 2, 22, COLORS.white, true, null, 'center');
  y += 30;
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  text(dateStr, PW / 2, 10, [180, 195, 215], false, null, 'center');

  // Primary style badge
  y = 220;
  const pColor = COLORS[primary];
  rect(MARGIN, y, CW, 80, 14, pColor);
  y += 26;
  text(`Primary Style: ${primary} — ${PROFILES[primary].name}`, PW / 2, 16, COLORS.white, true, null, 'center');
  y += 22;
  text(PROFILES[primary].tagline, PW / 2, 10, [255, 255, 255], false, null, 'center');

  // Score bars
  y = 325;
  text('YOUR DISC SCORES', MARGIN, 9, COLORS.muted, true);
  y += 18;
  const barW = CW;
  const maxScore = Q_TOTAL;
  sorted.forEach(([type, score]) => {
    const pct = score / maxScore;
    const fillW = pct * barW * 0.85;
    rect(MARGIN, y, barW, 28, 4, [240, 244, 248]);
    if (fillW > 0) rect(MARGIN, y, fillW, 28, 4, COLORS[type]);
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...COLORS.white);
    pdf.text(`${type} — ${PROFILES[type].name}`, MARGIN + 10, y + 18);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`${score}/${maxScore} (${Math.round(pct * 100)}%)`, PW - MARGIN - 2, y + 18, { align: 'right' });
    y += 36;
  });

  // Balance summary
  y += 8;
  const isBalanced = sorted[0][1] - sorted[1][1] <= Math.ceil(Q_TOTAL * 0.15);
  const balColor = isBalanced ? [13, 148, 136] : [245, 158, 11];
  rect(MARGIN, y, CW, 56, 8, isBalanced ? [236, 253, 245] : [255, 251, 235]);
  y += 16;
  text(isBalanced ? '✓ Good Style Balance' : '⚠  Dominant Style Detected', MARGIN + 14, 10, balColor, true);
  y += 14;
  const balMsg = isBalanced
    ? `Your ${primary} and ${secondary} styles are well-matched. You demonstrate versatility across multiple behavioral modes — a key trait of adaptive leaders.`
    : `Your ${primary} style is significantly stronger than others. This creates clarity and focus, but may limit adaptability. Developing your ${underrep.join(' and ')} style${underrep.length > 1 ? 's' : ''} will make you a more versatile leader.`;
  text(balMsg, MARGIN + 14, 8, COLORS.text, false, CW - 28);
  y += 36;

  // ── PAGE 2: Strengths & Blind Spots ────────────────────────────
  newPage();
  rect(MARGIN, y, CW, 36, 8, COLORS.navy);
  y += 24;
  text('STRENGTHS & BLIND SPOTS', MARGIN + 14, 13, COLORS.white, true);
  y += 20;

  // Primary style deep-dive
  const pProfile = PROFILES[primary];
  y += 8;
  rect(MARGIN, y, 4, 18, 2, pColor);
  text(`${primary} — ${pProfile.name}: Your Natural Strengths`, MARGIN + 12, 11, COLORS.text, true);
  y += 22;
  pProfile.strengths.forEach(s => {
    space(16);
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...COLORS.text);
    pdf.circle(MARGIN + 8, y - 3, 2, 'F');
    const lines = pdf.splitTextToSize(s, CW - 20);
    pdf.text(lines, MARGIN + 16, y);
    y += lines.length * 13;
  });

  y += 10;
  rect(MARGIN, y, 4, 18, 2, [239, 68, 68]);
  text('Watch Out For — Blind Spots', MARGIN + 12, 11, COLORS.text, true);
  y += 22;
  pProfile.blindspots.forEach(b => {
    space(16);
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...COLORS.muted);
    pdf.circle(MARGIN + 8, y - 3, 2, 'F');
    const lines = pdf.splitTextToSize(b, CW - 20);
    pdf.text(lines, MARGIN + 16, y);
    y += lines.length * 13;
  });

  // Secondary style
  if (secondary) {
    y += 14;
    space(60);
    const sColor = COLORS[secondary];
    const sProfile = PROFILES[secondary];
    rect(MARGIN, y, 4, 18, 2, sColor);
    text(`${secondary} — ${sProfile.name}: Secondary Style Strengths`, MARGIN + 12, 11, COLORS.text, true);
    y += 22;
    sProfile.strengths.slice(0, 3).forEach(s => {
      space(16);
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...COLORS.text);
      pdf.circle(MARGIN + 8, y - 3, 2, 'F');
      const lines = pdf.splitTextToSize(s, CW - 20);
      pdf.text(lines, MARGIN + 16, y);
      y += lines.length * 13;
    });
  }

  // Development tips for primary
  y += 14;
  space(100);
  rect(MARGIN, y, CW, 26, 6, [236, 253, 245]);
  y += 17;
  text(`💡  Development Actions for ${primary} — ${pProfile.name}`, MARGIN + 12, 10, [13, 148, 136], true);
  y += 14;
  pProfile.develop.forEach((d, i) => {
    space(30);
    rect(MARGIN, y - 12, 20, 20, 4, pColor);
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...COLORS.white);
    pdf.text(String(i + 1), MARGIN + 10, y, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...COLORS.text);
    const lines = pdf.splitTextToSize(d, CW - 30);
    pdf.text(lines, MARGIN + 26, y);
    y += lines.length * 13 + 6;
  });

  // ── PAGE 3: Balance Action Plan ────────────────────────────────
  newPage();
  rect(MARGIN, y, CW, 36, 8, COLORS.navy);
  y += 24;
  text('90-DAY BALANCE ACTION PLAN', MARGIN + 14, 13, COLORS.white, true);
  y += 20;

  y += 8;
  const planMsg = underrep.length === 0
    ? 'Your scores show solid balance. Use the actions below to strengthen your versatility further.'
    : `Your ${underrep.map(k => `${k} (${PROFILES[k].name})`).join(' and ')} style${underrep.length > 1 ? 's are' : ' is'} underrepresented. The 90-day plan below targets these specifically.`;
  text(planMsg, MARGIN, 9, COLORS.muted, false, CW);
  y += 30;

  const months = ['Month 1 — Awareness', 'Month 2 — Practice', 'Month 3 — Integration'];
  const targetStyles = underrep.length > 0 ? underrep : [secondary, sorted[2]?.[0]].filter(Boolean);

  months.forEach((month, mi) => {
    space(90);
    rect(MARGIN, y, CW, 24, 6, COLORS.navy);
    y += 16;
    text(month, MARGIN + 14, 10, COLORS.white, true);
    y += 14;

    targetStyles.forEach(style => {
      space(55);
      const sColor = COLORS[style];
      const action = BALANCE_ACTIONS[style]?.[mi];
      if (!action) return;
      rect(MARGIN, y, 6, 40, 3, sColor);
      y += 6;
      text(`${style} — ${PROFILES[style].name}`, MARGIN + 14, 9, sColor, true);
      y += 13;
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...COLORS.text);
      const lines = pdf.splitTextToSize(action, CW - 18);
      pdf.text(lines, MARGIN + 14, y);
      y += lines.length * 13 + 8;
    });

    y += 10;
  });

  // Quarterly self-check box
  space(80);
  rect(MARGIN, y, CW, 72, 8, [240, 244, 248], COLORS.border);
  y += 18;
  text('📅  Quarterly Self-Check', MARGIN + 14, 10, COLORS.navy, true);
  y += 14;
  text('Re-take your DISC assessment in 90 days and compare your scores. Look for:', MARGIN + 14, 9, COLORS.muted, false, CW - 28);
  y += 13;
  ['A narrowing gap between your dominant and secondary styles', 'Growth in your previously underrepresented styles', 'Feedback from teammates on the behavioral changes they notice'].forEach(item => {
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...COLORS.muted);
    pdf.circle(MARGIN + 20, y - 3, 1.5, 'F');
    pdf.text(item, MARGIN + 26, y);
    y += 12;
  });

  // ── PAGE 4: Communication Guide ────────────────────────────────
  newPage();
  rect(MARGIN, y, CW, 36, 8, COLORS.navy);
  y += 24;
  text('HOW TO COMMUNICATE WITH EACH STYLE', MARGIN + 14, 13, COLORS.white, true);
  y += 20;

  y += 8;
  text(`As a ${primary} type, here's how to adapt your natural communication style to connect with others:`, MARGIN, 9, COLORS.muted, false, CW);
  y += 22;

  Object.entries(COMMUNICATION_TIPS).forEach(([type, info]) => {
    space(100);
    const tColor = COLORS[type];
    rect(MARGIN, y, CW, 24, 6, tColor);
    y += 16;
    text(info.with, MARGIN + 14, 10, COLORS.white, true);
    y += 14;
    info.tips.forEach(tip => {
      space(20);
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...COLORS.text);
      pdf.circle(MARGIN + 8, y - 3, 2, 'F');
      const lines = pdf.splitTextToSize(tip, CW - 20);
      pdf.text(lines, MARGIN + 16, y);
      y += lines.length * 13;
    });
    y += 12;
  });

  // Footer note
  space(40);
  line(MARGIN, y, PW - MARGIN, y);
  y += 14;
  text('This report is generated from your self-assessment responses. Use it as a starting point for reflection and development, not as a definitive label. DISC styles are behavioral preferences, not fixed personality types — they can evolve with awareness and practice.', MARGIN, 8, COLORS.muted, false, CW);

  // Page numbers
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8); pdf.setTextColor(...COLORS.muted); pdf.setFont('helvetica', 'normal');
    pdf.text(`DISC Report — ${userName || 'Participant'} | Page ${i} of ${totalPages}`, PW / 2, 828, { align: 'center' });
  }

  pdf.save(`DISC_Report_${(userName || 'participant').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}
