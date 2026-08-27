import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logPointEvent, calculateScore, localDateStr } from '../utils/scoring';
import { generateSkillsMatrixPDF } from '../utils/moduleReports';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function thirtyDayCutoff() {
  return localDateStr(new Date(Date.now() - THIRTY_DAYS_MS));
}

// Two-line trend chart — self-assessment (purple) vs peer-assessment (blue)
// average score (1-5) across the last 8 saved records, chronological.
function SkillsTrendChart({ history }) {
  const last8 = [...history]
    .sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt))
    .slice(-8);

  const W = 480, H = 200, PAD_L = 30, PAD_R = 16, PAD_T = 18, PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  if (last8.length === 0) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', textAlign: 'center', padding: '0 1rem' }}>
        No assessments saved yet — save a self or peer assessment to start your trend.
      </div>
    );
  }

  function px(i) { return last8.length === 1 ? PAD_L + chartW / 2 : PAD_L + (i / (last8.length - 1)) * chartW; }
  function py(v) { return PAD_T + chartH - (v / 5) * chartH; }

  const selfPts = last8.map((r, i) => (r.avgSelf != null ? [px(i), py(r.avgSelf)] : null)).filter(Boolean);
  const peerPts = last8.map((r, i) => (r.avgPeer != null ? [px(i), py(r.avgPeer)] : null)).filter(Boolean);

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9' }}>
          <span style={{ width: 14, height: 3, background: '#7c3aed', borderRadius: 2, display: 'inline-block' }} /> Self-Assessment
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, color: '#0f2044' }}>
          <span style={{ width: 14, height: 3, background: '#1d4ed8', borderRadius: 2, display: 'inline-block' }} /> Peer Assessment
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {[0, 1, 2, 3, 4, 5].map(tick => {
          const y = py(tick);
          return (
            <g key={tick}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{tick}</text>
            </g>
          );
        })}

        {selfPts.length > 0 && (
          <polyline points={selfPts.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {peerPts.length > 0 && (
          <polyline points={peerPts.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {selfPts.map(([x, y], i) => <circle key={`s${i}`} cx={x} cy={y} r="4" fill="white" stroke="#7c3aed" strokeWidth="2.5" />)}
        {peerPts.map(([x, y], i) => <circle key={`p${i}`} cx={x} cy={y} r="4" fill="white" stroke="#1d4ed8" strokeWidth="2.5" />)}

        {last8.map((r, i) => (
          <text key={r.id} x={px(i)} y={H - 6} textAnchor="middle" fontSize="9.5" fill="#94a3b8">
            {new Date(r.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}

        <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="#e2e8f0" strokeWidth="1" />
      </svg>
    </div>
  );
}

// self: 0 = not yet rated (RatingDots renders all dots empty, levelLabels[0] is
// blank) — a brand-new account should start with a clean, unrated matrix, not
// a pre-filled 3/5 "Proficient" average.
const defaultCategories = [
  { category: 'Leadership',    skills: [{ name: 'Strategic Thinking', self: 0, peer: 0 },{ name: 'Team Development', self: 0, peer: 0 },{ name: 'Decision Making', self: 0, peer: 0 },{ name: 'Communication', self: 0, peer: 0 }] },
  { category: 'Technical',     skills: [{ name: 'Lean Principles', self: 0, peer: 0 },{ name: 'Data Analysis', self: 0, peer: 0 },{ name: 'Root Cause Analysis', self: 0, peer: 0 },{ name: 'Project Management', self: 0, peer: 0 }] },
  { category: 'Interpersonal', skills: [{ name: 'Conflict Resolution', self: 0, peer: 0 },{ name: 'Coaching & Mentoring', self: 0, peer: 0 },{ name: 'Emotional Intelligence', self: 0, peer: 0 },{ name: 'Active Listening', self: 0, peer: 0 }] },
];

const levelLabels = ['','Novice','Developing','Proficient','Advanced','Expert'];
const catColors = { Leadership: '#0f2044', Technical: '#0891b2', Interpersonal: '#8b5cf6' };

// Skill library: suggested skills per category, each with a proficiency guide
// (what the skill means + what a 1 and a 5 look like on the job).
const SKILL_LIBRARY = {
  Leadership: [
    { name: 'Strategic Thinking', guide: { what: 'Seeing beyond today\'s tasks — connecting daily decisions to long-term direction, anticipating obstacles, and positioning the team for what comes next.', low: 'Reacts day to day. Decisions are made in isolation without considering downstream impact; surprised by predictable problems.', high: 'Consistently links team priorities to company direction, anticipates risks quarters ahead, and adjusts plans before problems arrive.' } },
    { name: 'Team Development', guide: { what: 'Growing the capability of your people — identifying potential, creating stretch opportunities, and building successors.', low: 'Does the work themselves rather than developing others; team skills stay flat year over year.', high: 'Every team member has a visible growth path; regularly promotes people and has a ready successor for their own role.' } },
    { name: 'Decision Making', guide: { what: 'Choosing well under uncertainty — gathering just enough information, weighing trade-offs, deciding promptly, and owning the outcome.', low: 'Avoids or delays decisions, escalates everything, or decides impulsively without weighing consequences.', high: 'Makes timely, well-reasoned calls even with incomplete data; explains the why, commits fully, and course-corrects fast when wrong.' } },
    { name: 'Communication', guide: { what: 'Delivering messages that land — clear, adapted to the audience, timely, and two-directional.', low: 'Messages are confusing or late; the team frequently discovers changes second-hand and misunderstands priorities.', high: 'People always know what matters, why, and what\'s expected; adapts style from shop floor to boardroom effortlessly.' } },
    { name: 'Delegation', guide: { what: 'Assigning the right work to the right people with clear expectations — transferring ownership, not just tasks.', low: 'Keeps all meaningful work; when they do hand off, instructions are vague and they take the task back at the first stumble.', high: 'Matches work to each person\'s growth edge, sets crisp expectations and check-in points, and lets people own the result.' } },
    { name: 'Change Management', guide: { what: 'Leading people through transitions — building the case for change, managing resistance, and sustaining new behaviors.', low: 'Announces changes and expects compliance; is caught off guard by resistance and lets initiatives quietly die.', high: 'Builds genuine buy-in early, names resistance openly and works it through, and keeps changes alive until they stick.' } },
    { name: 'Accountability & Follow-Up', guide: { what: 'Ensuring commitments are kept — yours and the team\'s — through consistent follow-up and honest performance conversations.', low: 'Misses own commitments; lets team deadlines slide silently and avoids uncomfortable performance conversations.', high: 'Every commitment has an owner and a date; follows up predictably, addresses slippage the day it happens, respectfully and directly.' } },
    { name: 'Vision Setting', guide: { what: 'Painting a compelling picture of where the team is going and making it meaningful for every role.', low: 'Team members can\'t say what the team is trying to achieve beyond this week\'s tasks.', high: 'Everyone on the team can articulate the destination, why it matters, and how their own work moves it forward.' } },
  ],
  Technical: [
    { name: 'Lean Principles', guide: { what: 'Applying waste elimination, flow, and pull thinking to daily operations.', low: 'Cannot identify the 8 wastes on their own line; improvement is something other people do.', high: 'Sees waste instinctively, teaches lean thinking to others, and has led measurable flow improvements.' } },
    { name: 'Data Analysis', guide: { what: 'Turning raw numbers into decisions — collecting the right data, spotting trends, and separating signal from noise.', low: 'Decisions rely on gut feel or anecdote; charts are read incorrectly or not at all.', high: 'Frames the question first, pulls the right data, spots the real trend, and changes decisions based on what it says.' } },
    { name: 'Root Cause Analysis', guide: { what: 'Digging past symptoms to the true cause using tools like 5 Whys and fishbone diagrams — so problems stay fixed.', low: 'Fixes symptoms; the same problems return monthly and firefighting is the norm.', high: 'Facilitates rigorous RCA that finds systemic causes; recurring problems actually stop recurring.' } },
    { name: 'Project Management', guide: { what: 'Delivering initiatives on time and on scope — planning, sequencing, tracking, and unblocking.', low: 'Projects drift without milestones; status is unknown until the deadline is already missed.', high: 'Scopes realistically, tracks visibly, surfaces risks early, and delivers on the date named at kickoff.' } },
    { name: 'Process Mapping', guide: { what: 'Documenting how work actually flows — making the invisible visible so it can be improved.', low: 'Cannot describe the end-to-end process they manage; documentation is missing or fictional.', high: 'Maps current state accurately with the people who do the work, and uses maps to drive redesigns that stick.' } },
    { name: 'KPI & Metrics Management', guide: { what: 'Choosing and using the few measures that matter — leading indicators, honest baselines, and visible tracking.', low: 'Tracks whatever is easy to measure; metrics exist but nobody acts on them.', high: 'A handful of well-chosen KPIs drive daily conversations; the team knows the numbers and what moves them.' } },
    { name: 'Standard Work', guide: { what: 'Establishing and maintaining the current best-known way to do each task — the foundation for improvement.', low: 'Every operator does it differently; quality depends on who showed up today.', high: 'Standards are documented, followed, audited, and improved — variation between people is minimal.' } },
    { name: 'Continuous Improvement (Kaizen)', guide: { what: 'Building the habit of small, constant improvement in yourself and the team.', low: 'Things are done the way they\'ve always been done; suggestions die in a drawer.', high: 'The team implements improvements weekly without being asked; small wins compound into major gains.' } },
  ],
  Interpersonal: [
    { name: 'Conflict Resolution', guide: { what: 'Addressing disagreements directly and productively — getting to the real issue and preserving relationships.', low: 'Avoids conflict until it explodes, or wins arguments while losing people.', high: 'Surfaces tension early, hears both sides genuinely, and turns conflicts into stronger working agreements.' } },
    { name: 'Coaching & Mentoring', guide: { what: 'Developing others through questions and guided discovery rather than answers — building capability, not dependence.', low: 'Gives answers and instructions; people come back with the same questions repeatedly.', high: 'Asks questions that help people solve their own problems; direct reports visibly grow in judgment and confidence.' } },
    { name: 'Emotional Intelligence', guide: { what: 'Reading and managing your own emotions and accurately reading others — staying effective under pressure.', low: 'Blindsided by own reactions under stress; misses obvious signals that others are frustrated or disengaged.', high: 'Stays composed and deliberate under pressure; reads the room accurately and adjusts approach in real time.' } },
    { name: 'Active Listening', guide: { what: 'Listening to understand, not to reply — full attention, clarifying questions, and confirming what you heard.', low: 'Interrupts, multitasks during conversations, and walks away with a different message than was said.', high: 'People leave conversations feeling genuinely heard; restates and confirms before responding, and remembers what was said.' } },
    { name: 'Giving Feedback', guide: { what: 'Delivering specific, timely, actionable feedback — both reinforcing and corrective — that people can actually use.', low: 'Saves everything for the annual review, speaks in vague generalities, or avoids corrective feedback entirely.', high: 'Gives specific, behavior-based feedback within days, balanced between recognition and correction; people seek their input.' } },
    { name: 'Influence & Persuasion', guide: { what: 'Moving people without authority — building the case, finding shared interest, and earning genuine agreement.', low: 'Relies on hierarchy or gives up when told no; peers rarely change position based on their input.', high: 'Regularly wins support across departments through preparation, credibility, and framing that connects to others\' goals.' } },
    { name: 'Cross-Functional Collaboration', guide: { what: 'Working effectively across department lines — sharing information, aligning priorities, and solving jointly.', low: 'Protects silo interests; other departments learn about impacts after the fact.', high: 'Builds working relationships across functions before needing them; joint problems get solved without escalation.' } },
    { name: 'Recognition & Motivation', guide: { what: 'Noticing and reinforcing good work in ways that are meaningful to each individual.', low: 'Good work goes unmentioned; recognition, when it happens, is generic and feels hollow.', high: 'Catches people doing things right weekly, tailors recognition to the person, and the team\'s discretionary effort shows it.' } },
  ],
};

// Fast lookup: skill name → guide
const SKILL_GUIDES = {};
Object.values(SKILL_LIBRARY).forEach(list => list.forEach(s => { SKILL_GUIDES[s.name] = s.guide; }));

const GENERIC_GUIDE = {
  what: 'Rate how consistently and independently this skill is demonstrated on the job.',
  low: 'Novice — just beginning; needs guidance and supervision to apply this skill, and results are inconsistent.',
  high: 'Expert — a go-to reference others learn from; applies the skill instinctively in new situations with consistently strong results.',
};

// Collapsible "what does 1–5 mean" guide shown under each skill
function SkillGuide({ name }) {
  const [open, setOpen] = useState(false);
  const guide = SKILL_GUIDES[name] || GENERIC_GUIDE;
  return (
    <div style={{ marginBottom: open ? 10 : 6 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: '0.55rem', color: open ? '#0d9488' : '#94a3b8', transition: 'transform 0.18s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: open ? '#0d9488' : '#94a3b8' }}>What does 1–5 mean?</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>{guide.what}</p>
          <div style={{ borderLeft: '3px solid #ef4444', paddingLeft: 10 }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 800, color: '#dc2626', margin: '0 0 2px' }}>1 — Novice</p>
            <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{guide.low}</p>
          </div>
          <div style={{ borderLeft: '3px solid #22c55e', paddingLeft: 10 }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 800, color: '#15803d', margin: '0 0 2px' }}>5 — Expert</p>
            <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{guide.high}</p>
          </div>
          <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>2 = between novice and proficient · 3 = proficient with occasional guidance · 4 = advanced, others ask for help</p>
        </div>
      )}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RatingDots({ value, onChange, color }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => onChange && onChange(n)}
          style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${n <= value ? color : '#e2e8f0'}`, background: n <= value ? color : 'transparent', color: n <= value ? 'white' : '#cbd5e1', fontWeight: 700, fontSize: '0.75rem', cursor: onChange ? 'pointer' : 'default', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {n}
        </button>
      ))}
    </div>
  );
}

export default function Skills() {
  const { currentUser, userProfile } = useAuth();
  const [matrix, setMatrix] = useState(defaultCategories);
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newSkill, setNewSkill] = useState({ category: 'Leadership', name: '', self: 3 });
  const [history, setHistory] = useState([]);
  const [expandedRec, setExpandedRec] = useState(null);
  const [saving, setSaving] = useState(false);

  // Peer assessment
  const [team, setTeam] = useState([]);
  const [assessingUid, setAssessingUid] = useState('');
  const [peerRatings, setPeerRatings] = useState({});
  const [savingPeer, setSavingPeer] = useState(false);

  // Scoring: which skills points were earned in the last 30 days
  const [earned30, setEarned30] = useState({ self: false, requested: false, received: false });
  const [myRequest, setMyRequest] = useState(null); // { requestedAt, toUid, toName, status }
  const [requestTarget, setRequestTarget] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [reminding, setReminding] = useState(false);

  const isLeader = userProfile?.isAdmin || userProfile?.role === 'Leader' || userProfile?.role === 'Manager';

  useEffect(() => {
    async function load() {
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          // Repair accounts that got the old pre-filled matrix (every skill self:3,
          // peer:0) written to Firestore before it was ever actually assessed (no
          // skillsHistory saved) — reset to a clean, unrated matrix like a new account.
          const isUntouchedDefault = Array.isArray(data.skillsMatrix) && !data.skillsHistory?.length &&
            data.skillsMatrix.flatMap(c => c.skills || []).every(s => s.self === 3 && (s.peer || 0) === 0);
          if (isUntouchedDefault) {
            try { await setDoc(doc(db, 'users', currentUser.uid), { skillsMatrix: defaultCategories }, { merge: true }); } catch { /* ignore */ }
          } else if (data.skillsMatrix) {
            setMatrix(data.skillsMatrix);
          }
          if (data.skillsHistory) setHistory(data.skillsHistory);
          if (data.skillsPeerRequest) setMyRequest(data.skillsPeerRequest);

          const cutoff = thirtyDayCutoff();
          const events = (data.pointEvents || []).filter(e => e.date >= cutoff && e.points > 0);
          setEarned30({
            self:      events.some(e => e.toolLabel === 'Skills Self-Assessment'),
            requested: events.some(e => e.toolLabel === 'Skills Peer Survey Requested'),
            received:  events.some(e => e.toolLabel === 'Skills Peer Survey Received'),
          });
        }
      } catch (e) { console.error(e); }
    }
    load();
  }, [currentUser]);

  // Everyone loads company teammates: users pick who to request a survey from;
  // leaders (and anyone with an incoming request) can assess. Blind rating —
  // only skill names are ever shown.
  useEffect(() => {
    async function fetchTeam() {
      const companyId = userProfile?.companyId;
      if (!companyId || !currentUser) return;
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('companyId', '==', companyId)));
        const members = [];
        snap.forEach(d => {
          if (d.id === currentUser.uid) return;
          const u = d.data();
          members.push({
            uid: d.id,
            name: u.displayName || u.email || 'Unknown',
            matrix: u.skillsMatrix || defaultCategories,
            request: u.skillsPeerRequest || null,
          });
        });
        setTeam(members);
      } catch (e) { console.error(e); }
    }
    fetchTeam();
  }, [userProfile?.companyId, currentUser]);

  // Who can I assess? Leaders: anyone. Everyone else: teammates who requested ME.
  const assessableTeam = isLeader
    ? team
    : team.filter(m => m.request?.status === 'pending' && m.request?.toUid === currentUser?.uid);

  const assessee = team.find(t => t.uid === assessingUid) || null;
  const assesseeSkillCount = assessee ? assessee.matrix.flatMap(c => c.skills).length : 0;
  const peerRatedCount = Object.values(peerRatings).filter(v => v > 0).length;
  const allPeerRated = assessee && peerRatedCount === assesseeSkillCount && assesseeSkillCount > 0;

  function skillKey(cat, name) { return `${cat}|${name}`; }

  async function savePeerAssessment() {
    if (!assessee || !allPeerRated) return;
    setSavingPeer(true);
    try {
      const now = new Date().toISOString();
      const assessorName = userProfile?.displayName || userProfile?.email || 'Leader';

      // Re-read the teammate's doc fresh so we don't clobber concurrent changes
      const snap = await getDoc(doc(db, 'users', assessee.uid));
      const data = snap.exists() ? snap.data() : {};
      const theirMatrix = data.skillsMatrix || defaultCategories;

      const updatedMatrix = theirMatrix.map(cat => ({
        ...cat,
        skills: cat.skills.map(s => {
          const rating = peerRatings[skillKey(cat.category, s.name)];
          return rating > 0 ? { ...s, peer: rating, peerBy: assessorName, peerAt: now } : s;
        }),
      }));

      const ratedVals = Object.values(peerRatings).filter(v => v > 0);
      const avgPeerNow = +(ratedVals.reduce((a, b) => a + b, 0) / ratedVals.length).toFixed(1);
      const allTheirSkills = updatedMatrix.flatMap(c => c.skills);
      const avgSelfNow = allTheirSkills.length
        ? +(allTheirSkills.reduce((a, s) => a + s.self, 0) / allTheirSkills.length).toFixed(1) : 0;

      const record = {
        id: now,
        savedAt: now,
        type: 'peer',
        assessorName,
        avgSelf: avgSelfNow,
        avgPeer: avgPeerNow,
        snapshot: updatedMatrix.map(cat => ({
          category: cat.category,
          skills: cat.skills.map(s => ({ name: s.name, self: s.self, peer: s.peer || 0 })),
        })),
      };
      const theirHistory = [record, ...(data.skillsHistory || [])].slice(0, 12);

      // Close out their pending request (if any) now that a survey was delivered
      const updateDocFields = {
        skillsMatrix: updatedMatrix,
        skillsHistory: theirHistory,
      };
      if (data.skillsPeerRequest?.status === 'pending') {
        updateDocFields.skillsPeerRequest = { ...data.skillsPeerRequest, status: 'completed', completedAt: now, completedBy: assessorName };
      }
      await setDoc(doc(db, 'users', assessee.uid), updateDocFields, { merge: true });

      // Award the ASSESSED person +1 pt for receiving a peer survey, max once per 30 days
      const cutoff = thirtyDayCutoff();
      const theirEvents = (data.pointEvents || []).filter(e => e.date >= cutoff && e.points > 0);
      const alreadyReceived = theirEvents.some(e => e.toolLabel === 'Skills Peer Survey Received');
      if (!alreadyReceived) {
        const { awarded } = await logPointEvent(assessee.uid, {
          points: 1,
          toolLabel: 'Skills Peer Survey Received',
          reason: `Received a peer skills assessment from ${assessorName}`,
        });
        if (awarded) await calculateScore(assessee.uid);
      }

      toast.success(`Peer assessment saved for ${assessee.name} — they earned +1 pt for receiving it.`);
      setAssessingUid('');
      setPeerRatings({});
      // Refresh team so a re-open shows current state
      setTeam(t => t.map(m => m.uid === assessee.uid ? { ...m, matrix: updatedMatrix } : m));
    } catch (e) {
      console.error(e);
      toast.error('Save failed — check permissions');
    }
    setSavingPeer(false);
  }

  function updateSelf(catIdx, skillIdx, val) {
    setMatrix(m => m.map((cat, ci) => ci !== catIdx ? cat : { ...cat, skills: cat.skills.map((s, si) => si !== skillIdx ? s : { ...s, self: val }) }));
  }

  const allSkills = matrix.flatMap(c => c.skills);
  const avgSelf = allSkills.length ? +(allSkills.reduce((a, s) => a + s.self, 0) / allSkills.length).toFixed(1) : 0;
  const peerRated = allSkills.filter(s => s.peer > 0);
  const avgPeer = peerRated.length ? +(peerRated.reduce((a, s) => a + s.peer, 0) / peerRated.length).toFixed(1) : null;

  async function saveAssessment() {
    if (!currentUser) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const record = {
        id: now,
        savedAt: now,
        avgSelf,
        avgPeer,
        snapshot: matrix.map(cat => ({
          category: cat.category,
          skills: cat.skills.map(s => ({ name: s.name, self: s.self, peer: s.peer || 0 })),
        })),
      };
      const updatedHistory = [record, ...history].slice(0, 12);
      await setDoc(doc(db, 'users', currentUser.uid), {
        skillsMatrix: matrix,
        skillsHistory: updatedHistory,
      }, { merge: true });
      setHistory(updatedHistory);

      // +1 pt for completing the self-assessment, max once per 30 days
      if (!earned30.self) {
        const { awarded } = await logPointEvent(currentUser.uid, {
          points: 1,
          toolLabel: 'Skills Self-Assessment',
          reason: 'Completed skills development self-assessment',
        });
        if (awarded) {
          await calculateScore(currentUser.uid);
          setEarned30(p => ({ ...p, self: true }));
          toast.success('Assessment saved! +1 pt earned.', { duration: 4000 });
        } else {
          toast.success('Assessment saved');
        }
      } else {
        toast.success('Assessment saved (self-assessment point already earned this month)');
      }
    } catch (e) {
      console.error(e);
      toast.error('Save failed');
    }
    setSaving(false);
  }

  async function requestPeerSurvey() {
    if (!currentUser || !requestTarget) return;
    const target = team.find(t => t.uid === requestTarget);
    if (!target) return;
    setRequesting(true);
    try {
      const now = new Date().toISOString();
      const request = { requestedAt: now, toUid: target.uid, toName: target.name, status: 'pending' };
      await setDoc(doc(db, 'users', currentUser.uid), { skillsPeerRequest: request }, { merge: true });
      setMyRequest(request);
      setRequestTarget('');

      // +1 pt for requesting a peer survey, max once per 30 days
      if (!earned30.requested) {
        const { awarded } = await logPointEvent(currentUser.uid, {
          points: 1,
          toolLabel: 'Skills Peer Survey Requested',
          reason: `Requested a peer skills assessment from ${target.name}`,
        });
        if (awarded) {
          await calculateScore(currentUser.uid);
          setEarned30(p => ({ ...p, requested: true }));
          toast.success(`Request sent to ${target.name}! +1 pt earned.`, { duration: 4000 });
        } else {
          toast.success(`Request sent to ${target.name}`);
        }
      } else {
        toast.success(`Request sent to ${target.name} (request point already earned this month)`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Request failed');
    }
    setRequesting(false);
  }

  // Re-send the peer-assessment reminder email. Bumping remindedAt on the
  // pending request triggers the sendRequestEmails Cloud Function to email again.
  async function sendReminder() {
    if (!currentUser || myRequest?.status !== 'pending') return;
    setReminding(true);
    try {
      const now = new Date().toISOString();
      const updated = { ...myRequest, remindedAt: now };
      await setDoc(doc(db, 'users', currentUser.uid), { skillsPeerRequest: updated }, { merge: true });
      setMyRequest(updated);
      toast.success(`Reminder email sent to ${myRequest.toName}`);
    } catch (e) {
      console.error(e);
      toast.error('Could not send reminder');
    }
    setReminding(false);
  }

  async function addSkill(e) {
    e.preventDefault();
    const updated = matrix.map(cat => cat.category !== newSkill.category ? cat : { ...cat, skills: [...cat.skills, { name: newSkill.name, self: newSkill.self, peer: 0 }] });
    setMatrix(updated);
    setNewSkill({ category: 'Leadership', name: '', self: 3 });
    setShowAdd(false);
    try {
      if (currentUser) await setDoc(doc(db, 'users', currentUser.uid), { skillsMatrix: updated }, { merge: true });
      toast.success('Skill added');
    } catch (e) { console.error(e); toast.error('Save failed'); }
  }

  async function addSuggested(category, name) {
    const updated = matrix.map(cat => cat.category !== category ? cat : { ...cat, skills: [...cat.skills, { name, self: 3, peer: 0 }] });
    setMatrix(updated);
    try {
      if (currentUser) await setDoc(doc(db, 'users', currentUser.uid), { skillsMatrix: updated }, { merge: true });
      toast.success(`"${name}" added to ${category}`);
    } catch (e) { console.error(e); toast.error('Save failed'); }
  }

  const existingSkillNames = new Set(allSkills.map(s => s.name));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon="⭐" title="Skills Assessment — Awareness of Accountability" subtitle="Self-assessment and peer ratings across skill domains"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={editMode ? 'btn-primary' : 'btn-secondary'} disabled={saving}
              onClick={() => {
                if (editMode) saveAssessment();
                setEditMode(e => !e);
              }}>
              {editMode ? (saving ? 'Saving…' : '✓ Save Assessment') : '✏️ Edit'}
            </button>
            <button className="btn-secondary" onClick={() => generateSkillsMatrixPDF(matrix, { userName: currentUser?.displayName || '' })}>🖨️ PDF</button>
            <button className="btn-primary" onClick={() => setShowAdd(s => !s)}>+ Add Skill</button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
        <div className="stat-tile" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Avg Self-Assessment</p>
          <p style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0d9488', margin: 0 }}>{avgSelf}<span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 400 }}>/5</span></p>
        </div>
        <div className="stat-tile" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Avg Peer Rating</p>
          <p style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f2044', margin: 0 }}>{avgPeer ?? '—'}<span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 400 }}>/5</span></p>
        </div>
      </div>

      {/* Monthly skills points */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Skills pts this month: {[earned30.self, earned30.requested, earned30.received].filter(Boolean).length}/3
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Self-assessment', key: 'self' },
            { label: 'Survey requested', key: 'requested' },
            { label: 'Survey received', key: 'received' },
          ].map(({ label, key }) => (
            <span key={key} style={{
              padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700,
              background: earned30[key] ? '#f0fdf4' : '#f1f5f9',
              color: earned30[key] ? '#15803d' : '#94a3b8',
              border: `1px solid ${earned30[key] ? '#86efac' : '#e2e8f0'}`,
            }}>
              {earned30[key] ? '✓' : '○'} {label} +1
            </span>
          ))}
        </div>
      </div>

      {/* Request a peer assessment */}
      {team.length > 0 && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #0d9488' }}>
          <h3 style={{ fontWeight: 800, color: '#0f766e', margin: '0 0 4px', fontSize: '0.95rem' }}>🙋 Request a Peer Assessment</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Ask a teammate to rate your skills. +1 pt for requesting, and +1 more when they deliver it (each max once per month).
          </p>
          {myRequest?.status === 'pending' ? (
            <div style={{ padding: '0.625rem 1rem', borderRadius: 10, background: '#fefce8', border: '1px solid #fde047', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#a16207', fontWeight: 700, flex: 1, minWidth: 180 }}>
                ⏳ Waiting on {myRequest.toName} — requested {fmtDate(myRequest.requestedAt)}
                {myRequest.remindedAt && <span style={{ fontWeight: 500 }}> · last reminded {fmtDate(myRequest.remindedAt)}</span>}
              </span>
              <button onClick={sendReminder} disabled={reminding}
                style={{ background: '#ca8a04', color: 'white', border: 'none', borderRadius: 8, padding: '0.4rem 0.9rem', fontWeight: 700, fontSize: '0.78rem', cursor: reminding ? 'wait' : 'pointer', flexShrink: 0 }}>
                {reminding ? 'Sending…' : '🔔 Resend Email Reminder'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="input" value={requestTarget} onChange={e => setRequestTarget(e.target.value)} style={{ maxWidth: 280 }}>
                <option value="">Choose a teammate…</option>
                {team.map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}
              </select>
              <button className="btn-primary" onClick={requestPeerSurvey} disabled={requesting || !requestTarget}
                style={{ opacity: requestTarget ? 1 : 0.5 }}>
                {requesting ? 'Sending…' : 'Send Request (+1 pt)'}
              </button>
            </div>
          )}
          {myRequest?.status === 'completed' && (
            <p style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700, margin: '10px 0 0' }}>
              ✓ Last survey delivered by {myRequest.completedBy} on {fmtDate(myRequest.completedAt)}
            </p>
          )}
        </div>
      )}

      {/* Peer assessment panel — leaders see everyone; others see teammates who requested them */}
      {assessableTeam.length > 0 && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid #c4b5fd', background: '#faf5ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '1.1rem' }}>👥</span>
            <h3 style={{ fontWeight: 800, color: '#5b21b6', margin: 0, fontSize: '0.95rem' }}>Assess a Teammate</h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#7c3aed', margin: '0 0 12px', lineHeight: 1.5 }}>
            Rate each skill from your own observation. Their self-ratings are hidden on purpose — a blind rating is what makes the gap analysis honest.
          </p>

          <select className="input" value={assessingUid}
            onChange={e => { setAssessingUid(e.target.value); setPeerRatings({}); }}
            style={{ marginBottom: assessingUid ? 14 : 0, maxWidth: 360 }}>
            <option value="">Select a teammate…</option>
            {assessableTeam.map(m => (
              <option key={m.uid} value={m.uid}>
                {m.request?.status === 'pending' && m.request?.toUid === currentUser?.uid ? `🙋 ${m.name} (requested you)` : m.name}
              </option>
            ))}
          </select>

          {assessee && assesseeSkillCount === 0 && (
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>This teammate has no skills defined yet.</p>
          )}

          {assessee && assesseeSkillCount > 0 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {assessee.matrix.map(cat => (
                  <div key={cat.category} style={{ background: 'white', borderRadius: 12, border: '1px solid #e9d5ff', overflow: 'hidden' }}>
                    <div style={{ padding: '0.5rem 1rem', background: catColors[cat.category] || '#0f2044' }}>
                      <span style={{ color: 'white', fontWeight: 800, fontSize: '0.8rem' }}>{cat.category}</span>
                    </div>
                    {cat.skills.map((s, si) => {
                      const key = skillKey(cat.category, s.name);
                      return (
                        <div key={s.name} style={{ padding: '0.75rem 1rem', borderBottom: si < cat.skills.length - 1 ? '1px solid #f3e8ff' : 'none' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', margin: '0 0 6px' }}>{s.name}</p>
                          <SkillGuide name={s.name} />
                          <div style={{ display: 'grid', gridTemplateColumns: '42px auto', columnGap: 12, alignItems: 'center', justifyContent: 'start' }}>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peer</p>
                            <RatingDots value={peerRatings[key] || 0}
                              onChange={val => setPeerRatings(r => ({ ...r, [key]: val }))} color="#7c3aed" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: allPeerRated ? '#15803d' : '#7c3aed' }}>
                  {peerRatedCount}/{assesseeSkillCount} skills rated {allPeerRated ? '✓' : ''}
                </span>
                <button className="btn-primary" onClick={savePeerAssessment}
                  disabled={savingPeer || !allPeerRated}
                  style={{ background: '#7c3aed', borderColor: '#7c3aed', opacity: allPeerRated ? 1 : 0.5 }}>
                  {savingPeer ? 'Saving…' : `💾 Save Peer Assessment for ${assessee.name}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showAdd && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>Add New Skill</h3>
          <form onSubmit={addSkill} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <div><label className="label">Category</label><select className="input" value={newSkill.category} onChange={e => setNewSkill(f => ({ ...f, category: e.target.value }))}>{matrix.map(c => <option key={c.category}>{c.category}</option>)}</select></div>
            <div><label className="label">Skill Name</label><input className="input" required value={newSkill.name} onChange={e => setNewSkill(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Agile Methodology" /></div>
            <div><label className="label">Initial Rating</label><input className="input" type="number" min={1} max={5} value={newSkill.self} onChange={e => setNewSkill(f => ({ ...f, self: +e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">Add Skill</button>
              <button className="btn-secondary" type="button" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>

          {/* Suggested skills — tap to add */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px', fontSize: '0.85rem' }}>💡 Suggested Skills</h4>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>Tap any suggestion to add it to your matrix — each comes with a built-in proficiency guide.</p>
            {Object.entries(SKILL_LIBRARY).map(([category, list]) => {
              const available = list.filter(s => !existingSkillNames.has(s.name));
              if (available.length === 0) return null;
              return (
                <div key={category} style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 800, color: catColors[category] || '#0f2044', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{category}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {available.map(s => (
                      <button key={s.name} onClick={() => addSuggested(category, s.name)}
                        style={{ padding: '4px 12px', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                          background: 'white', color: catColors[category] || '#0f2044',
                          border: `1.5px solid ${catColors[category] || '#0f2044'}40` }}>
                        + {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {matrix.map((cat, ci) => (
          <div key={cat.category} className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1.25rem', background: catColors[cat.category] || '#0f2044', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>{cat.category}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{cat.skills.length} skills</span>
            </div>
            <div>
              {cat.skills.map((skill, si) => (
                <div key={skill.name} style={{ padding: '0.875rem 1.25rem', borderBottom: si < cat.skills.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {/* Line 1: name + level on the left, badges on the right */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0 0 2px' }}>{skill.name}</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>{levelLabels[skill.self]}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {skill.self > skill.peer && skill.peer > 0 && <span className="badge-yellow">Gap</span>}
                      {skill.peer > skill.self && <span className="badge-green" style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 700 }}>Hidden Strength</span>}
                      {skill.self < 3 && <span className="badge-red">Develop</span>}
                    </div>
                  </div>
                  <SkillGuide name={skill.name} />
                  {/* Line 2: ratings in a fixed-width label grid — identical left edge on every row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '42px auto', columnGap: 12, rowGap: 8, alignItems: 'center', justifyContent: 'start' }}>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Self</p>
                    <RatingDots value={skill.self} onChange={editMode ? val => updateSelf(ci, si, val) : null} color="#0d9488" />
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peer</p>
                    {skill.peer > 0
                      ? <div>
                          <RatingDots value={skill.peer} color="#0f2044" />
                          {skill.peerBy && (
                            <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '3px 0 0' }}>
                              by {skill.peerBy}{skill.peerAt ? ` · ${new Date(skill.peerAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                            </p>
                          )}
                        </div>
                      : <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>Awaiting peer assessment</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart — last 8 assessments, self vs peer */}
      {history.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginTop: '1.5rem' }}>
          <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', fontSize: '0.9rem' }}>Score Trend — Last 8 Assessments</h4>
          <SkillsTrendChart history={history} />
        </div>
      )}

      {/* Assessment records */}
      {history.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginTop: '1.5rem' }}>
          <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.9rem' }}>Assessment Records</h4>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>Every saved assessment with its date — tap one to see the full snapshot</p>
          <style>{`
            .skills-rec-scroll::-webkit-scrollbar { width: 8px; -webkit-appearance: none; }
            .skills-rec-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 8px; }
            .skills-rec-scroll::-webkit-scrollbar-thumb { background: #64748b; border-radius: 8px; border: 1px solid #e2e8f0; }
          `}</style>
          <div className="skills-rec-scroll" style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            maxHeight: 420, overflowY: history.length > 4 ? 'scroll' : 'visible',
            paddingRight: 6,
            scrollbarWidth: 'thin', scrollbarColor: '#64748b #e2e8f0',
          }}>
            {history.map((rec, i) => {
              const prev = history[i + 1];
              const delta = prev ? +(rec.avgSelf - prev.avgSelf).toFixed(1) : null;
              return (
                <div key={rec.id} style={{ borderRadius: 10, border: `1px solid ${i === 0 ? '#99f6e4' : '#e2e8f0'}`, overflow: 'hidden', flexShrink: 0 }}>
                  <button onClick={() => setExpandedRec(expandedRec === rec.id ? null : rec.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0.65rem 0.875rem', background: i === 0 ? '#f0fdfa' : '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {i === 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#0d9488', color: 'white', padding: '1px 7px', borderRadius: 9999 }}>Latest</span>}
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: 9999,
                          background: rec.type === 'peer' ? '#ede9fe' : '#f0fdfa',
                          color: rec.type === 'peer' ? '#7c3aed' : '#0d9488' }}>
                          {rec.type === 'peer' ? `👥 Peer · ${rec.assessorName || 'Leader'}` : 'Self'}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtDate(rec.savedAt)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', color: '#0d9488', fontWeight: 700 }}>Self: {rec.avgSelf}/5</span>
                        <span style={{ fontSize: '0.72rem', color: '#0f2044', fontWeight: 700 }}>Peer: {rec.avgPeer ?? '—'}/5</span>
                        {delta !== null && delta !== 0 && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: delta > 0 ? '#15803d' : '#dc2626' }}>
                            {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`} vs previous
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', flexShrink: 0 }}>{expandedRec === rec.id ? '▲' : '▼'}</span>
                  </button>
                  {expandedRec === rec.id && (
                    <div style={{ padding: '0.75rem 0.875rem', background: 'white', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(rec.snapshot || []).map(cat => (
                        <div key={cat.category}>
                          <p style={{ fontSize: '0.7rem', fontWeight: 800, color: catColors[cat.category] || '#0f2044', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.category}</p>
                          {cat.skills.map(s => (
                            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0', borderBottom: '1px dashed #f1f5f9' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.name}</span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', flexShrink: 0 }}>
                                Self {s.self} · Peer {s.peer || '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
