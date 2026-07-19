import { getDoc, setDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const DAILY_POINTS_CAP = 25;

// Appends a point event to users/{uid}.pointEvents (max 200 entries).
// Returns { awarded: boolean, capReached: boolean, todayTotal: number }
// If the user has already earned DAILY_POINTS_CAP points today, the event
// is NOT written and awarded=false is returned so callers can show a message.
export async function logPointEvent(uid, { points, toolLabel, reason }) {
  if (!uid) return { awarded: false, capReached: false, todayTotal: 0 };
  const today = new Date().toISOString().split('T')[0];
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const existing = snap.exists() ? (snap.data().pointEvents || []) : [];
    const todayTotal = existing
      .filter(e => e.date === today && e.points > 0)
      .reduce((s, e) => s + e.points, 0);

    if (todayTotal >= DAILY_POINTS_CAP) {
      return { awarded: false, capReached: true, todayTotal };
    }

    const event = { date: today, points, toolLabel, reason };
    const updated = [event, ...existing].slice(0, 200);
    await setDoc(doc(db, 'users', uid), { pointEvents: updated }, { merge: true });
    return { awarded: true, capReached: false, todayTotal: todayTotal + points };
  } catch {
    return { awarded: false, capReached: false, todayTotal: 0 };
  }
}

export const TOOL_WEIGHTS = {
  'coaching':        3,
  'mentoring':       3,
  'smart-goals':     3,
  'problem-solving': 3,
  'skills':          3,
  'career':          3,
  'disc':            3,
  'vision':          2,
  'eq-opex':         2,
  'lob':             2,
  'urgency':         2,
  'lean':            2,
  'feedback':        2,
  'training':        1,
  'quotes':          1,
  'mindfulness':     1,
  'visual-board':    1,
};

const TOTAL_TOOLS = Object.keys(TOOL_WEIGHTS).length;

function fieldQuality(text = '') {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0)  return 0;
  if (words < 5)    return 0.3;
  if (words < 15)   return 0.6;
  if (words < 30)   return 0.85;
  return 1.0;
}

// Returns the ISO date string (YYYY-MM-DD) of the Monday that starts the week
// containing the given date string.
export function weekMonday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  return d.toISOString().split('T')[0];
}

// A coaching session counts as "complete" when it has coachee, goal, notes,
// and at least one action item with a description.
export function isCompleteCoachingSession(s) {
  if (!s.date || !s.coachee) return false;
  if (!(s.coachingGoal || '').trim()) return false;
  if (fieldQuality(s.notes || '') < 0.3) return false;
  const hasAction = Array.isArray(s.actionItems) &&
    s.actionItems.some(a => (typeof a === 'string' ? a : (a.action || '')).trim());
  return hasAction;
}

// ── Problem-Solving Score (0-20) ───────────────────────────────────────────
// Points per tool per week (max once per tool per week):
//   5 Whys   → 5 pts
//   Fishbone → 5 pts
//   A3       → 10 pts  (total cap 20 pts/week)
//
// Decay based on consecutive weeks of non-use since most recently active week:
//   Used this week      → 100%
//   1 week gap          →  80%
//   2 week gap          →  50%
//   3+ week gap         →  25%
const PS_POINTS = { '5whys': 5, fishbone: 5, a3: 10 };

export function problemSolvingScore(entries = []) {
  if (!entries.length) return 0;

  // Normalise createdAt to YYYY-MM-DD
  const dated = entries.map(e => ({
    type: e.type,
    date: e.createdAt?.seconds
      ? new Date(e.createdAt.seconds * 1000).toISOString().split('T')[0]
      : typeof e.createdAt === 'string' ? e.createdAt.split('T')[0]
      : null,
  })).filter(e => e.date && PS_POINTS[e.type] !== undefined);

  if (!dated.length) return 0;

  // Most recently active week
  const allWeekKeys = dated.map(e => weekMonday(e.date)).sort();
  const mostRecentWeek = allWeekKeys[allWeekKeys.length - 1];

  // Weeks elapsed since most recently active week
  const currentWeek = weekMonday(new Date().toISOString().split('T')[0]);
  const msPerWeek   = 7 * 24 * 60 * 60 * 1000;
  const weeksGap    = Math.round((new Date(currentWeek) - new Date(mostRecentWeek)) / msPerWeek);

  const decay = weeksGap === 0 ? 1.0
              : weeksGap === 1 ? 0.8
              : weeksGap === 2 ? 0.5
              : 0.25;

  // Points earned in that most recent week (one per tool type)
  const weekTypes = new Set(
    dated.filter(e => weekMonday(e.date) === mostRecentWeek).map(e => e.type)
  );
  const earned = [...weekTypes].reduce((sum, t) => sum + (PS_POINTS[t] || 0), 0);

  return Math.min(Math.round(earned * decay), 20);
}

// Score: 5 pts for each week in the last 4 calendar weeks that contains at
// least one complete coaching session. Max 20 pts.
function coachingLogScore(sessions = []) {
  const today = new Date();
  // Build Monday keys for this week and the 3 prior weeks
  const weekKeys = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 7);
    return weekMonday(d.toISOString().split('T')[0]);
  });

  const weeksWithEntry = new Set(
    sessions
      .filter(isCompleteCoachingSession)
      .map(s => weekMonday(s.date))
  );

  const qualifyingWeeks = weekKeys.filter(k => weeksWithEntry.has(k)).length;
  return qualifyingWeeks * 5; // 5 pts per week, max 20
}

export async function calculateScore(uid) {
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) throw new Error('User not found');
  const data = userSnap.data();

  const penaltyPts = data.penaltyPoints || 0;
  const bonusPts   = data.bonusPoints   || 0;

  // --- Breadth (0-20): distinct tools used, stored in toolSessions array on user doc ---
  const toolSessions = data.toolSessions || [];
  const uniqueTools  = new Set(toolSessions.map(s => s.tool));
  const breadth = Math.min((uniqueTools.size / TOTAL_TOOLS) * 20 * 1.5, 20);

  // --- Frequency (0-20): sessions in last 30 days ---
  const thirtyDaysAgo   = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSessions  = toolSessions.filter(s => (s.openedAt || 0) >= thirtyDaysAgo);
  const frequency = Math.min((recentSessions.length / 20) * 20, 20);

  // --- Depth (0-15): avg time per session ---
  function depthMult(sec) {
    if (sec < 60)   return 0;
    if (sec < 180)  return 0.2;
    if (sec < 600)  return 0.6;
    if (sec < 1800) return 1.0;
    return 1.2;
  }
  const depthScores = toolSessions.map(s => depthMult(s.durationSeconds || 0));
  const avgDepth = depthScores.length ? depthScores.reduce((a, b) => a + b, 0) / depthScores.length : 0;
  const depth = avgDepth * 15;

  // --- Quality (0-25): SMART goal entry completeness ---
  const goals = data.smartGoals || [];
  const SMART_FIELDS = ['specific', 'measurable', 'achievable', 'relevant', 'timeBound'];
  const goalQualities = goals.map(g => {
    const scores = SMART_FIELDS.map(f => fieldQuality(g[f] || ''));
    return scores.reduce((a, b) => a + b, 0) / SMART_FIELDS.length;
  });
  const avgQuality = goalQualities.length ? goalQualities.reduce((a, b) => a + b, 0) / goalQualities.length : 0;
  const quality = avgQuality * 25;

  // --- Evidence (0-10) — placeholder ---
  const evidence = 0;

  // --- pointEvents — declared here so all event-based scores below can use them ---
  const today = new Date().toISOString().split('T')[0];
  const allEvents = data.pointEvents || [];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sevenDaysAgoStr  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sixMonthsAgoStr  = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // --- SMART Goals (0-15): 1 pt per fully-filled goal created (max 5/6 months) + 2 pts per approved completion (no decay) ---
  const smartCreationPts = Math.min(5,
    allEvents.filter(e => e.toolLabel === 'SMART Goal Created' && e.date >= sixMonthsAgoStr && e.points > 0).length
  );
  const smartCompletionPts = allEvents
    .filter(e => e.toolLabel === 'SMART Goal Completed' && e.points > 0)
    .reduce((s, e) => s + e.points, 0);
  const smartScore = Math.min(smartCreationPts + smartCompletionPts, 15);

  // --- Coaching Log (0-20): 5 pts per week with a complete session, last 4 weeks ---
  const coachingSessions = data.coachingSessions || [];
  const coachingScore = coachingLogScore(coachingSessions);

  // --- Problem Solving (0-20): 5Whys+Fishbone+A3, weekly cap, decay on non-use ---
  const psEntries = data.problemSolving || [];
  const psScore = problemSolvingScore(psEntries);

  // --- DISC Assessment (0-5): 5 pts, valid for 90 days from last assessment ---
  const discLastAt = data.discLastAssessmentAt?.seconds
    ? data.discLastAssessmentAt.seconds * 1000
    : null;
  const discDaysAgo = discLastAt ? Math.floor((Date.now() - discLastAt) / 86400000) : null;
  const discPoints = discLastAt && discDaysAgo <= 90 ? 5 : 0;

  // --- EQ Assessment (0-5): 3 pts for assessment + 2 pts for dev plan, both within 90 days ---
  const ninetyDaysAgoStr = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const eqHistory = data.eqHistory || [];
  const eqAssessmentPts = eqHistory.some(r => (r.savedAt || '').slice(0, 10) >= ninetyDaysAgoStr) ? 3 : 0;
  const eqDevPlanPts = data.eqDevPlan?.savedAt?.slice(0, 10) >= ninetyDaysAgoStr ? 2 : 0;
  const eqPoints = eqAssessmentPts + eqDevPlanPts;

  // --- pointEvents-based scores (allEvents declared above) ---

  // --- Mindfulness (0-2): today's points from pointEvents ---
  const mindfulnessPoints = Math.min(2,
    allEvents
      .filter(e => e.date === today && (e.toolLabel === 'Mindfulness' || e.toolLabel === 'Mindfulness Record') && e.points > 0)
      .reduce((s, e) => s + e.points, 0)
  );

  // --- Feedback Given (0-5): 1 pt per feedback given, rolling 30-day window ---
  const feedbackPoints = Math.min(5,
    allEvents
      .filter(e => e.toolLabel === 'Feedback Given' && e.date >= thirtyDaysAgoStr && e.points > 0)
      .length
  );

  // --- Actions Closed On Time (weekly): 5 pts per action closed on time, rolling 7-day window ---
  const actionsClosedPoints = allEvents
    .filter(e => e.toolLabel === 'Action Closed On Time' && e.date >= sevenDaysAgoStr && e.points > 0)
    .reduce((s, e) => s + e.points, 0);

  const total = Math.round(Math.max(0, Math.min(100,
    breadth + frequency + depth + quality + evidence + smartScore + coachingScore + psScore + discPoints + eqPoints + mindfulnessPoints + feedbackPoints + actionsClosedPoints + bonusPts - penaltyPts
  )));

  // Persist score to user doc
  await updateDoc(doc(db, 'users', uid), {
    calculatedScore: total,
    scoreBreakdown:  {},
    scoreUpdatedAt:  serverTimestamp(),
  });

  // Daily snapshot stored inside users/{uid}.scoreHistory array (max 90 entries)
  const existingHistory = data.scoreHistory || [];
  const filtered = existingHistory.filter(h => h.date !== today);

  const breakdown = {
    breadth:        Math.round(breadth),
    frequency:      Math.round(frequency),
    depth:          Math.round(depth),
    quality:        Math.round(quality),
    evidence:       Math.round(evidence),
    smart:          Math.round(smartScore),
    coaching:       Math.round(coachingScore),
    problemSolving: Math.round(psScore),
    disc:           Math.round(discPoints),
    eq:             Math.round(eqPoints),
    mindfulness:    Math.round(mindfulnessPoints),
    feedbackGiven:  Math.round(feedbackPoints),
    actionsClosed:  Math.round(actionsClosedPoints),
    bonus:          Math.round(bonusPts),
  };

  await updateDoc(doc(db, 'users', uid), { scoreBreakdown: breakdown });
  const updatedHistory = [{ date: today, score: total, breakdown }, ...filtered].slice(0, 90);
  await setDoc(doc(db, 'users', uid), { scoreHistory: updatedHistory }, { merge: true });

  return { total, breakdown };
}
