import { getDoc, setDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Appends a point event to users/{uid}.pointEvents (max 200 entries).
// { date, points, toolLabel, reason }
export async function logPointEvent(uid, { points, toolLabel, reason }) {
  if (!uid) return;
  const today = new Date().toISOString().split('T')[0];
  const event = { date: today, points, toolLabel, reason };
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const existing = snap.exists() ? (snap.data().pointEvents || []) : [];
    const updated = [event, ...existing].slice(0, 200);
    await setDoc(doc(db, 'users', uid), { pointEvents: updated }, { merge: true });
  } catch {}
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

  // --- SMART Goals (0-10): active + completed counts ---
  const activeGoals    = goals.filter(g => g.status === 'active').length;
  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const smartScore = Math.min(activeGoals * 2 + completedGoals * 4, 10);

  // --- Coaching Log (0-20): 5 pts per week with a complete session, last 4 weeks ---
  const coachingSessions = data.coachingSessions || [];
  const coachingScore = coachingLogScore(coachingSessions);

  const total = Math.round(Math.max(0, Math.min(100,
    breadth + frequency + depth + quality + evidence + smartScore + coachingScore + bonusPts - penaltyPts
  )));

  const breakdown = {
    breadth:   Math.round(breadth),
    frequency: Math.round(frequency),
    depth:     Math.round(depth),
    quality:   Math.round(quality),
    evidence:  Math.round(evidence),
    smart:     Math.round(smartScore),
    coaching:  Math.round(coachingScore),
    bonus:     Math.round(bonusPts),
  };

  // Persist score to user doc
  await updateDoc(doc(db, 'users', uid), {
    calculatedScore: total,
    scoreBreakdown:  breakdown,
    scoreUpdatedAt:  serverTimestamp(),
  });

  // Daily snapshot stored inside users/{uid}.scoreHistory array (max 90 entries)
  const today = new Date().toISOString().split('T')[0];
  const existingHistory = data.scoreHistory || [];
  const filtered = existingHistory.filter(h => h.date !== today);
  const updatedHistory = [{ date: today, score: total, breakdown }, ...filtered].slice(0, 90);
  await setDoc(doc(db, 'users', uid), { scoreHistory: updatedHistory }, { merge: true });

  return { total, breakdown };
}
