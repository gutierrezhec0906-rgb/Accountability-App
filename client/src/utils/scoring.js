import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// All trackable tools and their weights (1=light, 2=medium, 3=heavy)
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

// Score breakdown: 0-100
// Breadth:   0-20  (diversity of tools used)
// Frequency: 0-20  (regularity of use over time)
// Depth:     0-15  (session duration quality)
// Quality:   0-25  (entry completeness in SMART goals & other tools)
// Evidence:  0-10  (entries with attachments — placeholder, ready for AI)
// SMART:     0-10  (active/completed SMART goals)

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

export async function calculateScore(uid) {
  const [sessionsSnap, goalsSnap] = await Promise.all([
    getDocs(query(collection(db, 'toolSessions'), where('uid', '==', uid))),
    getDocs(query(collection(db, 'smartGoals'),   where('uid', '==', uid))),
  ]);

  const sessions = sessionsSnap.docs.map(d => d.data());
  const goals    = goalsSnap.docs.map(d => d.data());

  // --- Breadth (0-20) ---
  const uniqueTools = new Set(sessions.map(s => s.tool));
  const breadth = Math.min((uniqueTools.size / TOTAL_TOOLS) * 20 * 1.5, 20);

  // --- Frequency (0-20): target 20 meaningful sessions / 30 days ---
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSessions = sessions.filter(s => s.openedAt >= thirtyDaysAgo);
  const frequency = Math.min((recentSessions.length / 20) * 20, 20);

  // --- Depth (0-15): average session quality by duration ---
  const depthScores = sessions.map(s => depthMultiplier(s.durationSeconds || 0));
  const avgDepth = depthScores.length ? depthScores.reduce((a, b) => a + b, 0) / depthScores.length : 0;
  const depth = avgDepth * 15;

  // --- Quality (0-25): from SMART goal field completeness ---
  const SMART_FIELDS = ['specific', 'measurable', 'achievable', 'relevant', 'timeBound'];
  const goalQualities = goals.map(g => {
    const scores = SMART_FIELDS.map(f => fieldQuality(g[f] || ''));
    return scores.reduce((a, b) => a + b, 0) / SMART_FIELDS.length;
  });
  const avgQuality = goalQualities.length ? goalQualities.reduce((a, b) => a + b, 0) / goalQualities.length : 0;
  const quality = avgQuality * 25;

  // --- Evidence (0-10): placeholder, ready for attachment/AI phase ---
  const evidence = 0;

  // --- SMART Goals (0-10) ---
  const activeGoals    = goals.filter(g => g.status === 'active').length;
  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const smartScore = Math.min(activeGoals * 2 + completedGoals * 4, 10);

  const total = Math.round(Math.min(100, breadth + frequency + depth + quality + evidence + smartScore));

  const breakdown = {
    breadth:   Math.round(breadth),
    frequency: Math.round(frequency),
    depth:     Math.round(depth),
    quality:   Math.round(quality),
    evidence:  Math.round(evidence),
    smart:     Math.round(smartScore),
  };

  // Persist calculated score to Firestore user doc
  await updateDoc(doc(db, 'users', uid), {
    calculatedScore: total,
    scoreBreakdown: breakdown,
    scoreUpdatedAt: serverTimestamp(),
  });

  return { total, breakdown };
}
