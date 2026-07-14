import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, getFirestore } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase';
import toast from 'react-hot-toast';
import { GUIDE_LEVELS, QUESTIONS as SHARED_QUESTIONS } from '../utils/assessmentQuestions';

const CATEGORIES = [
  { id: 'model',     label: 'Set the Bar',            icon: '🧭', color: '#2563eb', light: '#eff6ff', border: '#bfdbfe' },
  { id: 'inspire',   label: 'Spark the Vision',  icon: '🔭', color: '#0d9488', light: '#f0fdfa', border: '#99f6e4' },
  { id: 'challenge', label: 'Improve the Flow',    icon: '⚙️', color: '#d97706', light: '#fffbeb', border: '#fcd34d' },
  { id: 'enable',    label: 'Enable the Team',     icon: '🤝', color: '#7c3aed', light: '#fdf4ff', border: '#e9d5ff' },
  { id: 'encourage', label: 'Winning with Compassion',      icon: '❤️', color: '#e11d48', light: '#fff1f2', border: '#fecdd3' },
];

const CAT_QUESTIONS = {
  model:     [1,6,11,16,21,26],
  inspire:   [2,7,12,17,22,27],
  challenge: [3,8,13,18,23,28],
  enable:    [4,9,14,19,24,29],
  encourage: [5,10,15,20,25,30],
};

// Short question texts for the peer survey (less self-referential)
const QUESTIONS = [
  { id:1,  cat:'model',     text:'This person sets a personal example of what they expect of others.' },
  { id:2,  cat:'inspire',   text:'This person talks about future trends that will influence how our work gets done.' },
  { id:3,  cat:'challenge', text:'This person seeks out challenging opportunities that test their own skills.' },
  { id:4,  cat:'enable',    text:'This person develops cooperative relationships among the people they work with.' },
  { id:5,  cat:'encourage', text:'This person praises people for a job well done.' },
  { id:6,  cat:'model',     text:'This person ensures that people adhere to the principles and standards the team has agreed on.' },
  { id:7,  cat:'inspire',   text:'This person describes a compelling image of what our future could look like.' },
  { id:8,  cat:'challenge', text:'This person challenges people to try out new and innovative ways to do their work.' },
  { id:9,  cat:'enable',    text:'This person actively listens to diverse points of view.' },
  { id:10, cat:'encourage', text:'This person makes it a point to let people know about their confidence in them.' },
  { id:11, cat:'model',     text:'This person follows through on the promises and commitments they make.' },
  { id:12, cat:'inspire',   text:'This person appeals to others to share an exciting dream of the future.' },
  { id:13, cat:'challenge', text:'This person searches outside the organization for innovative ways to improve what we do.' },
  { id:14, cat:'enable',    text:'This person treats others with dignity and respect.' },
  { id:15, cat:'encourage', text:'This person makes sure that people are creatively rewarded for their contributions.' },
  { id:16, cat:'model',     text:'This person asks for feedback on how their actions affect others.' },
  { id:17, cat:'inspire',   text:'This person shows others how their long-term interests can be realized by enlisting in a common vision.' },
  { id:18, cat:'challenge', text:'This person asks "What can we learn?" when things don\'t go as expected.' },
  { id:19, cat:'enable',    text:'This person supports the decisions that people make on their own.' },
  { id:20, cat:'encourage', text:'This person publicly recognizes people who show commitment to shared values.' },
  { id:21, cat:'model',     text:'This person builds consensus around a common set of values for running the team.' },
  { id:22, cat:'inspire',   text:'This person paints the "big picture" of what the team aspires to accomplish.' },
  { id:23, cat:'challenge', text:'This person makes certain that we set achievable goals, make concrete plans, and establish measurable milestones.' },
  { id:24, cat:'enable',    text:'This person gives people a great deal of freedom and choice in deciding how to do their work.' },
  { id:25, cat:'encourage', text:'This person finds ways to celebrate accomplishments.' },
  { id:26, cat:'model',     text:'This person is clear about their philosophy of leadership.' },
  { id:27, cat:'inspire',   text:'This person speaks with genuine conviction about the higher meaning and purpose of our work.' },
  { id:28, cat:'challenge', text:'This person experiments and takes risks, even when there is a chance of failure.' },
  { id:29, cat:'enable',    text:'This person ensures that people grow in their jobs by learning new skills and developing themselves.' },
  { id:30, cat:'encourage', text:'This person gives the team members lots of appreciation and support for their contributions.' },
];

const RELATIONSHIPS = ['Peer', 'Direct Report', 'Manager', 'Cross-functional Partner', 'Other'];

// Build guide lookup from shared questions data
const GUIDE_MAP = Object.fromEntries(SHARED_QUESTIONS.map(q => [q.id, q.guide]));

const OPEN_QUESTIONS = [
  { id: 'leaderStop',    section: 'As a Leader',  label: 'What should this person STOP doing?' },
  { id: 'leaderStart',   section: 'As a Leader',  label: 'What should this person START doing?' },
  { id: 'leaderContinue',section: 'As a Leader',  label: 'What should this person CONTINUE doing?' },
  { id: 'teamStop',      section: 'As a Team',    label: 'What should the team STOP doing?' },
  { id: 'teamStart',     section: 'As a Team',    label: 'What should the team START doing?' },
  { id: 'teamContinue',  section: 'As a Team',    label: 'What should the team CONTINUE doing?' },
  { id: 'additionalComments', section: 'Additional', label: 'Any additional comments or feedback for this person?' },
];

function scoreLabel(v) {
  if (v >= 9) return { label: 'Exemplary', color: '#7c3aed' };
  if (v >= 7) return { label: 'Strong',    color: '#0d9488' };
  if (v >= 5) return { label: 'Developing',color: '#f59e0b' };
  return            { label: 'Emerging',   color: '#ef4444' };
}

export default function Survey360() {
  const { surveyId } = useParams();
  const [survey, setSurvey]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [name, setName]           = useState('');
  const [relationship, setRelationship] = useState('');
  const [answers, setAnswers]     = useState({});
  const [openAnswers, setOpenAnswers] = useState({}); // text answers for open questions
  const [step, setStep]           = useState(-1); // -1=intro, 0-4=practices, 5=open questions
  const [saving, setSaving]       = useState(false);
  const [openGuides, setOpenGuides] = useState({});
  function toggleGuide(qid) { setOpenGuides(g => ({ ...g, [qid]: !g[qid] })); }

  useEffect(() => { loadSurvey(); }, [surveyId]);

  async function loadSurvey() {
    try {
      const snap = await getDoc(doc(db, 'surveys360', surveyId));
      if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
      setSurvey(snap.data());
    } catch (e) { setNotFound(true); }
    setLoading(false);
  }

  const catList    = CATEGORIES;
  const currentCat = catList[step];
  const catQs      = currentCat ? QUESTIONS.filter(q => q.cat === currentCat.id) : [];
  const totalAnswered = Object.keys(answers).length;
  const allAnswered   = totalAnswered === 30;
  const isOpenStep    = step === 5;

  async function handleSubmit() {
    if (!name.trim()) { toast.error('Please enter your name.'); return; }
    if (!relationship) { toast.error('Please select your relationship.'); return; }
    if (!allAnswered) { toast.error('Please answer all 30 questions.'); return; }
    setSaving(true);

    const response = {
      name: name.trim(),
      relationship,
      answers,
      openAnswers,
      submittedAt: new Date().toISOString(),
      scores: Object.fromEntries(
        CATEGORIES.map(c => [c.id, QUESTIONS.filter(q => q.cat === c.id).reduce((s, q) => s + (answers[q.id] || 0), 0)])
      ),
    };

    // Step 1: sign in anonymously so we have an auth token for Firestore writes
    let anonUid = null;
    try {
      const cred = await signInAnonymously(auth);
      anonUid = cred.user.uid;
    } catch (authErr) {
      console.error('Anonymous auth failed:', authErr.code, authErr.message);
      toast.error(`Auth error: ${authErr.code || authErr.message}. Enable Anonymous sign-in in Firebase console.`);
      setSaving(false);
      return;
    }

    // Step 2: write response under anonymous user's own doc (rules allow auth.uid == uid)
    try {
      await setDoc(doc(db, 'users', anonUid), {
        [`surveyResponse_${surveyId}`]: response,
        surveyId,
        leaderUid: survey?.leaderUid || '',
        isAnonResponse: true,
      }, { merge: true });
    } catch (writeErr) {
      console.error('Write failed:', writeErr.code, writeErr.message);
      toast.error(`Save error: ${writeErr.code || writeErr.message}`);
      setSaving(false);
      return;
    }

    // Step 3: also try updating surveys360 (works if rules have allow update: if true)
    try {
      await updateDoc(doc(db, 'surveys360', surveyId), { responses: arrayUnion(response) });
    } catch (_) {}

    setSubmitted(true);
    setSaving(false);
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <p style={{ color: '#64748b' }}>Loading survey…</p>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</div>
        <h2 style={{ color: '#0f172a', fontWeight: 800 }}>Survey not found</h2>
        <p style={{ color: '#64748b' }}>This link may have expired or is invalid. Please contact the person who sent it.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f0fdfa,#eff6ff)', padding: '2rem' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '3rem 2rem', textAlign: 'center', maxWidth: 480, boxShadow: '0 4px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontWeight: 900, color: '#0f2044', margin: '0 0 12px', fontSize: '1.5rem' }}>Thank you!</h2>
        <p style={{ color: '#475569', lineHeight: 1.7, margin: '0 0 8px' }}>
          Your feedback has been submitted successfully for <strong>{survey?.leaderName || 'this leader'}</strong>.
        </p>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Your responses are anonymous and will be used to support their leadership development.</p>
      </div>
    </div>
  );

  // ── Intro screen ──────────────────────────────────────────────────────────
  if (step === -1) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0f2044,#0d9488)', borderRadius: 16, padding: '2rem', color: 'white', textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📋</div>
          <h1 style={{ fontWeight: 900, margin: '0 0 6px', fontSize: '1.4rem' }}>Accountability Practice Inventory</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 12px', fontSize: '0.9rem' }}>360° Peer Feedback Survey</p>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.75rem 1rem', display: 'inline-block' }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 2px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Feedback for</p>
            <p style={{ color: 'white', fontWeight: 800, margin: 0, fontSize: '1.1rem' }}>{survey?.leaderName || 'Your Leader'}</p>
            {survey?.leaderRole && <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: '0.8rem' }}>{survey.leaderRole}</p>}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '1.75rem', marginBottom: 20, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontWeight: 800, color: '#0f2044', margin: '0 0 12px' }}>About this survey</h3>
          <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 16px' }}>
            You've been invited to provide honest, constructive feedback on <strong>{survey?.leaderName || 'your leader'}</strong>'s accountability behaviors. Your responses are <strong>completely anonymous</strong> and will only be seen as part of an aggregated report.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[['37 questions', '⏱ ~12 minutes'],['Scale of 1–10','📊 Per behavior'],['Anonymous','🔒 Confidential'],['+ Open feedback','✍️ 7 written']].map(([a,b]) => (
              <div key={a} style={{ background: '#f8fafc', borderRadius: 10, padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem' }}>{b.split(' ')[0]}</span>
                <div>
                  <p style={{ fontWeight: 700, color: '#0f2044', margin: 0, fontSize: '0.8rem' }}>{a}</p>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '0.7rem' }}>{b.split(' ').slice(1).join(' ')}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '0.75rem 1rem' }}>
            <p style={{ color: '#92400e', fontWeight: 700, margin: '0 0 4px', fontSize: '0.8rem' }}>📌 Rating guide</p>
            <p style={{ color: '#92400e', margin: 0, fontSize: '0.78rem', lineHeight: 1.5 }}>
              <strong>1–4 Emerging</strong> · <strong>5–6 Developing</strong> · <strong>7–9 Strong</strong> · <strong>10 Exemplary</strong><br/>
              Rate based on what you actually observe — not what you think this person intends or feels.
            </p>
          </div>
        </div>

        {/* Your info */}
        <div style={{ background: 'white', borderRadius: 16, padding: '1.75rem', marginBottom: 20, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontWeight: 800, color: '#0f2044', margin: '0 0 16px' }}>Your information</h3>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontWeight: 600, color: '#475569', fontSize: '0.82rem', display: 'block', marginBottom: 6 }}>Your first name (shown to leader only as a label)</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alex"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.625rem 0.875rem', fontSize: '0.9rem', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontWeight: 600, color: '#475569', fontSize: '0.82rem', display: 'block', marginBottom: 8 }}>Your relationship to {survey?.leaderName || 'this person'}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {RELATIONSHIPS.map(r => (
                <button key={r} onClick={() => setRelationship(r)}
                  style={{ padding: '6px 16px', borderRadius: 99, fontWeight: 600, fontSize: '0.8rem', border: `1px solid ${relationship === r ? '#0f2044' : '#e2e8f0'}`, background: relationship === r ? '#0f2044' : '#f8fafc', color: relationship === r ? 'white' : '#64748b', cursor: 'pointer' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={() => { if (!name.trim()) { toast.error('Please enter your name.'); return; } if (!relationship) { toast.error('Please select your relationship.'); return; } setStep(0); }}
          style={{ width: '100%', background: 'linear-gradient(135deg,#0f2044,#0d9488)', color: 'white', border: 'none', borderRadius: 12, padding: '0.875rem', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
          Start Survey →
        </button>
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: 12 }}>Your identity is kept confidential. Only aggregated results are shared.</p>
      </div>
    </div>
  );

  // ── Question steps ────────────────────────────────────────────────────────
  const progress = isOpenStep
    ? 100
    : Math.round(((step * 6 + catQs.filter(q => answers[q.id]).length) / 30) * 100);

  // ── Open questions step ───────────────────────────────────────────────────
  if (isOpenStep) {
    const sections = [...new Set(OPEN_QUESTIONS.map(q => q.section))];
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1rem' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {/* Progress */}
          <div style={{ background: 'white', borderRadius: 12, padding: '0.875rem 1.25rem', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: '#0f2044', fontSize: '0.82rem' }}>Step 6 of 6 · ✍️ Open Feedback</span>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>30/30 rated questions done</span>
            </div>
            <div style={{ background: '#e2e8f0', borderRadius: 99, height: 7 }}>
              <div style={{ height: 7, borderRadius: 99, background: 'linear-gradient(90deg,#0f2044,#0d9488)', width: '100%' }} />
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <p style={{ fontWeight: 800, color: '#0f2044', margin: '0 0 6px' }}>Open-Ended Feedback</p>
            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>These questions are optional but very valuable. Share as much or as little as you like.</p>
          </div>

          {sections.map(section => (
            <div key={section} style={{ marginBottom: 20 }}>
              <div style={{ background: 'linear-gradient(135deg,#0f2044,#1e40af)', borderRadius: 10, padding: '0.5rem 1rem', marginBottom: 12 }}>
                <p style={{ color: 'white', fontWeight: 800, margin: 0, fontSize: '0.85rem' }}>{section}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {OPEN_QUESTIONS.filter(q => q.section === section).map((q, qi) => {
                  const globalIdx = OPEN_QUESTIONS.indexOf(q) + 1;
                  return (
                    <div key={q.id} style={{ background: 'white', borderRadius: 12, padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: openAnswers[q.id] ? '1px solid #0d9488' : '1px solid #f1f5f9' }}>
                      <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', marginBottom: 8 }}>
                        <span style={{ color: '#0d9488', marginRight: 6 }}>{globalIdx}.</span>{q.label}
                      </label>
                      <textarea
                        value={openAnswers[q.id] || ''}
                        onChange={e => setOpenAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                        placeholder="Share your thoughts here… (optional)"
                        rows={3}
                        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.625rem 0.875rem', fontSize: '0.875rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit', color: '#0f172a' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '2rem' }}>
            <button onClick={() => setStep(4)}
              style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 10, padding: '0.625rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}>
              ← Previous
            </button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ background: 'linear-gradient(135deg,#0f2044,#0d9488)', color: 'white', border: 'none', borderRadius: 10, padding: '0.625rem 1.75rem', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? '⏳ Submitting…' : '✓ Submit Feedback'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1rem' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Progress bar */}
        <div style={{ background: 'white', borderRadius: 12, padding: '0.875rem 1.25rem', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: '#0f2044', fontSize: '0.82rem' }}>Step {step + 1} of 6 · {currentCat.icon} {currentCat.label}</span>
            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>{totalAnswered}/30 answered</span>
          </div>
          <div style={{ background: '#e2e8f0', borderRadius: 99, height: 7 }}>
            <div style={{ height: 7, borderRadius: 99, background: `linear-gradient(90deg,#0f2044,#0d9488)`, width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
          {catQs.map(q => {
            const val = answers[q.id];
            const lvl = val ? scoreLabel(val) : null;
            return (
              <div key={q.id} style={{ background: 'white', borderRadius: 14, padding: '1.25rem', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${val ? currentCat.border : '#f1f5f9'}` }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ minWidth: 28, height: 28, borderRadius: '50%', background: currentCat.light, color: currentCat.color, fontWeight: 800, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${currentCat.border}` }}>{q.id}</div>
                  <p style={{ fontWeight: 600, color: '#0f172a', margin: 0, lineHeight: 1.5, fontSize: '0.9rem' }}>{q.text}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setAnswers(a => ({ ...a, [q.id]: n }))}
                      style={{ width: 36, height: 36, borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', border: `2px solid ${val === n ? currentCat.color : '#e2e8f0'}`, background: val === n ? currentCat.color : '#f8fafc', color: val === n ? 'white' : '#475569', cursor: 'pointer', transition: 'all 0.15s' }}>
                      {n}
                    </button>
                  ))}
                  {lvl && <span style={{ fontSize: '0.72rem', fontWeight: 700, color: lvl.color, marginLeft: 4 }}>{lvl.label}</span>}
                </div>
                {/* Scoring guide toggle */}
                <button onClick={() => toggleGuide(q.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {openGuides[q.id] ? '▲' : '▼'} View Scoring Guide
                </button>
                {openGuides[q.id] && GUIDE_MAP[q.id] && (
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {GUIDE_LEVELS.map(lvlDef => (
                      <div key={lvlDef.key} style={{ background: lvlDef.bg, border: `1px solid ${lvlDef.border}`, borderRadius: 10, padding: '0.625rem 0.75rem' }}>
                        <p style={{ fontWeight: 800, color: lvlDef.color, margin: '0 0 4px', fontSize: '0.72rem' }}>{lvlDef.label}</p>
                        <p style={{ color: '#374151', margin: 0, fontSize: '0.72rem', lineHeight: 1.5 }}>{GUIDE_MAP[q.id][lvlDef.key]}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '2rem' }}>
          <button onClick={() => setStep(s => s - 1)}
            style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 10, padding: '0.625rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}>
            ← {step === 0 ? 'Back to intro' : 'Previous'}
          </button>
          {step < 4 ? (
            <button onClick={() => { if (catQs.some(q => !answers[q.id])) { toast.error('Please answer all questions in this section.'); return; } setStep(s => s + 1); }}
              style={{ background: currentCat.color, color: 'white', border: 'none', borderRadius: 10, padding: '0.625rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>
              Next Practice →
            </button>
          ) : (
            <button onClick={() => { if (!allAnswered) { toast.error('Please answer all 30 rated questions first.'); return; } setStep(5); }}
              style={{ background: 'linear-gradient(135deg,#0f2044,#0d9488)', color: 'white', border: 'none', borderRadius: 10, padding: '0.625rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>
              Next: Open Feedback →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
