import { jsPDF } from 'jspdf';

const CATEGORIES = [
  { id: 'model',    label: 'Model the Way',           color: [37, 99, 235] },
  { id: 'inspire',  label: 'Inspire a Shared Vision', color: [13, 148, 136] },
  { id: 'challenge',label: 'Challenge the Process',   color: [217, 119, 6]  },
  { id: 'enable',   label: 'Enable Others to Act',    color: [124, 58, 237] },
  { id: 'encourage',label: 'Encourage the Heart',     color: [225, 29, 72]  },
];

// Map tool string mentions to app module paths/labels
const TOOL_MODULE_MAP = {
  'Visual Management Board':  { label: 'Visual Management Board', path: '/visual-board' },
  'Visual Mgmt Board':        { label: 'Visual Management Board', path: '/visual-board' },
  'Line of Balance':          { label: 'Line of Balance',         path: '/lob'          },
  'Sense of Urgency':         { label: 'Sense of Urgency',        path: '/urgency'      },
  'EQ Assessment':            { label: 'EQ & OpEx Tools',         path: '/eq-opex'      },
  'Vision Builder':           { label: 'Vision Builder',          path: '/vision'       },
  'SMART Goals':              { label: 'SMART Goals',             path: '/smart-goals'  },
  'Mindfulness':              { label: 'Mindfulness',             path: '/mindfulness'  },
  'Lean Toolkit':             { label: 'Lean Toolkit',            path: '/lean'         },
  'Problem Solving':          { label: 'Problem Solving',         path: '/problem-solving' },
  'DISC Assessment':          { label: 'DISC Assessment',         path: '/disc'         },
  'Skills Development':       { label: 'Skills Development',      path: '/skills'       },
  'Training Center':          { label: 'Training Center',         path: '/training'     },
  'Mentoring Tracker':        { label: 'Mentoring Tracker',       path: '/mentoring'    },
  'Career Development':       { label: 'Career Development',      path: '/career'       },
  'Feedback Box':             { label: 'Feedback Box',            path: '/feedback'     },
  'Coaching Log':             { label: 'Coaching Log',            path: '/coaching'     },
  'Leadership Quotes':        { label: 'Leadership Quotes',       path: '/quotes'       },
};

function extractModules(toolsStr) {
  const out = [];
  if (!toolsStr) return out;
  for (const [key, mod] of Object.entries(TOOL_MODULE_MAP)) {
    if (toolsStr.includes(key)) out.push(mod);
  }
  return out;
}

function scoreLabel(score) {
  if (score >= 9) return 'Exemplary';
  if (score >= 7) return 'Strong';
  if (score >= 5) return 'Developing';
  return 'Emerging';
}

function catScoreLabel(score60) {
  const avg = score60 / 6;
  return scoreLabel(avg);
}

export function generateAssessmentReport(latest, personName = '', personRole = '') {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const PAGE_W = 595;
  const MARGIN = 44;
  const CW = PAGE_W - MARGIN * 2;
  let y = 0;

  function newPage() { pdf.addPage(); y = MARGIN; }
  function checkSpace(n) { if (y + n > 810) newPage(); }

  function drawRect(x, ry, w, h, r, fill) {
    pdf.setFillColor(...fill);
    pdf.roundedRect(x, ry, w, h, r, r, 'F');
  }

  function drawLine(x1, y1, x2, y2, color = [226, 232, 240], lw = 0.5) {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(lw);
    pdf.line(x1, y1, x2, y2);
  }

  function writeText(str, x, size, color, bold, maxW) {
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    if (maxW) {
      const lines = pdf.splitTextToSize(str, maxW);
      pdf.text(lines, x, y);
      return lines.length * (size * 1.42);
    }
    pdf.text(str, x, y);
    return size * 1.42;
  }

  const scores   = latest.scores || {};
  const answers  = latest.answers || {};
  const total    = latest.total || 0;
  const dateStr  = latest.date
    ? new Date(latest.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  // ─── Level helpers ───────────────────────────────────────────────────────
  const totalLevel  = total >= 240 ? 'Exemplary' : total >= 180 ? 'Strong' : total >= 120 ? 'Developing' : 'Emerging';
  const levelColor  = total >= 240 ? [13,148,136] : total >= 180 ? [37,99,235] : total >= 120 ? [217,119,6] : [220,38,38];

  // ─── Scored questions sorted ─────────────────────────────────────────────
  // We need QUESTIONS array — import-friendly: embed minimal info
  // (tools + text already available on the latest.answers keys, but we need
  //  question text + tools. We'll rely on the caller passing them via `latest.questions`.)
  const questions = latest.questions || [];
  const scoredQs  = questions
    .map(q => ({ ...q, score: answers[q.id] || 0 }))
    .sort((a, b) => b.score - a.score);
  const top5    = scoredQs.slice(0, 5);
  const bottom5 = [...scoredQs].sort((a, b) => a.score - b.score).slice(0, 5);

  // Recommended modules: collect from bottom 10 questions, rank by frequency
  const moduleCount = {};
  scoredQs.slice(-10).forEach(q => {
    extractModules(q.tools || '').forEach(m => {
      moduleCount[m.label] = (moduleCount[m.label] || { ...m, count: 0 });
      moduleCount[m.label].count += 1;
    });
  });
  const recommendedModules = Object.values(moduleCount).sort((a, b) => b.count - a.count).slice(0, 6);

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════════════════════════

  // Header band
  drawRect(0, 0, PAGE_W, 170, 0, [15, 32, 68]);

  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Leadership Accountability', MARGIN, 62);

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(153, 246, 228);
  pdf.text('Self-Assessment Report', MARGIN, 82);

  pdf.setFontSize(9.5);
  pdf.setTextColor(180, 210, 255);
  pdf.text(`Assessment Date: ${dateStr}`, MARGIN, 102);

  // Score pill
  drawRect(MARGIN, 122, 110, 30, 7, levelColor);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text(`Score: ${total} / 300`, MARGIN + 10, 141);

  drawRect(MARGIN + 120, 122, 90, 30, 7, [255, 255, 255, 30]);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text(`Level: ${totalLevel}`, MARGIN + 130, 141);

  // Person card
  y = 182;
  if (personName || personRole) {
    drawRect(MARGIN, y, CW, 48, 8, [255, 255, 255]);
    drawRect(MARGIN, y, 4, 48, 2, levelColor);
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 32, 68);
    pdf.text(personName || '', MARGIN + 14, y + 17);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(personRole || '', MARGIN + 14, y + 33);
    y += 62;
  } else {
    y = 200;
  }

  // ── Practice scores grid ──────────────────────────────────────────────────
  y += 10;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 32, 68);
  pdf.text('Leadership Practice Scores', MARGIN, y); y += 18;

  const colW = CW / CATEGORIES.length;
  CATEGORIES.forEach((cat, i) => {
    const s   = scores[cat.id] || 0;
    const pct = s / 60;
    const lbl = catScoreLabel(s);
    const bgC = lbl === 'Exemplary' ? [240,253,250] : lbl === 'Strong' ? [239,246,255] : lbl === 'Developing' ? [255,251,235] : [254,242,242];
    const tx  = cat.color;
    const cx  = MARGIN + i * colW;

    drawRect(cx + 3, y, colW - 6, 68, 7, bgC);

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...tx);
    const lines = pdf.splitTextToSize(cat.label, colW - 14);
    pdf.text(lines, cx + 8, y + 14);

    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...tx);
    pdf.text(String(s), cx + 8, y + 46);

    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(`/60  ${lbl}`, cx + 8, y + 59);

    // mini bar
    drawRect(cx + 3, y + 63, colW - 6, 5, 2, [226,232,240]);
    drawRect(cx + 3, y + 63, Math.max(4, (colW - 6) * pct), 5, 2, tx);
  });
  y += 82;

  // ── Intro paragraph ───────────────────────────────────────────────────────
  drawLine(MARGIN, y, MARGIN + CW, y);
  y += 14;
  pdf.setFontSize(9.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  const intro = `This report summarizes ${personName ? personName + "'s" : 'your'} self-assessment results across the five leadership practices of the Accountability Leadership Framework. It highlights demonstrated strengths, priority development opportunities, a tailored set of recommended app modules, and a personal development timeline for the next 12 months.`;
  const introLines = pdf.splitTextToSize(intro, CW);
  pdf.text(introLines, MARGIN, y);
  y += introLines.length * 13.5 + 10;

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — TOP 5 STRENGTHS & TOP 5 OPPORTUNITIES
  // ═══════════════════════════════════════════════════════════════════════════
  newPage();

  function sectionHeader(label, fillColor, textColor) {
    drawRect(MARGIN, y, CW, 26, 6, fillColor);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...textColor);
    pdf.text(label, MARGIN + 10, y + 17);
    y += 34;
  }

  function questionRow(q, rank, accentColor) {
    checkSpace(44);
    const cat = CATEGORIES.find(c => c.id === q.cat);
    const lbl = scoreLabel(q.score);

    drawRect(MARGIN, y, 22, 22, 4, accentColor);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(String(rank), MARGIN + (rank < 10 ? 7 : 4), y + 15);

    // score badge
    drawRect(MARGIN + CW - 36, y, 36, 22, 4, accentColor);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${q.score}/10`, MARGIN + CW - 32, y + 15);

    const textX = MARGIN + 28;
    const textW = CW - 72;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 32, 68);
    const qLines = pdf.splitTextToSize(q.text || '', textW);
    pdf.text(qLines, textX, y + 12);

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(cat ? cat.color[0] : 100, cat ? cat.color[1] : 116, cat ? cat.color[2] : 139);
    pdf.text(`${cat ? cat.label : ''} · ${lbl}`, textX, y + 12 + qLines.length * 11);

    y += Math.max(32, qLines.length * 11 + 20);
    drawLine(MARGIN + 28, y - 4, MARGIN + CW, y - 4, [241, 245, 249]);
  }

  sectionHeader('Top 5 Strengths — What You Do Well', [240, 253, 250], [21, 128, 61]);
  top5.forEach((q, i) => questionRow(q, i + 1, [22, 163, 74]));

  y += 14;
  checkSpace(40);
  sectionHeader('Top 5 Opportunities — Priority Development Areas', [254, 242, 242], [185, 28, 28]);
  bottom5.forEach((q, i) => questionRow(q, i + 1, [220, 38, 38]));

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 3 — TAILORED ACTION PLAN
  // ═══════════════════════════════════════════════════════════════════════════
  newPage();

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 32, 68);
  pdf.text('Tailored Action Plan', MARGIN, y); y += 8;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Recommended actions based on your lowest-scored behaviors', MARGIN, y); y += 20;
  drawLine(MARGIN, y, MARGIN + CW, y); y += 14;

  bottom5.forEach((q, i) => {
    checkSpace(80);
    const cat = CATEGORIES.find(c => c.id === q.cat);
    const lbl = scoreLabel(q.score);
    const guideKey = q.score >= 9 ? 'exemplary' : q.score >= 7 ? 'strong' : q.score >= 5 ? 'developing' : 'emerging';
    const guide    = q.guide || {};

    // Opportunity header row
    drawRect(MARGIN, y, CW, 22, 5, [248, 250, 252]);
    drawRect(MARGIN, y, 3, 22, 1, [220, 38, 38]);
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 32, 68);
    const headerLines = pdf.splitTextToSize(`${i + 1}. ${q.text || ''}`, CW - 80);
    pdf.text(headerLines, MARGIN + 10, y + 14);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...(cat ? cat.color : [100, 116, 139]));
    pdf.text(`${cat ? cat.label : ''}  ·  Score: ${q.score}/10  ·  ${lbl}`, MARGIN + CW - 145, y + 14);
    y += 26;

    // Current behavior description
    if (guide[guideKey]) {
      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(220, 38, 38);
      pdf.text('Current Behavior:', MARGIN + 6, y); y += 11;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      const descLines = pdf.splitTextToSize(guide[guideKey], CW - 10);
      pdf.text(descLines, MARGIN + 6, y);
      y += descLines.length * 11 + 6;
    }

    // Next level target
    const nextKey = guideKey === 'emerging' ? 'developing' : guideKey === 'developing' ? 'strong' : 'exemplary';
    if (guide[nextKey] && nextKey !== guideKey) {
      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(13, 148, 136);
      pdf.text('Target Behavior (next level):', MARGIN + 6, y); y += 11;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      const targetLines = pdf.splitTextToSize(guide[nextKey], CW - 10);
      pdf.text(targetLines, MARGIN + 6, y);
      y += targetLines.length * 11 + 6;
    }

    // Related tools
    if (q.tools) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Related App Tools: ${q.tools}`, MARGIN + 6, y);
      y += 12;
    }

    y += 8;
    drawLine(MARGIN, y, MARGIN + CW, y, [226, 232, 240]);
    y += 12;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 4 — RECOMMENDED MODULES + DEVELOPMENT TIMELINE
  // ═══════════════════════════════════════════════════════════════════════════
  newPage();

  // ── Recommended modules ──────────────────────────────────────────────────
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 32, 68);
  pdf.text('Your Personalized App Module Plan', MARGIN, y); y += 8;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Focus on these modules first — selected based on your opportunity areas', MARGIN, y); y += 18;
  drawLine(MARGIN, y, MARGIN + CW, y); y += 14;

  if (recommendedModules.length === 0) {
    pdf.setFontSize(9.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text('No specific modules recommended — all areas are strong.', MARGIN, y); y += 20;
  } else {
    const modColW = CW / 2;
    recommendedModules.forEach((mod, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      if (col === 0) { if (i > 0) y += 0; checkSpace(36); }
      const mx = MARGIN + col * modColW;
      const my = col === 0 ? y : y - (i % 2 === 1 ? 0 : 36);

      drawRect(mx + 2, my, modColW - 6, 30, 6, [239, 246, 255]);
      drawRect(mx + 2, my, 3, 30, 2, [37, 99, 235]);

      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 32, 68);
      pdf.text(mod.label, mx + 12, my + 12);

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Priority: #${i + 1}`, mx + 12, my + 24);

      if (col === 1 || i === recommendedModules.length - 1) y += 36;
    });
  }

  y += 16;

  // ── Development Timeline ──────────────────────────────────────────────────
  checkSpace(40);
  drawRect(MARGIN, y, CW, 26, 6, [15, 32, 68]);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('My Leadership Development Timeline', MARGIN + 10, y + 17);
  y += 34;

  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Fill in your personal commitments for each quarter below.', MARGIN, y);
  y += 18;

  const quarters = [
    { label: 'Q1 (Month 1–3)', subtitle: 'Foundation — establish key habits & start priority modules' },
    { label: 'Q2 (Month 4–6)', subtitle: 'Momentum — deepen practice, measure early progress'        },
    { label: 'Q3 (Month 7–9)', subtitle: 'Stretch — take on harder challenges, involve others'         },
    { label: 'Q4 (Month 10–12)', subtitle: 'Mastery — reflect, retake assessment, set next-year goals' },
  ];

  const lineFields = [
    'Focus area / module:',
    'Specific action I will take:',
    'How I will measure success:',
    'Support I need:',
  ];

  quarters.forEach(q => {
    checkSpace(120);

    // Quarter header
    drawRect(MARGIN, y, CW, 22, 5, [239, 246, 255]);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 32, 68);
    pdf.text(q.label, MARGIN + 10, y + 15);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(q.subtitle, MARGIN + 10 + pdf.getTextWidth(q.label) + 10, y + 15);
    y += 28;

    lineFields.forEach(field => {
      checkSpace(28);
      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(71, 85, 105);
      pdf.text(field, MARGIN + 4, y);
      y += 14;
      drawLine(MARGIN + 4, y, MARGIN + CW - 4, y, [203, 213, 225], 0.8);
      y += 14;
    });

    y += 8;
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  checkSpace(30);
  drawLine(MARGIN, y, MARGIN + CW, y);
  y += 12;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(148, 163, 184);
  pdf.text('Accountability Leadership App  ·  Leadership Self-Assessment Report', MARGIN, y);
  pdf.text(dateStr, MARGIN + CW - pdf.getTextWidth(dateStr), y);

  pdf.save(`Leadership_Assessment_${personName.replace(/\s+/g, '_') || 'Report'}.pdf`);
}
