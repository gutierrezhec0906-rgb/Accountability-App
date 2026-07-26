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

// The five leadership pillars (mirror the sidebar categories + colors), and
// which tool keys roll up into each one.
const PILLARS = [
  { id: 'model',     label: 'Set the Bar',            color: [96, 165, 250],  keys: ['visual-board', 'lob', 'urgency', 'eq-opex'] },
  { id: 'inspire',   label: 'Spark the Vision',        color: [52, 211, 153],  keys: ['vision', 'smart-goals', 'mindfulness'] },
  { id: 'challenge', label: 'Improve the Flow',        color: [251, 191, 36],  keys: ['lean', 'problem-solving', 'disc'] },
  { id: 'enable',    label: 'Enable the Team',         color: [167, 139, 250], keys: ['skills', 'training', 'mentoring', 'career'] },
  { id: 'encourage', label: 'Winning with Compassion', color: [251, 113, 133], keys: ['feedback', 'coaching', 'quotes'] },
];
const KEY_TO_PILLAR = {};
PILLARS.forEach(p => p.keys.forEach(k => { KEY_TO_PILLAR[k] = p.id; }));

// Strong, per-pillar engagement lines for the "grow these pillars" recommendation.
const PILLAR_ENGAGEMENT = {
  model:     'Great leaders set the standard before they ask for it — step up here and the team will follow your lead.',
  inspire:   'Your team moves faster when they can see the bigger picture — go paint it for them and watch them rally.',
  challenge: 'Every bottleneck you remove frees your whole team — hunt one down and turn friction into flow.',
  enable:    'Your real legacy is the leaders you build — pour genuine time into developing your people this week.',
  encourage: 'Recognition and care cost you nothing and change everything — use them generously and often.',
};

// Training Center dashboard counts (mirror pages/Training.jsx): completed vs
// open On Track (>2 weeks) / Due Soon (<=2 weeks) / Past Due.
function trainingStatusCounts(trainings = []) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const s = { completed: 0, ontrack: 0, warning: 0, overdue: 0, total: trainings.length };
  trainings.forEach(t => {
    if (t.completed) { s.completed++; return; }
    if (!t.dueDate) { s.ontrack++; return; }
    const diff = Math.round((new Date(t.dueDate + 'T00:00:00') - today) / 86400000);
    if (diff < 0) s.overdue++; else if (diff <= 14) s.warning++; else s.ontrack++;
  });
  return s;
}

// Find Line-of-Balance tasks that are behind: a task not yet 100% complete
// while sitting past a planned date column (the "red" state on the LOB grid).
function lobBehindTasks(lobRecords = []) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const items = [];
  lobRecords.forEach(lob => {
    (lob.tasks || []).forEach(t => {
      if (!(t.name || '').trim()) return;
      let missed = null;
      (lob.dates || []).forEach((d, ci) => {
        if (!d || missed) return;
        const raw = (t.cells || [])[ci];
        const hasVal = raw !== undefined && raw !== null && String(raw).trim() !== '';
        const due = new Date(d + 'T00:00:00');
        // "Red" on the grid = a past-due date column whose value is under 100%.
        if (due < today && hasVal && parseFloat(raw) < 100) missed = d;
      });
      if (missed) items.push({ lob: lob.name || 'Line of Balance', task: t.name, due: missed });
    });
  });
  return items;
}

// Group this week's point events (already grouped by label) into the 5 pillars.
function buildPillars(pointsBreakdown) {
  const idx = Object.fromEntries(PILLARS.map((p, i) => [p.id, i]));
  const out = PILLARS.map(p => ({ id: p.id, label: p.label, color: p.color, items: [], total: 0 }));
  pointsBreakdown.forEach(pb => {
    const pid = KEY_TO_PILLAR[toolKeyFromLabel(pb.label)];
    if (pid != null && idx[pid] != null) { out[idx[pid]].items.push(pb); out[idx[pid]].total += pb.points; }
  });
  return out;
}

// SMART goal quality — mirrors goalQualityPct in pages/SmartGoals.jsx.
const SMART_KEYS = ['specific', 'measurable', 'achievable', 'relevant', 'timeBound'];
function smartFieldQ(text = '') {
  const w = (text || '').trim().split(/\s+/).filter(Boolean).length;
  if (!w) return 0; if (w < 5) return 20; if (w < 15) return 50; if (w < 30) return 80; return 100;
}
function smartGoalQ(g) {
  return Math.round(SMART_KEYS.reduce((a, k) => a + smartFieldQ(g[k]), 0) / SMART_KEYS.length);
}
// Motivational note on SMART-goal quality: kudos if all High Quality, otherwise
// a gentle nudge to add detail. Returns null when the user has no goals.
export function smartGoalsNote(total, high, opp) {
  if (total === 0) {
    return { kudos: false, text: `You don't have any SMART goals yet — and that's the most important place to start. Please set at least 1 or 2 SMART goals this coming week. Clear, written goals are what turn effort into real, measurable leadership growth. Take 10 minutes and define where you're headed.` };
  }
  if (opp === 0) {
    return { kudos: true, text: `Kudos — great job with the quality of your SMART goals! All ${total} ${total === 1 ? 'goal is' : 'goals are'} High Quality. That clarity will keep you focused and moving.` };
  }
  return { kudos: false, text: `Please consider improving the quality and detail of your SMART goals — you have ${opp} with opportunit${opp === 1 ? 'y' : 'ies'} and ${high} at High Quality. Adding more specific, measurable detail will help you understand your objectives better and reach them.` };
}

// Personalized closing message tiered by the week's points earned — from a
// gentle "you can do better" nudge up to "outstanding, above average."
export function weeklyEncouragement(points, name) {
  if (points <= 20) {
    return {
      headline: `You've got more in you, ${name}`,
      message: `${name}, I know how much your daily responsibilities pull at your time — and I believe in you. You can do better, and your development depends on no one but you. ${points} point${points === 1 ? '' : 's'} this week is a start, not your ceiling. Keep going, and let's aim for at least 35 points next week.`,
    };
  }
  if (points <= 40) {
    return {
      headline: `Nice job, ${name}!`,
      message: `Nice job, ${name}! You're taking your leadership development seriously and it shows — ${points} points this week. Keep up the good work and carry this momentum into next week.`,
    };
  }
  if (points <= 60) {
    return {
      headline: `You crushed it, ${name}!`,
      message: `You crushed it, ${name}! ${points} points this week is a genuinely amazing performance. Keep operating at this level and you'll achieve great things in your career.`,
    };
  }
  return {
    headline: `Outstanding job, ${name}!`,
    message: `Outstanding job, ${name}! At ${points} points this week you're well above the average in leadership development. Keep this up and you'll be ready for your next challenge very soon.`,
  };
}

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

  // SMART goal quality snapshot (High Quality >= 80% vs "with opportunities").
  const smartGoals = (data.smartGoals || []).filter(g => g && g.status !== 'deleted' && g.status !== 'archived');
  const smartHigh = smartGoals.filter(g => smartGoalQ(g) >= 80).length;
  const smartQuality = { total: smartGoals.length, high: smartHigh, opp: smartGoals.length - smartHigh };

  // Pending peer skills-assessment request awaiting a teammate.
  const pr = data.skillsPeerRequest;
  const skillsPeerPending = (pr && pr.status === 'pending') ? { name: pr.toName || 'your teammate' } : null;

  // Points earned this week, grouped by activity (toolLabel) and summed —
  // for the "Well done, you earned these points" section of the report.
  const pointsByLabel = {};
  events.filter(e => e.points > 0).forEach(e => {
    const label = e.toolLabel || 'App activity';
    pointsByLabel[label] = (pointsByLabel[label] || 0) + e.points;
  });
  const pointsBreakdown = Object.entries(pointsByLabel)
    .map(([label, points]) => ({ label, points }))
    .sort((a, b) => b.points - a.points);

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

  // Pillars + the two least-active pillars this week, with the specific modules
  // the user did NOT touch — used for the strong "grow these next week" nudge.
  const pillars = buildPillars(pointsBreakdown);
  pillars.forEach(p => {
    const keys = (PILLARS.find(x => x.id === p.id) || {}).keys || [];
    p.unusedTools = keys.filter(kk => !usedThisWeek.has(kk)).map(kk => (TOOL_LABEL[kk] && TOOL_LABEL[kk].label) || kk);
    p.engagement = PILLAR_ENGAGEMENT[p.id] || '';
  });
  const weakPillars = pillars
    .filter(p => p.unusedTools.length > 0)
    .sort((a, b) => a.total - b.total || b.unusedTools.length - a.unusedTools.length)
    .slice(0, 2);

  // Line of Balance tasks that are behind (past-due, under 100%).
  const lobBehind = lobBehindTasks(data.lobRecords || []);

  // Training Center dashboard snapshot.
  const trainingStatus = trainingStatusCounts(data.trainings || []);

  return {
    name: (data.displayName || '').split(' ')[0] || 'Leader',
    weekPoints, score, diversityPct, everPct,
    usedThisWeek: usedThisWeekTools,
    notUsedThisWeek: REPORT_TOOLS.filter(t => !usedThisWeek.has(t.key)),
    notUsedIn3Weeks,
    topUsedThisWeek,
    events, pointsBreakdown, pillars, weakPillars, lobBehind, trainingStatus,
    actions, redActions, yellowActions, greenCount,
    smartQuality, skillsPeerPending,
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

  // Explainer heading between the navy band and the summary tiles
  pdf.setFontSize(12.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.navy);
  pdf.text('Your Accountability Score for This Week', MARGIN, k.y + 4);
  k.y += 15;
  pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
  const explain = 'Here is your week at a glance — Points This Week is what you earned in the last 7 days, Accountability Score is your overall standing out of 100, and Tool Diversity is how much of the leadership toolkit you used.';
  pdf.splitTextToSize(k.safe(explain), CW).forEach((line, i) => pdf.text(line, MARGIN, k.y + i * 11));
  k.y += pdf.splitTextToSize(k.safe(explain), CW).length * 11 + 8;

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

  // Small indented sub-heading used for the report embedded inside each pillar.
  const subHead = (text, color = C.navy) => {
    k.space(22);
    pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...color);
    pdf.text(k.safe(text), MARGIN + 14, k.y + 8);
    k.y += 15;
  };

  // Embedded report: Accountability Board action status (Set the Bar pillar).
  function renderActionStatus() {
    subHead('Accountability Board — Action Status');
    const statusTiles = [
      { label: 'RED — OVERDUE', count: r.redActions.length, color: C.red },
      { label: 'YELLOW — DUE SOON', count: r.yellowActions.length, color: C.amber },
      { label: 'GREEN — ON TRACK', count: r.greenCount, color: C.green },
    ];
    const stw = (CW - 34) / 3;
    k.space(50);
    statusTiles.forEach((t, i) => {
      const x = MARGIN + 14 + i * (stw + 10);
      pdf.setFillColor(...C.light); pdf.roundedRect(x, k.y, stw, 44, 6, 6, 'F');
      pdf.setFillColor(...t.color); pdf.circle(x + 14, k.y + 16, 5, 'F');
      pdf.setFontSize(17); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...t.color);
      pdf.text(String(t.count), x + stw - 12, k.y + 22, { align: 'right' });
      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.muted);
      pdf.text(k.safe(t.label), x + 10, k.y + 37, { maxWidth: stw - 16 });
    });
    k.y += 54;
    const flagged = [...r.redActions, ...r.yellowActions];
    if (flagged.length) {
      flagged.forEach(a => {
        k.space(40);
        const badge = a.status === 'Red' ? C.red : C.amber;
        pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.text);
        pdf.text(k.safe(a.title), MARGIN + 14, k.y + 6, { maxWidth: CW - 90 });
        pdf.setFillColor(...badge); pdf.roundedRect(MARGIN + CW - 60, k.y - 5, 60, 15, 7, 7, 'F');
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.white);
        pdf.text(a.status.toUpperCase(), MARGIN + CW - 30, k.y + 5, { align: 'center' });
        k.y += 14;
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
        pdf.text(k.safe(`Owner: ${a.owner || '—'}   ·   Due: ${a.dueDate || '—'}`), MARGIN + 14, k.y + 4);
        k.y += 12;
        pdf.setFontSize(8.5); pdf.setFont('helvetica', a.status === 'Red' ? 'bold' : 'normal'); pdf.setTextColor(...a.note.color);
        pdf.text(k.safe(a.note.text), MARGIN + 14, k.y + 4, { maxWidth: CW - 14 });
        k.y += 14;
      });
    } else if (r.actions.length) {
      pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
      pdf.text('All open actions are on track. Nothing overdue or due soon.', MARGIN + 14, k.y + 4); k.y += 14;
    } else {
      pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
      pdf.text('No open actions on your Accountability Board.', MARGIN + 14, k.y + 4); k.y += 14;
    }

    // Line of Balance — imperative catch-up reminder for past-due, sub-100% tasks.
    if (r.lobBehind.length) {
      subHead('Line of Balance — Catch Up Needed', C.red);
      const n = r.lobBehind.length;
      const lead = `${n} Line-of-Balance task${n === 1 ? ' is' : 's are'} past a planned date and not yet 100% complete. It's imperative you catch up — a slipping schedule compounds fast. You've got this: block time this week, update the numbers, and get each activity back on pace.`;
      pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.red);
      const ll = pdf.splitTextToSize(k.safe(lead), CW - 22);
      k.space(ll.length * 12 + 6);
      ll.forEach((line, i) => pdf.text(line, MARGIN + 14, k.y + 4 + i * 12));
      k.y += ll.length * 12 + 6;
      r.lobBehind.slice(0, 8).forEach(it => {
        k.space(12);
        pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.text);
        pdf.text(k.safe(`• ${it.task}  (${it.lob}) — behind since ${it.due}`), MARGIN + 16, k.y + 3, { maxWidth: CW - 22 });
        k.y += 12;
      });
    }
  }

  // Embedded report: SMART Goals quality (Spark the Vision pillar).
  function renderSmartQuality() {
    const sg = smartGoalsNote(r.smartQuality.total, r.smartQuality.high, r.smartQuality.opp);
    if (!sg) return;
    subHead('SMART Goals Quality');
    const col = sg.kudos ? C.green : C.amber;
    pdf.setFontSize(9.5); pdf.setFont('helvetica', sg.kudos ? 'bold' : 'normal'); pdf.setTextColor(...col);
    const sl = pdf.splitTextToSize(k.safe(sg.text), CW - 22);
    k.space(sl.length * 13 + 6);
    sl.forEach((line, i) => pdf.text(line, MARGIN + 14, k.y + 4 + i * 13));
    k.y += sl.length * 13 + 6;
  }

  // Embedded report: pending peer skills-assessment follow-up (Enable the Team pillar).
  function renderSkillsFollowup() {
    if (!r.skillsPeerPending) return;
    subHead('Skills Assessment — Follow Up');
    pdf.setFontSize(9.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.amber);
    const fl = pdf.splitTextToSize(k.safe(`We strongly recommend following up with ${r.skillsPeerPending.name} — in person or by email — to complete your skills assessment. Your request is still pending; a quick nudge keeps your development on track.`), CW - 22);
    k.space(fl.length * 13 + 6);
    fl.forEach((line, i) => pdf.text(line, MARGIN + 14, k.y + 4 + i * 13));
    k.y += fl.length * 13 + 6;
  }

  // Embedded report: Training Center dashboard tiles (Enable the Team pillar).
  function renderTrainingStatus() {
    const ts = r.trainingStatus;
    if (!ts.total) return;
    subHead('Training Center — Dashboard');
    const tiles = [
      { label: 'COMPLETED', count: ts.completed, color: C.teal },
      { label: 'ON TRACK', count: ts.ontrack, color: C.green },
      { label: 'DUE SOON', count: ts.warning, color: C.amber },
      { label: 'PAST DUE', count: ts.overdue, color: C.red },
    ];
    const tw = (CW - 14 - 3 * 8) / 4;
    k.space(48);
    tiles.forEach((t, i) => {
      const x = MARGIN + 14 + i * (tw + 8);
      pdf.setFillColor(...C.light); pdf.roundedRect(x, k.y, tw, 36, 5, 5, 'F');
      pdf.setFillColor(...t.color); pdf.circle(x + 11, k.y + 13, 4.5, 'F');
      pdf.setFontSize(15); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...t.color);
      pdf.text(String(t.count), x + tw - 9, k.y + 18, { align: 'right' });
      pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.muted);
      pdf.text(k.safe(t.label), x + 8, k.y + 30, { maxWidth: tw - 12 });
    });
    k.y += 42;
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
    pdf.text(`${ts.completed} of ${ts.total} complete (${Math.round((ts.completed / ts.total) * 100)}%)`, MARGIN + 14, k.y + 2);
    k.y += 12;
  }

  const PILLAR_REPORT = {
    model: renderActionStatus,
    inspire: renderSmartQuality,
    enable: () => { renderTrainingStatus(); renderSkillsFollowup(); },
  };

  // ── The five leadership pillars — points + each pillar's own report ──
  k.sectionHeader('Points You Earned This Week', C.teal);
  k.text(r.weekPoints > 0
    ? `Great work, ${r.name}! You earned ${r.weekPoints} point${r.weekPoints === 1 ? '' : 's'} this week across the five leadership pillars:`
    : `${r.name}, no points earned this week yet — here's where each pillar stands. Every action counts.`, MARGIN, 9, C.text, false, CW);
  k.y += 14;
  r.pillars.forEach(p => {
    k.space(24 + Math.max(1, p.items.length) * 13);
    // Pillar header: color swatch + label + pillar total (sidebar colors)
    pdf.setFillColor(...p.color); pdf.roundedRect(MARGIN, k.y, 4, 15, 1, 1, 'F');
    pdf.setFontSize(10.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...p.color);
    pdf.text(k.safe(p.label), MARGIN + 10, k.y + 11);
    pdf.text(p.total > 0 ? `+${p.total} pt${p.total === 1 ? '' : 's'}` : '—', MARGIN + CW, k.y + 11, { align: 'right' });
    k.y += 19;
    if (p.items.length) {
      p.items.forEach(it => {
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.text);
        pdf.text(k.safe(it.label), MARGIN + 14, k.y + 3, { maxWidth: CW - 60 });
        pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.text);
        pdf.text(`+${it.points}`, MARGIN + CW, k.y + 3, { align: 'right' });
        k.y += 13;
      });
    } else {
      pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
      pdf.text('No points earned in this pillar this week.', MARGIN + 14, k.y + 3);
      k.y += 13;
    }
    // Pillar-specific report (action status / SMART quality / skills follow-up)
    if (PILLAR_REPORT[p.id]) PILLAR_REPORT[p.id]();
    k.y += 8;
    pdf.setDrawColor(...C.border); pdf.setLineWidth(0.5); pdf.line(MARGIN, k.y, MARGIN + CW, k.y);
    k.y += 6;
  });

  // ── Focus Next Week — your two least-active pillars + the tools you skipped ──
  k.sectionHeader('Focus Next Week', C.amber);
  if (r.weakPillars.length) {
    k.text(`Your two quietest pillars this week were ${r.weakPillars.map(p => p.label).join(' and ')}. Make these your priority next week — here's exactly where to grow:`, MARGIN, 9.5, C.text, false, CW);
    k.y += 16;
    r.weakPillars.forEach(p => {
      const body = `You didn't use ${p.unusedTools.join(', ')} this week. ${p.engagement}`;
      const bl = pdf.splitTextToSize(k.safe(body), CW - 14);
      k.space(20 + bl.length * 12 + 6);
      // Colored pillar header (sidebar color) + this-week total
      pdf.setFillColor(...p.color); pdf.roundedRect(MARGIN, k.y, 4, 14, 1, 1, 'F');
      pdf.setFontSize(10.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...p.color);
      pdf.text(k.safe(p.label), MARGIN + 10, k.y + 10);
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
      pdf.text(p.total > 0 ? `only +${p.total} pt${p.total === 1 ? '' : 's'} this week` : 'no points this week', MARGIN + CW, k.y + 10, { align: 'right' });
      k.y += 17;
      pdf.setFontSize(9.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.text);
      bl.forEach((line, i) => pdf.text(line, MARGIN + 10, k.y + 4 + i * 12));
      k.y += bl.length * 12 + 10;
    });
  } else {
    k.text('Outstanding breadth — you touched every leadership pillar this week. Keep the whole system moving!', MARGIN, 9.5, C.green, true, CW);
    k.y += 16;
  }
  k.y += 4;

  // ── Closing note — personalized message tiered by the week's points ──
  const enc = weeklyEncouragement(r.weekPoints, r.name);
  const FS = 12, LH = 17, PAD = 16;                 // font size, line height, box padding (pt)
  pdf.setFontSize(FS); pdf.setFont('helvetica', 'bold');
  const cl = pdf.splitTextToSize(k.safe(enc.message), CW - PAD * 2);
  const boxH = PAD * 2 + cl.length * LH;
  k.space(boxH + 10);
  pdf.setFillColor(240, 253, 250); pdf.roundedRect(MARGIN, k.y, CW, boxH, 6, 6, 'F');
  pdf.setTextColor(...C.teal);
  cl.forEach((line, i) => pdf.text(line, MARGIN + PAD, k.y + PAD + FS - 2 + i * LH));
  k.y += boxH + 12;

  k.finish(`Weekly_Report_${r.name.replace(/\s+/g, '_')}_${localDateStr()}.pdf`);
  return r;
}
