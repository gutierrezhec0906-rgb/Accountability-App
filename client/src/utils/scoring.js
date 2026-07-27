import { getDoc, setDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const DAILY_POINTS_CAP = 25;

// Local calendar date as YYYY-MM-DD. NOT UTC: `new Date().toISOString()` returns
// the UTC date, so in the evening for users west of UTC (e.g. US timezones) events
// were being stamped as "tomorrow". This shifts by the local offset so the date
// matches the user's wall clock. Use this everywhere a point-event date is written
// or compared, so storage, gating, and display all agree.
export function localDateStr(d = new Date()) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().split('T')[0];
}

// Appends a point event to users/{uid}.pointEvents (max 200 entries).
// Returns { awarded: boolean, capReached: boolean, todayTotal: number }
// If the user has already earned DAILY_POINTS_CAP points today, the event
// is NOT written and awarded=false is returned so callers can show a message.
export async function logPointEvent(uid, { points, toolLabel, reason }) {
  if (!uid) return { awarded: false, capReached: false, todayTotal: 0 };
  const today = localDateStr();
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

// Map a pointEvent.toolLabel to a tool key (keys match TOOL_WEIGHTS), so activity
// that earned points counts toward tool diversity even without a recorded visit.
// Matched against the ACTUAL toolLabel strings logPointEvent is called with across
// the app (checked against every pages/*.jsx call site) — do not guess prefixes,
// verify against real labels, or entries silently fail to map (e.g. "Leadership
// Quotes" does not start with "quote"; "Personal Vision" does not start with "vision").
export function toolKeyFromLabel(label = '') {
  const l = label.toLowerCase();
  if (l.includes('smart goal')) return 'smart-goals';
  if (l.includes('urgency')) return 'urgency';
  if (l.includes('skills')) return 'skills';
  if (l.includes('career')) return 'career';
  if (l.includes('lean') || l.includes('waste')) return 'lean';
  if (l.includes('feedback')) return 'feedback';
  if (l.includes('mindfulness')) return 'mindfulness';
  if (l.includes('action closed') || l.includes('visual board') || l.includes('quick action')) return 'visual-board';
  if (l.includes('coaching')) return 'coaching';
  if (l.includes('problem') || l.includes('5 why') || l.includes('fishbone') || l.includes('a3')) return 'problem-solving';
  if (l.includes('disc')) return 'disc';
  if (l.includes('eq assessment') || l.includes('eq development') || l.includes('eq opex') || l.includes('opex')) return 'eq-opex';
  if (l.includes('vision')) return 'vision';
  if (l.includes('mentor')) return 'mentoring';
  if (l.includes('training')) return 'training';
  if (l.includes('quote')) return 'quotes';
  if (l.includes('line of balance') || l.includes('lob')) return 'lob';
  return null;
}

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

// A mentoring session counts as "logged in its totality" — earning +5 pts —
// when the date, progress review, challenge, and action item are all filled in.
export function isCompleteMentoringSession(s) {
  return !!(s.date && (s.progressReview || '').trim() && (s.challenge || '').trim() && (s.actionItem || '').trim());
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

  // --- Breadth (0-20): distinct tools used. Counts tool visits (toolSessions) UNION
  //     tools inferred from point-earning activity (pointEvents), so active use counts
  //     even when a visit wasn't recorded as a session. ---
  const toolSessions = data.toolSessions || [];
  const uniqueTools  = new Set(toolSessions.map(s => s.tool).filter(Boolean));
  (data.pointEvents || []).forEach(e => {
    const key = toolKeyFromLabel(e.toolLabel || '');
    if (key) uniqueTools.add(key);
  });
  const breadth = Math.min((uniqueTools.size / TOTAL_TOOLS) * 20 * 1.5, 20);

  // --- Frequency (0-20): sessions in last 30 days ---
  const thirtyDaysAgo   = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSessions  = toolSessions.filter(s => (s.openedAt || 0) >= thirtyDaysAgo);
  const frequency = Math.min((recentSessions.length / 20) * 20, 20);

  // --- Quality (0-25): SMART goal entry completeness ---
  const goals = data.smartGoals || [];
  const SMART_FIELDS = ['specific', 'measurable', 'achievable', 'relevant', 'timeBound'];
  const goalQualities = goals.map(g => {
    const scores = SMART_FIELDS.map(f => fieldQuality(g[f] || ''));
    return scores.reduce((a, b) => a + b, 0) / SMART_FIELDS.length;
  });
  const avgQuality = goalQualities.length ? goalQualities.reduce((a, b) => a + b, 0) / goalQualities.length : 0;
  const quality = avgQuality * 25;

  // --- pointEvents — declared here so all event-based scores below can use them ---
  const today = localDateStr();
  const allEvents = data.pointEvents || [];
  const thirtyDaysAgoStr = localDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const sevenDaysAgoStr  = localDateStr(new Date(Date.now() -  7 * 24 * 60 * 60 * 1000));
  const sixMonthsAgoStr  = localDateStr(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000));

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
  const ninetyDaysAgoStr = localDateStr(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
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

  // --- Mentoring (0-20): +5 pts per fully-logged session (date, progress review,
  //     challenge, and action item all filled) — no decay, capped for display scale ---
  const mentoringPoints = Math.min(20, allEvents
    .filter(e => e.toolLabel === 'Mentoring Session Logged' && e.points > 0)
    .reduce((s, e) => s + e.points, 0));

  // --- Skills Development (0-3): self-assessment +1, peer survey requested +1, peer survey received +1 — each max once per rolling 30 days ---
  const SKILLS_LABELS = ['Skills Self-Assessment', 'Skills Peer Survey Requested', 'Skills Peer Survey Received'];
  const skillsPoints = SKILLS_LABELS.reduce((sum, label) =>
    sum + (allEvents.some(e => e.toolLabel === label && e.date >= thirtyDaysAgoStr && e.points > 0) ? 1 : 0), 0);

  // --- Lean 5S (0-5): 5 pts for a weekly 5S audit with 3+ described areas of opportunity.
  //     Rolling 7-day window — the points expire after a week unless a new audit is saved. ---
  const lean5sPoints = allEvents.some(e => e.toolLabel === 'Lean 5S Audit' && e.date >= sevenDaysAgoStr && e.points > 0) ? 5 : 0;

  // --- Waste Walk (0-5): +1 per DISTINCT waste category logged in the rolling 7-day
  //     window, capped at 5. Points expire after a week — re-log fresh wastes to keep them. ---
  const wasteLogs = data.wasteLogs || [];
  const wasteTypesThisWeek = new Set(
    wasteLogs.filter(l => (l.date || '') >= sevenDaysAgoStr && l.type).map(l => l.type)
  );
  const wastePoints = Math.min(5, wasteTypesThisWeek.size);

  // --- Career Development (0-10): 10 pts for a fully completed plan (100% of template,
  //     min 20 words per question). Sustained by milestone progress notes — the leader must
  //     return at each checkpoint and log notes or the points decay:
  //       missing 30-day note after 30 days  → −5   (10 → 5)
  //       missing 90-day note after 90 days  → −3   (5 → 2)
  //       missing 6-month note after 180 days → −2  (2 → 0)
  //     Filling a milestone note (even late) restores that milestone's points. ---
  const cp = data.careerPlan;
  let careerPoints = 0;
  if (cp && cp.completedAt) {
    const daysSince = (Date.now() - new Date(cp.completedAt).getTime()) / 86400000;
    const noteFilled = (k) => ((cp.checkIns && cp.checkIns[k] && cp.checkIns[k].note) || '').trim().length > 0;
    let pts = 10;
    if (daysSince >= 30  && !noteFilled('d30')) pts -= 2;
    if (daysSince >= 90  && !noteFilled('d90')) pts -= 3;
    if (daysSince >= 180 && !noteFilled('m6'))  pts -= 2;
    if (daysSince >= 365 && !noteFilled('m12')) pts = 0;
    careerPoints = Math.max(0, pts);
  }

  // --- Sense of Urgency (0-20): 4 pts/day max (ind survey + ind reflection + team survey + team reflection)
  //     rolling 7-day window, 4 pts/day × 5 active days = 20 pt ceiling
  const URGENCY_LABELS = ['Urgency Individual Survey', 'Urgency Individual Reflection', 'Urgency Team Survey', 'Urgency Team Reflection'];
  const urgencyPoints = Math.min(20,
    allEvents
      .filter(e => URGENCY_LABELS.includes(e.toolLabel) && e.date >= sevenDaysAgoStr && e.points > 0)
      .reduce((s, e) => s + e.points, 0)
  );

  // --- Line of Balance (0-8): +1 setup (4+ tasks & 4+ dates), +5 full completion
  //     (every activity 100%), +2 on-time bonus (completed with no past-due slips).
  //     Permanent achievement points (no decay); capped at 8. ---
  const LOB_LABELS = ['Line of Balance Setup', 'Line of Balance Completed', 'Line of Balance On-Time Bonus'];
  const lobPoints = Math.min(8,
    allEvents
      .filter(e => LOB_LABELS.includes(e.toolLabel) && e.points > 0)
      .reduce((s, e) => s + e.points, 0)
  );

  // --- Vision (0-20) & Leadership Quotes (0-20): these points are stored inside
  //     bonusPoints, but we surface them as their own breakdown rows (Spark the
  //     Vision / Winning with Compassion) and subtract them from the leftover
  //     "bonus" so the total is unchanged. ---
  const VISION_LABELS = ['Personal Vision', 'Team Vision'];
  const visionScore = Math.min(20,
    allEvents.filter(e => VISION_LABELS.includes(e.toolLabel) && e.points > 0).reduce((s, e) => s + e.points, 0)
  );
  const quotesScore = Math.min(20,
    allEvents.filter(e => e.toolLabel === 'Leadership Quotes' && e.points > 0).reduce((s, e) => s + e.points, 0)
  );
  const bonusRemaining = Math.max(0, bonusPts - visionScore - quotesScore);

  const total = Math.round(Math.max(0, Math.min(100,
    breadth + frequency + quality + smartScore + coachingScore + psScore + discPoints + eqPoints + mindfulnessPoints + feedbackPoints + actionsClosedPoints + mentoringPoints + urgencyPoints + skillsPoints + lean5sPoints + wastePoints + careerPoints + lobPoints + bonusPts - penaltyPts
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
    quality:        Math.round(quality),
    smart:          Math.round(smartScore),
    coaching:       Math.round(coachingScore),
    problemSolving: Math.round(psScore),
    disc:           Math.round(discPoints),
    eq:             Math.round(eqPoints),
    mindfulness:    Math.round(mindfulnessPoints),
    feedbackGiven:  Math.round(feedbackPoints),
    actionsClosed:  Math.round(actionsClosedPoints),
    mentoring:      Math.round(mentoringPoints),
    urgency:        Math.round(urgencyPoints),
    skills:         Math.round(skillsPoints),
    lean5s:         Math.round(lean5sPoints),
    waste:          Math.round(wastePoints),
    career:         Math.round(careerPoints),
    lob:            Math.round(lobPoints),
    vision:         Math.round(visionScore),
    quotes:         Math.round(quotesScore),
    bonus:          Math.round(bonusRemaining),
  };

  await updateDoc(doc(db, 'users', uid), { scoreBreakdown: breakdown });
  const updatedHistory = [{ date: today, score: total, breakdown }, ...filtered].slice(0, 90);
  await setDoc(doc(db, 'users', uid), { scoreHistory: updatedHistory }, { merge: true });

  return { total, breakdown };
}
