import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { newDoc, C } from './pdfKit';
import { localDateStr, toolKeyFromLabel, TOOL_WEIGHTS } from './scoring';

// The 17 practice tools (keys match the route path stored in toolSessions.tool).
export const REPORT_TOOLS = [
  { key: 'visual-board',    label: 'The Accountability Board', icon: '🔴' },
  { key: 'lob',             label: 'Line of Balance',   icon: '📈' },
  { key: 'urgency',         label: 'Sense of Urgency',  icon: '⚡' },
  { key: 'eq-opex',         label: 'EQ & OpEx Tools',   icon: '💡' },
  { key: 'vision',          label: 'Vision Builder',    icon: '🔭' },
  { key: 'smart-goals',     label: 'SMART Goals',       icon: '🎯' },
  { key: 'mindfulness',     label: 'Mindfulness',       icon: '🧘' },
  { key: 'lean',            label: 'Lean Toolkit',      icon: '🏭' },
  { key: 'problem-solving', label: 'Problem Solving',   icon: '🔍' },
  { key: 'disc',            label: 'DISC Assessment',   icon: '🧠' },
  { key: 'skills',          label: 'Skills Development', icon: '⭐' },
  { key: 'training',        label: 'Training Center',   icon: '🎓' },
  { key: 'mentoring',       label: 'Mentoring Tracker', icon: '🫂' },
  { key: 'career',          label: 'Career Development', icon: '🚀' },
  { key: 'feedback',        label: 'Feedback Box',      icon: '📬' },
  { key: 'coaching',        label: 'Coaching Log',      icon: '📝' },
  { key: 'quotes',          label: 'Leadership Quotes', icon: '💬' },
];
export const TOTAL_TOOLS = REPORT_TOOLS.length;
const TOOL_LABEL = Object.fromEntries(REPORT_TOOLS.map(t => [t.key, t]));

// toolKeyFromLabel is imported from scoring.js — single source of truth so the
// score, this report, and the server-side email never drift out of sync again.

// Short, executive-tone note per action status — Red and Yellow only get a
// written note in the report; Green is summarized as a count, no prose.
function actionNote(status) {
  if (status === 'Red')
    return { color: C.red, text: 'Recommit now — set a firm new date today and close the loop.' };
  if (status === 'Yellow')
    return { color: C.amber, text: 'Due soon — confirm resources and clear blockers to protect this date.' };
  return { color: C.green, text: '' };
}

function statusOf(item) {
  const active = item.recommitmentDate || item.dueDate;
  if (!active) return 'Green';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(active + 'T00:00:00') - today) / 86400000);
  if (days < 0) return 'Red';
  if (days <= 5) return 'Yellow';
  return 'Green';
}
function weekMondayStr(d = new Date()) {
  const x = new Date(d); const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return localDateStr(x);
}

// Gather + compute the full weekly report for a user, and persist this week's
// snapshot into users/{uid}.weeklyReports so future reports can analyze trends.
export async function fetchWeeklyReportData(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.exists() ? snap.data() : {};
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekAgoStr = localDateStr(new Date(weekAgo));

  // Tool usage — combine TWO signals so it's accurate even if one is empty:
  //   1) the toolSessions array on the user doc (page visits, 10s+)
  //   2) pointEvents mapped to tools (activity that earned points)
  let usedThisWeek = new Set(), usedEver = new Set();
  (data.toolSessions || []).forEach(s => {
    if (!TOOL_LABEL[s.tool]) return;
    usedEver.add(s.tool);
    if ((s.openedAt || 0) >= weekAgo) usedThisWeek.add(s.tool);
  });

  const allEvents = data.pointEvents || [];
  allEvents.forEach(e => {
    const key = toolKeyFromLabel(e.toolLabel || '');
    if (!key || !TOOL_LABEL[key]) return;
    usedEver.add(key);
    if ((e.date || '') >= weekAgoStr) usedThisWeek.add(key);
  });

  const events = allEvents.filter(e => (e.date || '') >= weekAgoStr);
  const weekPoints = events.filter(e => e.points > 0).reduce((s, e) => s + e.points, 0);
  const score = data.calculatedScore || 0;

  const diversityPct = Math.round((usedThisWeek.size / TOTAL_TOOLS) * 100);
  const everPct = Math.round((usedEver.size / TOTAL_TOOLS) * 100);

  // Open actions with status + note (the user's own visualBoard)
  const actions = (data.visualBoard || []).filter(a => !a.closed).map(a => {
    const st = statusOf(a);
    return { title: a.title || 'Untitled', owner: a.owner || '', dueDate: a.recommitmentDate || a.dueDate || '', notes: a.notes || '', status: st, note: actionNote(st) };
  }).sort((a, b) => ({ Red: 0, Yellow: 1, Green: 2 }[a.status] - { Red: 0, Yellow: 1, Green: 2 }[b.status]));

  // Persist this week's snapshot (replace same week), keep last 26 weeks
  const weekOf = weekMondayStr();
  const history = (data.weeklyReports || []).filter(h => h.weekOf !== weekOf);
  const snapshot = { weekOf, usedKeys: [...usedThisWeek], diversityPct, points: weekPoints, score };
  const newHistory = [snapshot, ...history].slice(0, 26);
  try { await setDoc(doc(db, 'users', uid), { weeklyReports: newHistory }, { merge: true }); } catch {}

  // Trend windows for recommendations: "not this week" vs. the more urgent
  // "not touched in 2-3 weeks" (includes this week + the 2 prior recorded weeks).
  const last3 = newHistory.slice(0, 3);
  const usedInLast3 = new Set(last3.flatMap(h => h.usedKeys || []));
  const notUsedIn3Weeks = REPORT_TOOLS.filter(t => !usedInLast3.has(t.key));

  const last4 = newHistory.slice(0, 4);
  const avgDiversity = last4.length ? Math.round(last4.reduce((s, h) => s + (h.diversityPct || 0), 0) / last4.length) : diversityPct;

  const usedThisWeekTools = REPORT_TOOLS.filter(t => usedThisWeek.has(t.key));
  // Highest-value tools actually used this week, for the closing "keep it up" note.
  const topUsedThisWeek = [...usedThisWeekTools]
    .sort((a, b) => (TOOL_WEIGHTS[b.key] || 0) - (TOOL_WEIGHTS[a.key] || 0))
    .slice(0, 3);

  const redActions = actions.filter(a => a.status === 'Red');
  const yellowActions = actions.filter(a => a.status === 'Yellow');
  const greenCount = actions.filter(a => a.status === 'Green').length;

  return {
    name: (data.displayName || '').split(' ')[0] || 'Leader',
    weekPoints, score, diversityPct, everPct,
    usedThisWeek: usedThisWeekTools,
    notUsedThisWeek: REPORT_TOOLS.filter(t => !usedThisWeek.has(t.key)),
    notUsedIn3Weeks,
    topUsedThisWeek,
    events, actions, redActions, yellowActions, greenCount,
    weeksTracked: newHistory.length, avgDiversity,
  };
}

export async function generateWeeklyReportPDF(uid) {
  const r = await fetchWeeklyReportData(uid);
  const k = newDoc();
  const { pdf, MARGIN, CW } = k;

  const today = new Date();
  const weekStart = new Date(today.getTime() - 6 * 86400000);
  const range = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  k.titleBand('Weekly Accountability Report', `${r.name} · ${range}`);

  // Summary tiles
  const tiles = [
    { label: 'Points This Week', value: r.weekPoints, color: C.teal },
    { label: 'Accountability Score', value: `${r.score}/100`, color: C.navy },
    { label: 'Tool Diversity', value: `${r.diversityPct}%`, color: C.purple },
  ];
  const tw = (CW - 20) / 3;
  tiles.forEach((t, i) => {
    const x = MARGIN + i * (tw + 10);
    pdf.setFillColor(...C.light); pdf.roundedRect(x, k.y, tw, 54, 6, 6, 'F');
    pdf.setFontSize(22); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...t.color);
    pdf.text(String(t.value), x + 12, k.y + 28);
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
    pdf.text(k.safe(t.label.toUpperCase()), x + 12, k.y + 44);
  });
  k.y += 72;

  // ── Action Status Summary: 3 tiles (Red / Yellow / Green counts only) ──
  // Status indicators are drawn as filled circles, NOT emoji glyphs — jsPDF's
  // built-in Helvetica font has no emoji support and renders them as garbled
  // mojibake (e.g. "Ø=Ý4") in the PDF.
  k.sectionHeader('Action Status Summary', C.navy);
  const statusTiles = [
    { label: 'RED — OVERDUE', count: r.redActions.length, color: C.red },
    { label: 'YELLOW — DUE SOON', count: r.yellowActions.length, color: C.amber },
    { label: 'GREEN — ON TRACK', count: r.greenCount, color: C.green },
  ];
  const stw = (CW - 20) / 3;
  statusTiles.forEach((t, i) => {
    const x = MARGIN + i * (stw + 10);
    pdf.setFillColor(...C.light); pdf.roundedRect(x, k.y, stw, 58, 6, 6, 'F');
    pdf.setFillColor(...t.color); pdf.circle(x + 18, k.y + 20, 6, 'F');
    pdf.setFontSize(20); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...t.color);
    pdf.text(String(t.count), x + stw - 16, k.y + 26, { align: 'right' });
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.muted);
    pdf.text(k.safe(t.label), x + 12, k.y + 46, { maxWidth: stw - 20 });
  });
  k.y += 74;

  // Only Red and Yellow actions get written detail — Green is just the count above.
  const flagged = [...r.redActions, ...r.yellowActions];
  if (flagged.length) {
    flagged.forEach(a => {
      k.space(46);
      const badge = a.status === 'Red' ? C.red : C.amber;
      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.text);
      pdf.text(k.safe(a.title), MARGIN, k.y + 6, { maxWidth: CW - 78 });
      pdf.setFillColor(...badge); pdf.roundedRect(MARGIN + CW - 60, k.y - 6, 60, 15, 7, 7, 'F');
      pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.white);
      pdf.text(a.status.toUpperCase(), MARGIN + CW - 30, k.y + 4, { align: 'center' });
      k.y += 14;
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
      pdf.text(k.safe(`Owner: ${a.owner || '—'}   ·   Due: ${a.dueDate || '—'}`), MARGIN, k.y + 4);
      k.y += 13;
      pdf.setFontSize(8.5); pdf.setFont('helvetica', a.status === 'Red' ? 'bold' : 'normal'); pdf.setTextColor(...a.note.color);
      pdf.text(k.safe(a.note.text), MARGIN, k.y + 4, { maxWidth: CW });
      k.y += 13;
      pdf.setDrawColor(...C.border); pdf.setLineWidth(0.5); pdf.line(MARGIN, k.y, MARGIN + CW, k.y);
      k.y += 8;
    });
  } else if (r.actions.length) {
    k.text('All open actions are on track. Nothing overdue or due soon.', MARGIN, 9, C.muted, false, CW);
    k.y += 16;
  } else {
    k.text('No open actions on your Accountability Board.', MARGIN, 9, C.muted, false, CW);
    k.y += 16;
  }

  // ── Focus Next Week — compact recommendation list, no paragraphs ──
  k.sectionHeader('Focus Next Week', C.amber);
  const urgent = new Set(r.notUsedIn3Weeks.map(t => t.key));
  const recs = r.notUsedThisWeek.filter(t => !urgent.has(t.key));
  if (!recs.length && !r.notUsedIn3Weeks.length) {
    k.text('Full coverage — every tool has been touched recently. Excellent breadth.', MARGIN, 9.5, C.green, true, CW);
    k.y += 16;
  } else {
    // Tool "icon" fields are emoji — drawn as a small colored dot instead of
    // printed as text (see note above on jsPDF's font not supporting emoji).
    r.notUsedIn3Weeks.forEach(t => {
      k.space(14);
      pdf.setFillColor(...C.red); pdf.circle(MARGIN + 3, k.y + 1, 2.5, 'F');
      pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.red);
      pdf.text(k.safe(t.label), MARGIN + 10, k.y + 4);
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
      pdf.text('Not touched in 3 weeks', MARGIN + CW - 100, k.y + 4, { align: 'right' });
      k.y += 14;
    });
    recs.forEach(t => {
      k.space(14);
      pdf.setFillColor(...C.muted); pdf.circle(MARGIN + 3, k.y + 1, 2.5, 'F');
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.text);
      pdf.text(k.safe(t.label), MARGIN + 10, k.y + 4);
      pdf.setTextColor(...C.muted);
      pdf.text('Not used this week', MARGIN + CW - 100, k.y + 4, { align: 'right' });
      k.y += 14;
    });
  }
  k.y += 4;

  // ── Closing note — personalized, replaces a generic quote ──
  k.space(50);
  const hasWins = r.topUsedThisWeek.length > 0;
  const closingText = hasWins
    ? `Nice work this week, ${r.name}. You put real time into ${r.topUsedThisWeek.map(t => t.label).join(', ')}${r.topUsedThisWeek.length > 1 ? ' — ' : ' — '}keep that consistency going into next week.`
    : `${r.name}, no tool activity logged this week — jump back in next week. Even one session moves your score.`;
  pdf.setFillColor(240, 253, 250); pdf.roundedRect(MARGIN, k.y, CW, 40, 6, 6, 'F');
  pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.teal);
  const cl = pdf.splitTextToSize(k.safe(closingText), CW - 24);
  pdf.text(cl, MARGIN + 12, k.y + 16);
  k.y += 52;

  k.finish(`Weekly_Report_${r.name.replace(/\s+/g, '_')}_${localDateStr()}.pdf`);
  return r;
}
