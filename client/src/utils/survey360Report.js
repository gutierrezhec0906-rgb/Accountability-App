import { jsPDF } from 'jspdf';
import { QUESTIONS } from './assessmentQuestions';

const CATEGORIES = [
  { id: 'model',     label: 'Model the Way',           color: [37,  99, 235] },
  { id: 'inspire',   label: 'Inspire a Shared Vision', color: [13, 148, 136] },
  { id: 'challenge', label: 'Challenge the Process',   color: [217,119,   6] },
  { id: 'enable',    label: 'Enable Others to Act',    color: [124, 58, 237] },
  { id: 'encourage', label: 'Encourage the Heart',     color: [225, 29,  72] },
];

const REL_COLORS = {
  'Peer':                    [37,  99, 235],
  'Direct Report':           [13, 148, 136],
  'Manager':                 [124, 58, 237],
  'Cross-functional Partner':[217,119,   6],
  'Other':                   [148,163, 184],
};

function scoreLabel(v) {
  if (v >= 9) return 'Exemplary';
  if (v >= 7) return 'Strong';
  if (v >= 5) return 'Developing';
  return 'Emerging';
}

function levelColor(lbl) {
  if (lbl === 'Exemplary') return [124, 58, 237];
  if (lbl === 'Strong')    return [ 13,148, 136];
  if (lbl === 'Developing')return [217,119,   6];
  return [220, 38, 38];
}

// Peer-framed question texts (match Survey360.jsx)
const PEER_TEXTS = {
  1:  'This person sets a personal example of what they expect of others.',
  2:  'This person talks about future trends that will influence how our work gets done.',
  3:  'This person seeks out challenging opportunities that test their own skills.',
  4:  'This person develops cooperative relationships among the people they work with.',
  5:  'This person praises people for a job well done.',
  6:  'This person ensures that people adhere to the principles and standards the team has agreed on.',
  7:  'This person describes a compelling image of what our future could look like.',
  8:  'This person challenges people to try out new and innovative ways to do their work.',
  9:  'This person actively listens to diverse points of view.',
  10: 'This person makes it a point to let people know about their confidence in them.',
  11: 'This person follows through on the promises and commitments they make.',
  12: 'This person appeals to others to share an exciting dream of the future.',
  13: 'This person searches outside the organization for innovative ways to improve what we do.',
  14: 'This person treats others with dignity and respect.',
  15: 'This person makes sure that people are creatively rewarded for their contributions.',
  16: 'This person asks for feedback on how their actions affect others.',
  17: 'This person shows others how their long-term interests can be realized by enlisting in a common vision.',
  18: "This person asks \"What can we learn?\" when things don't go as expected.",
  19: 'This person supports the decisions that people make on their own.',
  20: 'This person publicly recognizes people who show commitment to shared values.',
  21: 'This person builds consensus around a common set of values for running the team.',
  22: 'This person paints the "big picture" of what the team aspires to accomplish.',
  23: 'This person makes certain that we set achievable goals, make concrete plans, and establish measurable milestones.',
  24: 'This person gives people a great deal of freedom and choice in deciding how to do their work.',
  25: 'This person finds ways to celebrate accomplishments.',
  26: 'This person is clear about their philosophy of leadership.',
  27: 'This person speaks with genuine conviction about the higher meaning and purpose of our work.',
  28: 'This person experiments and takes risks, even when there is a chance of failure.',
  29: 'This person ensures that people grow in their jobs by learning new skills and developing themselves.',
  30: 'This person gives the team members lots of appreciation and support for their contributions.',
};

export function generate360Report(surveyData, selfLatest = null) {
  const { leaderName = '', leaderRole = '', responses = [] } = surveyData;
  const pdf    = new jsPDF({ unit: 'pt', format: 'a4' });
  const PAGE_W = 595;
  const MARGIN = 44;
  const CW     = PAGE_W - MARGIN * 2;
  let y        = 0;

  function newPage()      { pdf.addPage(); y = MARGIN; }
  function checkSpace(n)  { if (y + n > 815) newPage(); }

  function drawRect(x, ry, w, h, r, fill) {
    pdf.setFillColor(...fill);
    pdf.roundedRect(x, ry, w, h, r, r, 'F');
  }
  function drawLine(x1, y1, x2, y2, color = [226,232,240], lw = 0.5) {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(lw);
    pdf.line(x1, y1, x2, y2);
  }

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ── Compute averages ───────────────────────────────────────────────────────
  // Per-category average (out of 60)
  const catAvg = {};
  CATEGORIES.forEach(c => {
    const vals = responses.map(r => r.scores?.[c.id] || 0);
    catAvg[c.id] = vals.length ? Math.round((vals.reduce((a,b)=>a+b,0) / vals.length) * 10) / 10 : 0;
  });
  const peerTotal = Math.round(Object.values(catAvg).reduce((a,b)=>a+b,0));

  // Per-question average (out of 10)
  const qAvg = {};
  QUESTIONS.forEach(q => {
    const vals = responses.map(r => r.answers?.[q.id] || 0).filter(v => v > 0);
    qAvg[q.id] = vals.length ? Math.round((vals.reduce((a,b)=>a+b,0) / vals.length) * 10) / 10 : 0;
  });

  // Sorted questions for strengths / opportunities
  const scoredQs = QUESTIONS.map(q => ({ ...q, score: qAvg[q.id] || 0, text: PEER_TEXTS[q.id] || q.text }))
    .sort((a,b) => b.score - a.score);
  const top5    = scoredQs.slice(0, 5);
  const bottom5 = [...scoredQs].sort((a,b) => a.score - b.score).slice(0, 5);

  // Respondent breakdown by relationship
  const relGroups = {};
  responses.forEach(r => {
    const rel = r.relationship || 'Other';
    if (!relGroups[rel]) relGroups[rel] = [];
    relGroups[rel].push(r);
  });

  const selfScores = selfLatest?.scores || null;
  const selfTotal  = selfLatest?.total  || null;

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════════════════════════
  drawRect(0, 0, PAGE_W, 170, 0, [15, 32, 68]);

  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255,255,255);
  pdf.text('360° Peer Feedback Report', MARGIN, 58);

  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(153,246,228);
  pdf.text('Accountability Practice Inventory', MARGIN, 78);

  pdf.setFontSize(9.5);
  pdf.setTextColor(180,210,255);
  pdf.text(`Generated: ${dateStr}  ·  ${responses.length} respondent${responses.length !== 1 ? 's' : ''}`, MARGIN, 98);

  // Score pill
  const totalLbl = peerTotal >= 240 ? 'Exemplary' : peerTotal >= 180 ? 'Strong' : peerTotal >= 120 ? 'Developing' : 'Emerging';
  const totalClr = peerTotal >= 240 ? [124,58,237] : peerTotal >= 180 ? [13,148,136] : peerTotal >= 120 ? [217,119,6] : [220,38,38];
  drawRect(MARGIN, 118, 130, 30, 7, totalClr);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255,255,255);
  pdf.text(`Peer Avg: ${peerTotal}/300`, MARGIN + 10, 137);

  if (selfTotal) {
    drawRect(MARGIN + 140, 118, 120, 30, 7, [255,255,255,30]);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255,255,255);
    pdf.text(`Self: ${selfTotal}/300`, MARGIN + 150, 137);
  }

  // Leader card
  y = 182;
  drawRect(MARGIN, y, CW, 48, 8, [255,255,255]);
  drawRect(MARGIN, y, 4, 48, 2, totalClr);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15,32,68);
  pdf.text(leaderName || 'Leader', MARGIN + 14, y + 17);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100,116,139);
  pdf.text(leaderRole || '', MARGIN + 14, y + 33);
  y += 60;

  // ── Practice scores grid ──────────────────────────────────────────────────
  y += 10;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15,32,68);
  pdf.text('Peer Average by Practice', MARGIN, y); y += 16;

  const colW = CW / CATEGORIES.length;
  CATEGORIES.forEach((cat, i) => {
    const s   = catAvg[cat.id] || 0;
    const lbl = scoreLabel(s / 6);
    const lc  = levelColor(lbl);
    const bgC = lbl === 'Exemplary' ? [240,253,250] : lbl === 'Strong' ? [239,246,255] : lbl === 'Developing' ? [255,251,235] : [254,242,242];
    const cx  = MARGIN + i * colW;

    drawRect(cx + 3, y, colW - 6, 72, 7, bgC);
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...cat.color);
    const lblLines = pdf.splitTextToSize(cat.label, colW - 12);
    pdf.text(lblLines, cx + 8, y + 13);
    pdf.setFontSize(19);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...lc);
    pdf.text(String(s), cx + 8, y + 46);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100,116,139);
    pdf.text(`/60  ${lbl}`, cx + 8, y + 58);

    // self comparison line
    if (selfScores) {
      const selfS = selfScores[cat.id] || 0;
      pdf.setFontSize(6.5);
      pdf.setTextColor(100,116,139);
      pdf.text(`Self: ${selfS}`, cx + 8, y + 68);
    }

    // mini bar (peer)
    drawRect(cx + 3, y + 70, colW - 6, 4, 2, [226,232,240]);
    drawRect(cx + 3, y + 70, Math.max(4, (colW - 6) * (s / 60)), 4, 2, lc);
  });
  y += 90;

  // ── Radar chart ───────────────────────────────────────────────────────────
  drawLine(MARGIN, y, MARGIN + CW, y); y += 12;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15,32,68);
  pdf.text('Practice Profile', PAGE_W / 2, y, { align: 'center' }); y += 12;
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100,116,139);
  pdf.text('Peer average per practice  (out of 60)', PAGE_W / 2, y, { align: 'center' }); y += 16;

  const radarR  = 80;
  const radarCX = PAGE_W / 2;
  const radarCY = y + radarR + 28;
  const n   = CATEGORIES.length;
  const ang = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt  = (i, frac) => ({ x: radarCX + radarR * frac * Math.cos(ang(i)), y: radarCY + radarR * frac * Math.sin(ang(i)) });

  // Rings
  [0.2,0.4,0.6,0.8,1.0].forEach(frac => {
    const pts = CATEGORIES.map((_, i) => pt(i, frac));
    pdf.setDrawColor(220,232,240); pdf.setLineWidth(0.5);
    pts.forEach((p, i) => { const nx = pts[(i+1)%n]; pdf.line(p.x, p.y, nx.x, nx.y); });
  });
  [20,40,60].forEach(v => { pdf.setFontSize(6); pdf.setTextColor(190,200,215); pdf.text(String(v), radarCX+3, radarCY - radarR*(v/60)+3); });
  CATEGORIES.forEach((_, i) => { const o = pt(i,1); pdf.setDrawColor(210,220,235); pdf.setLineWidth(0.5); pdf.line(radarCX, radarCY, o.x, o.y); });

  // Peer data polygon
  const peerPts = CATEGORIES.map((c,i) => pt(i, (catAvg[c.id]||0)/60));
  pdf.setFillColor(179,235,227); pdf.setDrawColor(13,148,136); pdf.setLineWidth(1.8);
  pdf.lines(peerPts.map((p,i)=>{ const nx=peerPts[(i+1)%n]; return [nx.x-p.x, nx.y-p.y]; }), peerPts[0].x, peerPts[0].y, [1,1], 'FD', true);

  // Self polygon overlay (if available)
  if (selfScores) {
    const selfPts = CATEGORIES.map((c,i) => pt(i, (selfScores[c.id]||0)/60));
    pdf.setFillColor(37,99,235,60); pdf.setDrawColor(37,99,235); pdf.setLineWidth(1.2);
    pdf.lines(selfPts.map((p,i)=>{ const nx=selfPts[(i+1)%n]; return [nx.x-p.x, nx.y-p.y]; }), selfPts[0].x, selfPts[0].y, [1,1], 'D', true);
    selfPts.forEach(p => { pdf.setFillColor(37,99,235); pdf.circle(p.x, p.y, 2.5, 'F'); });
  }

  // Dots
  peerPts.forEach((p,i) => { pdf.setFillColor(...CATEGORIES[i].color); pdf.circle(p.x, p.y, 3.5, 'F'); pdf.setFillColor(255,255,255); pdf.circle(p.x, p.y, 1.5, 'F'); });

  // Labels
  CATEGORIES.forEach((cat,i) => {
    const lp = pt(i, 1.28);
    const words = cat.label.split(' ');
    const lblLines = [];
    for (let w = 0; w < words.length; w += 2) lblLines.push(words.slice(w, w+2).join(' '));
    pdf.setFontSize(7.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(...cat.color);
    const lineH = 9; const startY = lp.y - ((lblLines.length-1)*lineH)/2;
    lblLines.forEach((ln,li) => pdf.text(ln, lp.x, startY+li*lineH, { align:'center' }));
  });

  // Legend
  const legendY = radarCY + radarR + 44;
  if (selfScores) {
    pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(71,85,105);
    pdf.setFillColor(13,148,136); pdf.rect(MARGIN, legendY-6, 10, 6, 'F');
    pdf.text('Peer average', MARGIN+14, legendY);
    pdf.setDrawColor(37,99,235); pdf.setLineWidth(1.2); pdf.line(MARGIN+90, legendY-3, MARGIN+100, legendY-3);
    pdf.text('Your self-score', MARGIN+104, legendY);
  }

  y = legendY + 20;

  // ── Respondent breakdown ──────────────────────────────────────────────────
  drawLine(MARGIN, y, MARGIN+CW, y); y += 12;
  pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(15,32,68);
  pdf.text('Respondents', MARGIN, y); y += 14;

  const relColW = CW / Math.min(Object.keys(relGroups).length || 1, 5);
  let rx = MARGIN;
  Object.entries(relGroups).forEach(([rel, rList]) => {
    const rc = REL_COLORS[rel] || [148,163,184];
    drawRect(rx, y, relColW - 6, 36, 7, [248,250,252]);
    drawRect(rx, y, 3, 36, 2, rc);
    pdf.setFontSize(16); pdf.setFont('helvetica','bold'); pdf.setTextColor(...rc);
    pdf.text(String(rList.length), rx+10, y+22);
    pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(100,116,139);
    const rl = pdf.splitTextToSize(rel, relColW-20);
    pdf.text(rl, rx+10, y+32);
    rx += relColW;
  });
  y += 52;

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — TOP 5 STRENGTHS + TOP 5 OPPORTUNITIES
  // ═══════════════════════════════════════════════════════════════════════════
  newPage();

  function sectionHeader(label, fillColor, textColor) {
    drawRect(MARGIN, y, CW, 26, 6, fillColor);
    pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(...textColor);
    pdf.text(label, MARGIN+10, y+17); y += 34;
  }

  function qRow(q, rank, accentColor) {
    checkSpace(52);
    const cat = CATEGORIES.find(c => c.id === q.cat);
    const lbl = scoreLabel(q.score);
    drawRect(MARGIN, y, 22, 22, 4, accentColor);
    pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
    pdf.text(String(rank), MARGIN+(rank<10?7:4), y+15);
    drawRect(MARGIN+CW-44, y, 44, 22, 4, accentColor);
    pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
    pdf.text(`${q.score}/10`, MARGIN+CW-40, y+10);
    pdf.setFontSize(7); pdf.text(lbl, MARGIN+CW-40, y+19);
    const textW = CW-72;
    pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(15,32,68);
    const qLines = pdf.splitTextToSize(q.text||'', textW);
    pdf.text(qLines, MARGIN+28, y+14);
    pdf.setFontSize(8); pdf.setFont('helvetica','normal');
    pdf.setTextColor(cat?cat.color[0]:100, cat?cat.color[1]:116, cat?cat.color[2]:139);
    pdf.text(`${cat?cat.label:''} · ${lbl}`, MARGIN+28, y+14+qLines.length*11);
    y += Math.max(34, qLines.length*11+22);
    drawLine(MARGIN+28, y-4, MARGIN+CW, y-4, [241,245,249]);
  }

  sectionHeader('Top 5 Peer-Rated Strengths', [240,253,250], [21,128,61]);
  top5.forEach((q,i) => qRow(q, i+1, [22,163,74]));
  y += 14;
  sectionHeader('Top 5 Peer-Rated Opportunities', [254,242,242], [185,28,28]);
  bottom5.forEach((q,i) => qRow(q, i+1, [220,38,38]));

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGES 3+ — DETAILED QUESTION BREAKDOWN BY PRACTICE
  // ═══════════════════════════════════════════════════════════════════════════
  newPage();

  pdf.setFontSize(14); pdf.setFont('helvetica','bold'); pdf.setTextColor(15,32,68);
  pdf.text('Detailed Question Breakdown — Peer View', MARGIN, y); y += 8;
  pdf.setFontSize(9); pdf.setFont('helvetica','normal'); pdf.setTextColor(100,116,139);
  pdf.text('Average peer score per behavior · guide shows what improvement looks like', MARGIN, y); y += 18;
  drawLine(MARGIN, y, MARGIN+CW, y); y += 14;

  const sharedGuides = Object.fromEntries(QUESTIONS.map(q => [q.id, q.guide || {}]));

  CATEGORIES.forEach(cat => {
    checkSpace(50);
    drawRect(MARGIN, y, CW, 28, 6, cat.color);
    pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
    pdf.text(cat.label, MARGIN+10, y+19);
    const cs = catAvg[cat.id] || 0;
    pdf.setFontSize(9); pdf.setFont('helvetica','normal'); pdf.setTextColor(255,255,255);
    pdf.text(`Peer avg: ${cs}/60  ·  ${scoreLabel(cs/6)}`, MARGIN+CW-130, y+19);
    y += 36;

    const catQs = QUESTIONS.filter(q => q.cat === cat.id);
    catQs.forEach(q => {
      const avg = qAvg[q.id] || 0;
      const lbl = scoreLabel(avg);
      const lc  = levelColor(lbl);
      const guide   = sharedGuides[q.id];
      const guideKey = avg >= 9 ? 'exemplary' : avg >= 7 ? 'strong' : avg >= 5 ? 'developing' : 'emerging';
      const nextKey  = guideKey === 'emerging' ? 'developing' : guideKey === 'developing' ? 'strong' : 'exemplary';

      const qText    = PEER_TEXTS[q.id] || q.text || '';
      const qLines   = pdf.splitTextToSize(qText, CW-56);
      const curLines = guide[guideKey] ? pdf.splitTextToSize(guide[guideKey], CW-14) : [];
      const tgtLines = (guide[nextKey] && nextKey !== guideKey) ? pdf.splitTextToSize(guide[nextKey], CW-14) : [];
      const blockH   = qLines.length*11 + curLines.length*10 + tgtLines.length*10 + (curLines.length?24:0) + (tgtLines.length?20:0) + 22;
      checkSpace(blockH+8);

      // Self comparison hint
      const selfQ = selfLatest?.answers?.[q.id];

      // Number badge
      drawRect(MARGIN, y, 22, 22, 4, cat.color);
      pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
      pdf.text(String(q.id), MARGIN+(q.id<10?7:4), y+15);

      // Score badge — shows peer avg and optionally self score
      drawRect(MARGIN+CW-56, y, 56, 22, 4, lc);
      pdf.setFontSize(8.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
      pdf.text(`Avg ${avg}/10`, MARGIN+CW-52, y+10);
      if (selfQ) {
        pdf.setFontSize(7); pdf.text(`Self ${selfQ}/10`, MARGIN+CW-52, y+19);
      } else {
        pdf.setFontSize(7); pdf.text(lbl, MARGIN+CW-52, y+19);
      }

      pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(15,32,68);
      pdf.text(qLines, MARGIN+28, y+14);
      // Advance enough to clear both the 22pt badge and the question text
      y += Math.max(28, qLines.length*11+10);

      if (curLines.length) {
        pdf.setFontSize(7.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(...lc);
        pdf.text(`Peer sees (${lbl}):`, MARGIN+28, y); y += 10;
        pdf.setFont('helvetica','normal'); pdf.setTextColor(71,85,105);
        pdf.text(curLines, MARGIN+28, y); y += curLines.length*10+4;
      }

      if (tgtLines.length) {
        const nextLbl = nextKey.charAt(0).toUpperCase()+nextKey.slice(1);
        pdf.setFontSize(7.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(13,148,136);
        pdf.text(`To reach ${nextLbl}:`, MARGIN+28, y); y += 10;
        pdf.setFont('helvetica','normal'); pdf.setTextColor(71,85,105);
        pdf.text(tgtLines, MARGIN+28, y); y += tgtLines.length*10+4;
      }

      drawLine(MARGIN, y+4, MARGIN+CW, y+4, [241,245,249]);
      y += 14;
    });
    y += 6;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN-ENDED RESPONSES PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  newPage();

  pdf.setFontSize(14); pdf.setFont('helvetica','bold'); pdf.setTextColor(15,32,68);
  pdf.text('Open-Ended Feedback', MARGIN, y); y += 8;
  pdf.setFontSize(9); pdf.setFont('helvetica','normal'); pdf.setTextColor(100,116,139);
  pdf.text('Written responses from all respondents, grouped by question', MARGIN, y); y += 18;
  drawLine(MARGIN, y, MARGIN+CW, y); y += 14;

  const OPEN_QS = [
    { id: 'leaderStop',     section: 'As a Leader', label: 'What should this person STOP doing?'     },
    { id: 'leaderStart',    section: 'As a Leader', label: 'What should this person START doing?'    },
    { id: 'leaderContinue', section: 'As a Leader', label: 'What should this person CONTINUE doing?' },
    { id: 'teamStop',       section: 'As a Team',   label: 'What should the team STOP doing?'        },
    { id: 'teamStart',      section: 'As a Team',   label: 'What should the team START doing?'       },
    { id: 'teamContinue',   section: 'As a Team',   label: 'What should the team CONTINUE doing?'    },
    { id: 'additionalComments', section: 'Additional', label: 'Additional comments'                  },
  ];

  const sectionColors = { 'As a Leader': [37,99,235], 'As a Team': [13,148,136], 'Additional': [124,58,237] };
  let lastSection = '';

  OPEN_QS.forEach(oq => {
    const answers = responses
      .map(r => (r.openAnswers || {})[oq.id])
      .filter(a => a && a.trim());
    if (!answers.length) return;

    // Section header
    if (oq.section !== lastSection) {
      checkSpace(30);
      const sc = sectionColors[oq.section] || [100,116,139];
      drawRect(MARGIN, y, CW, 22, 5, sc);
      pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
      pdf.text(oq.section, MARGIN+10, y+15); y += 30;
      lastSection = oq.section;
    }

    checkSpace(28);
    pdf.setFontSize(9.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(15,32,68);
    pdf.text(oq.label, MARGIN, y); y += 14;

    answers.forEach((ans, ai) => {
      const lines = pdf.splitTextToSize(`"${ans}"`, CW - 20);
      checkSpace(lines.length * 11 + 12);
      drawRect(MARGIN, y-2, CW, lines.length*11+10, 5, [248,250,252]);
      drawRect(MARGIN, y-2, 3, lines.length*11+10, 2, [203,213,225]);
      pdf.setFontSize(9); pdf.setFont('helvetica','normal'); pdf.setTextColor(51,65,85);
      pdf.text(lines, MARGIN+10, y+8);
      y += lines.length*11+14;
    });
    y += 6;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LAST PAGE — INDIVIDUAL RESPONDENT SCORES
  // ═══════════════════════════════════════════════════════════════════════════
  newPage();

  pdf.setFontSize(14); pdf.setFont('helvetica','bold'); pdf.setTextColor(15,32,68);
  pdf.text('Individual Respondent Scores', MARGIN, y); y += 8;
  pdf.setFontSize(9); pdf.setFont('helvetica','normal'); pdf.setTextColor(100,116,139);
  pdf.text('Score per practice and total for each respondent', MARGIN, y); y += 18;
  drawLine(MARGIN, y, MARGIN+CW, y); y += 10;

  // Table header
  const cols = ['Name', 'Relationship', ...CATEGORIES.map(c => c.label.split(' ')[0]), 'Total'];
  const colWidths = [100, 120, ...CATEGORIES.map(() => (CW-240)/CATEGORIES.length), 48];
  let hx = MARGIN;
  cols.forEach((col, ci) => {
    pdf.setFontSize(7.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(100,116,139);
    pdf.text(col, hx+4, y);
    hx += colWidths[ci];
  });
  y += 14;
  drawLine(MARGIN, y-4, MARGIN+CW, y-4, [203,213,225], 0.8);

  responses.forEach((r, ri) => {
    checkSpace(22);
    const total = Object.values(r.scores||{}).reduce((a,b)=>a+b,0);
    const rc = REL_COLORS[r.relationship] || [148,163,184];
    if (ri%2===0) drawRect(MARGIN, y-10, CW, 18, 0, [248,250,252]);
    let rx2 = MARGIN;

    pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(15,32,68);
    pdf.text(r.name||'Anonymous', rx2+4, y); rx2 += colWidths[0];

    pdf.setFont('helvetica','normal'); pdf.setTextColor(...rc);
    pdf.text(r.relationship||'', rx2+4, y); rx2 += colWidths[1];

    CATEGORIES.forEach((cat, ci) => {
      const s = r.scores?.[cat.id] || 0;
      pdf.setFont('helvetica','bold'); pdf.setTextColor(...cat.color);
      pdf.text(String(s), rx2+4, y); rx2 += colWidths[2+ci];
    });

    pdf.setFont('helvetica','bold'); pdf.setTextColor(15,32,68);
    pdf.text(String(total), rx2+4, y);
    y += 18;
  });

  // Peer avg row
  y += 4;
  drawRect(MARGIN, y-10, CW, 18, 0, [15,32,68]);
  let ax = MARGIN;
  pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
  pdf.text('Peer Average', ax+4, y); ax += colWidths[0];
  pdf.text(`${responses.length} respondents`, ax+4, y); ax += colWidths[1];
  CATEGORIES.forEach((cat,ci) => {
    pdf.text(String(catAvg[cat.id]||0), ax+4, y); ax += colWidths[2+ci];
  });
  pdf.text(String(peerTotal), ax+4, y);
  y += 28;

  if (selfScores && selfTotal) {
    drawRect(MARGIN, y-10, CW, 18, 0, [37,99,235]);
    let sx = MARGIN;
    pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
    pdf.text('Your Self-Score', sx+4, y); sx += colWidths[0];
    pdf.text('(comparison)', sx+4, y); sx += colWidths[1];
    CATEGORIES.forEach((cat,ci) => {
      pdf.text(String(selfScores[cat.id]||0), sx+4, y); sx += colWidths[2+ci];
    });
    pdf.text(String(selfTotal), sx+4, y);
  }

  // Footer
  checkSpace(30);
  drawLine(MARGIN, y+20, MARGIN+CW, y+20);
  pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(148,163,184);
  pdf.text(`Accountability Leadership App  ·  360° Peer Feedback Report  ·  ${leaderName}`, MARGIN, y+32);
  pdf.text(dateStr, MARGIN+CW - pdf.getTextWidth(dateStr), y+32);

  const filename = `360_Feedback_${(leaderName||'Report').replace(/\s+/g,'_')}.pdf`;
  pdf.save(filename);
}
