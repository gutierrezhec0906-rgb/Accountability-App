import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { newDoc, C } from './pdfKit';
import { localDateStr } from './scoring';

// The 17 practice tools (keys match the route path stored in toolSessions.tool).
export const REPORT_TOOLS = [
  { key: 'visual-board',    label: 'Visual Mgmt Board', icon: '🔴' },
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

const QUOTES = [
  '"The growth and development of people is the highest calling of leadership." — Harvey Firestone',
  '"A leader is one who knows the way, goes the way, and shows the way." — John C. Maxwell',
  '"Success is the sum of small efforts repeated day in and day out." — Robert Collier',
  '"Excellence is not an act, but a habit." — Aristotle',
];

// Motivational note per action status.
function actionNote(status) {
  if (status === 'Red')
    return { color: C.red, text: 'OVERDUE — recommit NOW. This needs your attention today. Set a firm new date, own it, and get it back on track immediately. Leaders close their loops — do not let this linger.' };
  if (status === 'Yellow')
    return { color: C.amber, text: 'Due soon — make sure everything is in place to deliver on time. Confirm your resources, clear any blockers today, and protect this deadline. You have got this if you act now.' };
  return { color: C.green, text: 'On track — excellent. Keep the momentum and finish strong. Your consistency here is exactly what strong leadership looks like.' };
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

  // Tool usage this week + all-time from the toolSessions collection
  let usedThisWeek = new Set(), usedEver = new Set();
  try {
    const ts = await getDocs(query(collection(db, 'toolSessions'), where('uid', '==', uid)));
    ts.forEach(d => {
      const s = d.data();
      if (!TOOL_LABEL[s.tool]) return;
      usedEver.add(s.tool);
      if ((s.openedAt || 0) >= weekAgo) usedThisWeek.add(s.tool);
    });
  } catch (e) { console.warn('toolSessions query failed', e); }

  const events = (data.pointEvents || []).filter(e => (e.date || '') >= weekAgoStr);
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

  // Trend: tools not used in ANY of the last 4 recorded weeks → focus recommendations
  const last4 = newHistory.slice(0, 4);
  const usedInLast4 = new Set(last4.flatMap(h => h.usedKeys || []));
  const consistentlyUnused = REPORT_TOOLS.filter(t => !usedInLast4.has(t.key));
  const avgDiversity = last4.length ? Math.round(last4.reduce((s, h) => s + (h.diversityPct || 0), 0) / last4.length) : diversityPct;

  return {
    name: (data.displayName || '').split(' ')[0] || 'Leader',
    weekPoints, score, diversityPct, everPct,
    usedThisWeek: REPORT_TOOLS.filter(t => usedThisWeek.has(t.key)),
    notUsedThisWeek: REPORT_TOOLS.filter(t => !usedThisWeek.has(t.key)),
    events, actions,
    weeksTracked: newHistory.length, avgDiversity, consistentlyUnused,
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

  // Tools used this week
  k.sectionHeader('Tools You Used This Week', C.teal);
  if (r.usedThisWeek.length) {
    k.field(`${r.usedThisWeek.length} of ${TOTAL_TOOLS} tools (${r.diversityPct}% diversity)`,
      r.usedThisWeek.map(t => t.label).join(', '), { blanks: 0 });
  } else {
    k.text('No tools logged this week — a fresh start awaits! Aim for at least 5 different tools next week.', MARGIN, 10, C.muted, false, CW);
    k.y += 18;
  }

  // Tools NOT used + trend
  k.sectionHeader('Grow Next Week — Prioritize These', C.amber);
  k.field('Not used this week', r.notUsedThisWeek.map(t => t.label).join(', ') || 'None — you touched every tool! 🌟', { blanks: 0 });
  if (r.weeksTracked >= 2) {
    k.field(`Consistently skipped (last ${Math.min(4, r.weeksTracked)} weeks)`,
      r.consistentlyUnused.length ? r.consistentlyUnused.map(t => t.label).join(', ') : 'None — great all-round coverage!', { blanks: 0 });
    k.field('Your average weekly diversity', `${r.avgDiversity}% — ${r.avgDiversity >= 50 ? 'strong, well-rounded leadership practice' : 'aim to broaden your toolkit for more balanced growth'}`, { blanks: 0 });
  } else {
    k.text('Your history starts building now — next week this report will analyze your trends and pinpoint the tools to focus on.', MARGIN, 9, C.muted, false, CW);
    k.y += 16;
  }

  // Open actions with status + motivational notes
  k.sectionHeader('Your Open Actions', C.navy);
  if (!r.actions.length) {
    k.text('No open actions on your Visual Management Board. Add your commitments there to track them here each week.', MARGIN, 10, C.muted, false, CW);
    k.y += 16;
  } else {
    r.actions.forEach(a => {
      k.space(60);
      const badge = { Red: C.red, Yellow: C.amber, Green: C.green }[a.status];
      // Title + status badge
      pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.text);
      pdf.text(k.safe(a.title), MARGIN, k.y + 6, { maxWidth: CW - 90 });
      pdf.setFillColor(...badge); pdf.roundedRect(MARGIN + CW - 70, k.y - 6, 70, 16, 8, 8, 'F');
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.white);
      pdf.text(a.status.toUpperCase(), MARGIN + CW - 35, k.y + 5, { align: 'center' });
      k.y += 16;
      // Owner + due
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
      pdf.text(k.safe(`Owner: ${a.owner || '—'}    ·    Due / ETA: ${a.dueDate || '—'}`), MARGIN, k.y + 4);
      k.y += 16;
      // Motivational note in status color
      pdf.setFontSize(9.5); pdf.setFont('helvetica', a.status === 'Red' ? 'bold' : 'normal'); pdf.setTextColor(...a.note.color);
      const lines = pdf.splitTextToSize(k.safe(a.note.text), CW - 8);
      for (const ln of lines) { k.space(13); pdf.text(ln, MARGIN + 4, k.y + 4); k.y += 13; }
      k.y += 8;
      pdf.setDrawColor(...C.border); pdf.setLineWidth(0.5); pdf.line(MARGIN, k.y, MARGIN + CW, k.y);
      k.y += 10;
    });
  }

  // Quote
  k.space(50);
  const q = QUOTES[today.getDate() % QUOTES.length];
  pdf.setFillColor(240, 253, 250); pdf.roundedRect(MARGIN, k.y, CW, 36, 6, 6, 'F');
  pdf.setFontSize(10); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(...C.teal);
  const ql = pdf.splitTextToSize(k.safe(q), CW - 24);
  pdf.text(ql, MARGIN + 12, k.y + 16);
  k.y += 48;

  k.finish(`Weekly_Report_${r.name.replace(/\s+/g, '_')}_${localDateStr()}.pdf`);
  return r;
}
