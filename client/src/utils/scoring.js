import { collection, query, where, getDocs, getDoc, setDoc, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

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

const CATEGORY_META = {
  breadth:   { label: 'Tool Diversity',  tool: 'App Usage',     gainReason: 'You used more tools across the app',            lossReason: 'Fewer distinct tools used recently' },
  frequency: { label: 'Consistency',     tool: 'App Usage',     gainReason: 'More sessions logged in the last 30 days',      lossReason: 'Fewer sessions in the last 30 days' },
  depth:     { label: 'Session Depth',   tool: 'App Usage',     gainReason: 'Spending more quality time per session',        lossReason: 'Sessions are shorter on average' },
  quality:   { label: 'Entry Quality',   tool: 'SMART Goals',   gainReason: 'SMART goal entries are more detailed',          lossReason: 'SMART goal entries are less complete' },
  smart:     { label: 'SMART Goals',     tool: 'SMART Goals',   gainReason: 'More active or completed SMART goals',          lossReason: 'Fewer active or completed SMART goals' },
  evidence:  { label: 'Evidence & AI',   tool: 'Evidence',      gainReason: 'Evidence attachments improved',                 lossReason: 'Evidence score decreased' },
};

function depthMultiplier(seconds) {
  if (seconds < 60)   return 0;
  if (seconds < 180)  return 0.2;
  if (seconds < 600)  return 0.6;
  if (seconds < 1800) return 1.0;
  return 1.2;
}

function fieldQuality(text = '') {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0)  return 0;
  if (words < 5)    return 0.3;
  if (words < 15)   return 0.6;
  if (words < 30)   return 0.85;
  return 1.0;
}

export async function logPointEvent(uid, { points, tool, toolLabel, reason, date }) {
  const today = date || new Date().toISOString().split('T')[0];
  await addDoc(collection(db, 'pointsLog'), {
    uid,
    points,
    tool,
    toolLabel,
    reason,
    date: today,
    createdAt: serverTimestamp(),
  });
}

export async function calculateScore(uid) {
  const [sessionsSnap, goalsSnap, userSnap] = await Promise.all([
    getDocs(query(collection(db, 'toolSessions'), where('uid', '==', uid))),
    getDocs(query(collection(db, 'smartGoals'),   where('uid', '==', uid))),
    getDoc(doc(db, 'users', uid)),
  ]);

  const sessions   = sessionsSnap.docs.map(d => d.data());
  const goals      = goalsSnap.docs.map(d => d.data());
  const penaltyPts = userSnap.data()?.penaltyPoints || 0;

  // --- Breadth (0-20) ---
  const uniqueTools = new Set(sessions.map(s => s.tool));
  const breadth = Math.min((uniqueTools.size / TOTAL_TOOLS) * 20 * 1.5, 20);

  // --- Frequency (0-20) ---
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSessions = sessions.filter(s => s.openedAt >= thirtyDaysAgo);
  const frequency = Math.min((recentSessions.length / 20) * 20, 20);

  // --- Depth (0-15) ---
  const depthScores = sessions.map(s => depthMultiplier(s.durationSeconds || 0));
  const avgDepth = depthScores.length ? depthScores.reduce((a, b) => a + b, 0) / depthScores.length : 0;
  const depth = avgDepth * 15;

  // --- Quality (0-25) ---
  const SMART_FIELDS = ['specific', 'measurable', 'achievable', 'relevant', 'timeBound'];
  const goalQualities = goals.map(g => {
    const scores = SMART_FIELDS.map(f => fieldQuality(g[f] || ''));
    return scores.reduce((a, b) => a + b, 0) / SMART_FIELDS.length;
  });
  const avgQuality = goalQualities.length ? goalQualities.reduce((a, b) => a + b, 0) / goalQualities.length : 0;
  const quality = avgQuality * 25;

  // --- Evidence (0-10) ---
  const evidence = 0;

  // --- SMART Goals (0-10) ---
  const activeGoals    = goals.filter(g => g.status === 'active').length;
  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const smartScore = Math.min(activeGoals * 2 + completedGoals * 4, 10);

  const total = Math.round(Math.max(0, Math.min(100, breadth + frequency + depth + quality + evidence + smartScore - penaltyPts)));

  const breakdown = {
    breadth:   Math.round(breadth),
    frequency: Math.round(frequency),
    depth:     Math.round(depth),
    quality:   Math.round(quality),
    evidence:  Math.round(evidence),
    smart:     Math.round(smartScore),
  };

  // Persist to user doc
  await updateDoc(doc(db, 'users', uid), {
    calculatedScore: total,
    scoreBreakdown: breakdown,
    scoreUpdatedAt: serverTimestamp(),
  });

  // Daily snapshot (upsert — one per day)
  const today = new Date().toISOString().split('T')[0];
  const snapRef = doc(db, 'scoreHistory', `${uid}_${today}`);
  const prevSnap = await getDoc(snapRef);
  const prevBreakdown = prevSnap.exists() ? prevSnap.data().breakdown : null;

  await setDoc(snapRef, { uid, score: total, breakdown, date: today, savedAt: serverTimestamp() }, { merge: true });

  // Log individual point events by comparing to previous breakdown
  if (prevBreakdown) {
    const logPromises = [];
    for (const key of Object.keys(breakdown)) {
      const delta = breakdown[key] - (prevBreakdown[key] || 0);
      if (delta !== 0) {
        const meta = CATEGORY_META[key];
        logPromises.push(logPointEvent(uid, {
          points: delta,
          tool: meta.tool,
          toolLabel: meta.label,
          reason: delta > 0 ? meta.gainReason : meta.lossReason,
          date: today,
        }));
      }
    }
    await Promise.all(logPromises);
  }

  return { total, breakdown };
}
