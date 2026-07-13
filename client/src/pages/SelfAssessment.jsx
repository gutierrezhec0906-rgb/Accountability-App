import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import toast from 'react-hot-toast';

// ── Assessment data ──────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'model',
    label: 'Model the Way',
    icon: '🧭',
    color: '#2563eb',
    bg: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
    light: '#eff6ff',
    border: '#bfdbfe',
    desc: 'Setting personal example and upholding shared values.',
  },
  {
    id: 'inspire',
    label: 'Inspire a Shared Vision',
    icon: '🔭',
    color: '#0d9488',
    bg: 'linear-gradient(135deg,#134e4a,#0d9488)',
    light: '#f0fdfa',
    border: '#99f6e4',
    desc: 'Painting the future and enlisting others in the dream.',
  },
  {
    id: 'challenge',
    label: 'Challenge the Process',
    icon: '⚙️',
    color: '#d97706',
    bg: 'linear-gradient(135deg,#78350f,#d97706)',
    light: '#fffbeb',
    border: '#fcd34d',
    desc: 'Seeking innovation and learning from setbacks.',
  },
  {
    id: 'enable',
    label: 'Enable Others to Act',
    icon: '🤝',
    color: '#7c3aed',
    bg: 'linear-gradient(135deg,#4c1d95,#7c3aed)',
    light: '#fdf4ff',
    border: '#e9d5ff',
    desc: 'Fostering collaboration and building capability.',
  },
  {
    id: 'encourage',
    label: 'Encourage the Heart',
    icon: '❤️',
    color: '#e11d48',
    bg: 'linear-gradient(135deg,#881337,#e11d48)',
    light: '#fff1f2',
    border: '#fecdd3',
    desc: 'Recognizing contributions and celebrating victories.',
  },
];

const QUESTIONS = [
  { id: 1,  cat: 'model',    text: 'I set a personal example of what I expect of others.' },
  { id: 2,  cat: 'inspire',  text: 'I talk about future trends that will influence how our work gets done.' },
  { id: 3,  cat: 'challenge',text: 'I seek out challenging opportunities that test my own skills and abilities.' },
  { id: 4,  cat: 'enable',   text: 'I develop cooperative relationships among the people I work with.' },
  { id: 5,  cat: 'encourage',text: 'I praise people for a job well done.' },
  { id: 6,  cat: 'model',    text: 'I spend time and energy making certain that the people I work with adhere to the principles and standards we have agreed on.' },
  { id: 7,  cat: 'inspire',  text: 'I describe a compelling image of what our future could be like.' },
  { id: 8,  cat: 'challenge',text: 'I challenge people to try out new and innovative ways to do their work.' },
  { id: 9,  cat: 'enable',   text: 'I actively listen to diverse points of view.' },
  { id: 10, cat: 'encourage',text: 'I make it a point to let people know about my confidence in their abilities.' },
  { id: 11, cat: 'model',    text: 'I follow through on the promises and commitments that I make.' },
  { id: 12, cat: 'inspire',  text: 'I appeal to others to share an exciting dream of the future.' },
  { id: 13, cat: 'challenge',text: 'I search outside the formal boundaries of my organization for innovative ways to improve what we do.' },
  { id: 14, cat: 'enable',   text: 'I treat others with dignity and respect.' },
  { id: 15, cat: 'encourage',text: 'I make sure that people are creatively rewarded for their contributions to the success of our projects.' },
  { id: 16, cat: 'model',    text: 'I ask for feedback on how my actions affect other people\'s performance.' },
  { id: 17, cat: 'inspire',  text: 'I show others how their long-term interests can be realized by enlisting in a common vision.' },
  { id: 18, cat: 'challenge',text: 'I ask "What can we learn?" when things don\'t go as expected.' },
  { id: 19, cat: 'enable',   text: 'I support the decisions that people make on their own.' },
  { id: 20, cat: 'encourage',text: 'I publicly recognize people who exemplify commitment to shared values.' },
  { id: 21, cat: 'model',    text: 'I build consensus around a common set of values for running our organization.' },
  { id: 22, cat: 'inspire',  text: 'I paint the "big picture" of what we aspire to accomplish.' },
  { id: 23, cat: 'challenge',text: 'I make certain that we set achievable goals, make concrete plans, and establish measurable milestones for the projects and programs that we work on.' },
  { id: 24, cat: 'enable',   text: 'I give people a great deal of freedom and choice in deciding how to do their work.' },
  { id: 25, cat: 'encourage',text: 'I find ways to celebrate accomplishments.' },
  { id: 26, cat: 'model',    text: 'I am clear about my philosophy of leadership.' },
  { id: 27, cat: 'inspire',  text: 'I speak with genuine conviction about the higher meaning and purpose of our work.' },
  { id: 28, cat: 'challenge',text: 'I experiment and take risks, even when there is a chance of failure.' },
  { id: 29, cat: 'enable',   text: 'I ensure that people grow in their jobs by learning new skills and developing themselves.' },
  { id: 30, cat: 'encourage',text: 'I give the members of the team lots of appreciation and support for their contributions.' },
];

const CAT_QUESTIONS = Object.fromEntries(CATEGORIES.map(c => [c.id, QUESTIONS.filter(q => q.cat === c.id)]));

// ── Radar/Spider chart ───────────────────────────────────────────
function RadarChart({ scores, size = 260 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const n = CATEGORIES.length;
  const angle = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, frac) => ({
    x: cx + r * frac * Math.cos(angle(i)),
    y: cy + r * frac * Math.sin(angle(i)),
  });

  // Grid rings at 20/40/60/80/100%
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  // Axes
  const axes = CATEGORIES.map((_, i) => ({ from: { x: cx, y: cy }, to: pt(i, 1) }));

  // Data polygon — scores are 0-60, normalise to 0-1
  const dataPoints = CATEGORIES.map((c, i) => pt(i, (scores[c.id] || 0) / 60));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';

  // Ring polygon
  const ringPath = frac => CATEGORIES.map((_, i) => pt(i, frac))
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {/* Grid rings */}
      {rings.map(f => (
        <path key={f} d={ringPath(f)} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {/* Axes */}
      {axes.map((a, i) => (
        <line key={i} x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {/* Data fill */}
      <path d={dataPath} fill="rgba(13,148,136,0.15)" stroke="#0d9488" strokeWidth="2" strokeLinejoin="round" />
      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#0d9488" stroke="white" strokeWidth="1.5" />
      ))}
      {/* Labels */}
      {CATEGORIES.map((c, i) => {
        const labelPt = pt(i, 1.22);
        return (
          <text key={i} x={labelPt.x} y={labelPt.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fontWeight="700" fill={c.color}>
            {c.icon} {c.label.split(' ').slice(0, 2).join(' ')}
          </text>
        );
      })}
      {/* Score ring labels */}
      {[20,40,60].map(v => (
        <text key={v} x={cx + 4} y={cy - r * (v / 60) + 4} fontSize="8" fill="#94a3b8">{v}</text>
      ))}
    </svg>
  );
}

// ── History line chart ───────────────────────────────────────────
function HistoryChart({ history }) {
  const W = 520, H = 200, PL = 36, PR = 16, PT = 12, PB = 40;
  const cW = W - PL - PR, cH = H - PT - PB;

  if (history.length < 2) return (
    <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', textAlign: 'center', padding: '0 2rem' }}>
      Complete at least 2 assessments to see your progress trend.
    </div>
  );

  const px = i => PL + (i / (history.length - 1)) * cW;
  const py = v => PT + cH - (v / 60) * cH;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        {CATEGORIES.map(c => (
          <linearGradient key={c.id} id={`grad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={c.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* Y grid */}
      {[0, 15, 30, 45, 60].map(v => (
        <g key={v}>
          <line x1={PL} y1={py(v)} x2={W - PR} y2={py(v)} stroke="#f1f5f9" strokeWidth="1" />
          <text x={PL - 4} y={py(v) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
        </g>
      ))}

      {/* Lines per category */}
      {CATEGORIES.map(c => {
        const pts = history.map((h, i) => [px(i), py(h.scores[c.id] || 0)]);
        let d = `M ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 1; i < pts.length; i++) {
          const cpx = (pts[i - 1][0] + pts[i][0]) / 2;
          d += ` C ${cpx} ${pts[i - 1][1]}, ${cpx} ${pts[i][1]}, ${pts[i][0]} ${pts[i][1]}`;
        }
        return (
          <g key={c.id}>
            <path d={d} fill="none" stroke={c.color} strokeWidth="2" strokeLinecap="round" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="3.5" fill="white" stroke={c.color} strokeWidth="2" />
            ))}
          </g>
        );
      })}

      {/* X labels (dates) */}
      {history.map((h, i) => {
        const d = new Date(h.date + 'T00:00:00');
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        return (
          <text key={i} x={px(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{label}</text>
        );
      })}

      {/* Baseline */}
      <line x1={PL} y1={PT + cH} x2={W - PR} y2={PT + cH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

// ── Score level helper ───────────────────────────────────────────
function scoreLevel(s) {
  if (s >= 50) return { label: 'Exceptional', color: '#0d9488' };
  if (s >= 40) return { label: 'Proficient',  color: '#2563eb' };
  if (s >= 30) return { label: 'Developing',  color: '#f59e0b' };
  return              { label: 'Emerging',    color: '#ef4444' };
}

// ── Main component ───────────────────────────────────────────────
export default function SelfAssessment() {
  const { currentUser } = useAuth();

  // UI state
  const [view, setView] = useState('intro'); // intro | form | results | history
  const [step, setStep] = useState(0);       // 0-4 = category index in form
  const [answers, setAnswers] = useState({}); // { questionId: 1-10 }
  const [saving, setSaving] = useState(false);

  // Firestore data
  const [history, setHistory] = useState([]);   // array of past assessments
  const [latest, setLatest]   = useState(null); // most recent

  useEffect(() => {
    if (!currentUser) return;
    load();
  }, [currentUser]);

  async function load() {
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const entries = (snap.data().selfAssessments || []).slice().sort((a, b) => a.date.localeCompare(b.date));
        setHistory(entries);
        if (entries.length > 0) setLatest(entries[entries.length - 1]);
      }
    } catch (e) { console.error(e); }
  }

  // Compute category scores from answers
  function computeScores(ans) {
    return Object.fromEntries(CATEGORIES.map(c => [
      c.id,
      CAT_QUESTIONS[c.id].reduce((sum, q) => sum + (ans[q.id] || 0), 0),
    ]));
  }

  function totalScore(scores) {
    return Object.values(scores).reduce((s, v) => s + v, 0);
  }

  async function handleSave() {
    if (Object.keys(answers).length < 30) {
      toast.error('Please answer all 30 questions before saving.');
      return;
    }
    setSaving(true);
    try {
      const scores = computeScores(answers);
      const entry = {
        date: new Date().toISOString().split('T')[0],
        scores,
        total: totalScore(scores),
        answers,
      };
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      const existing = snap.exists() ? (snap.data().selfAssessments || []) : [];
      const updated = [...existing, entry];
      await setDoc(doc(db, 'users', currentUser.uid), { selfAssessments: updated }, { merge: true });
      setHistory(updated);
      setLatest(entry);
      toast.success('Assessment saved!');
      setView('results');
    } catch (e) {
      toast.error('Could not save. Try again.');
    }
    setSaving(false);
  }

  function startNew() {
    setAnswers({});
    setStep(0);
    setView('form');
  }

  const currentCat  = CATEGORIES[step];
  const catQuestions = currentCat ? CAT_QUESTIONS[currentCat.id] : [];
  const catAnswered  = catQuestions.filter(q => answers[q.id]).length;
  const allAnswered  = Object.keys(answers).length === 30;
  const totalAnswered = Object.keys(answers).length;

  // ── INTRO ──
  if (view === 'intro') {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }} className="space-y-6">
        <PageHeader icon="📋" title="Accountability Self-Assessment" subtitle="30 behavior statements · 5 leadership practices · Scored 1–10" />

        {latest && (
          <div style={{ borderRadius: 14, border: '1px solid #99f6e4', background: '#f0fdfa', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontWeight: 700, color: '#0f766e', margin: 0, fontSize: '0.875rem' }}>Last assessment: {new Date(latest.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              <p style={{ color: '#0d9488', margin: 0, fontSize: '0.78rem' }}>Total score: <strong>{latest.total}/300</strong> · {history.length} assessment{history.length !== 1 ? 's' : ''} completed</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setView('results')} style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>View Results</button>
              <button onClick={() => setView('history')} style={{ background: 'white', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: 8, padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>View Progress</button>
            </div>
          </div>
        )}

        {/* Intro card */}
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
          <h2 style={{ fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px', fontSize: '1.25rem' }}>Leadership Practices Inventory</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.7 }}>
            Rate yourself honestly on 30 leadership behavior statements across the 5 core leadership practices. This is your baseline — retake it every 3 months to track your growth.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 24, textAlign: 'left' }}>
            {CATEGORIES.map(c => (
              <div key={c.id} style={{ borderRadius: 10, border: `1px solid ${c.border}`, background: c.light, padding: '0.75rem' }}>
                <p style={{ fontSize: '1.125rem', margin: '0 0 4px' }}>{c.icon}</p>
                <p style={{ fontWeight: 800, color: c.color, margin: '0 0 2px', fontSize: '0.75rem' }}>{c.label}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', margin: 0, lineHeight: 1.4 }}>{c.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.625rem 1rem', fontSize: '0.78rem', color: '#64748b' }}>⏱ ~10 minutes</div>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.625rem 1rem', fontSize: '0.78rem', color: '#64748b' }}>30 questions · 1–10 scale</div>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.625rem 1rem', fontSize: '0.78rem', color: '#64748b' }}>🔁 Retake every 3 months</div>
          </div>

          <button onClick={startNew} style={{ background: 'linear-gradient(135deg,#0f2044,#2563eb)', color: 'white', border: 'none', borderRadius: 10, padding: '0.75rem 2rem', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}>
            {latest ? 'Retake Assessment' : 'Start Assessment'} →
          </button>
        </div>
      </div>
    );
  }

  // ── FORM ──
  if (view === 'form') {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }} className="space-y-5">
        {/* Progress bar */}
        <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card-bg)', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>Question {totalAnswered} of 30</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{Math.round((totalAnswered / 30) * 100)}% complete</span>
          </div>
          <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 8 }}>
            <div style={{ height: 8, borderRadius: 9999, background: 'linear-gradient(90deg,#0f2044,#0d9488)', width: `${(totalAnswered / 30) * 100}%`, transition: 'width 0.3s ease' }} />
          </div>
          {/* Category steps */}
          <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            {CATEGORIES.map((c, i) => (
              <button key={c.id} onClick={() => setStep(i)} style={{
                flex: 1, height: 5, borderRadius: 9999, border: 'none', cursor: 'pointer',
                background: i < step ? c.color : i === step ? c.color : '#e2e8f0',
                opacity: i < step ? 0.6 : 1,
              }} title={c.label} />
            ))}
          </div>
        </div>

        {/* Category header */}
        <div style={{ borderRadius: 14, background: currentCat.bg, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '2rem' }}>{currentCat.icon}</span>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Practice {step + 1} of 5</p>
            <p style={{ color: 'white', fontWeight: 900, fontSize: '1.1rem', margin: '2px 0' }}>{currentCat.label}</p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', margin: 0 }}>{catAnswered}/6 answered · {currentCat.desc}</p>
          </div>
        </div>

        {/* Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {catQuestions.map((q, qi) => {
            const val = answers[q.id];
            return (
              <div key={q.id} className="card" style={{ padding: '1.125rem 1.25rem', border: val ? `1.5px solid ${currentCat.border}` : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ background: val ? currentCat.bg : '#f1f5f9', color: val ? 'white' : '#64748b', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
                    {q.id}
                  </span>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6, fontWeight: val ? 600 : 400 }}>{q.text}</p>
                </div>

                {/* 1-10 rating buttons */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => {
                    const active = val === n;
                    const low = n <= 3, mid = n <= 6, high = n > 6;
                    const btnColor = high ? currentCat.color : mid ? '#f59e0b' : '#ef4444';
                    return (
                      <button key={n} onClick={() => setAnswers(a => ({ ...a, [q.id]: n }))} style={{
                        width: 38, height: 34, borderRadius: 8, border: active ? `2px solid ${btnColor}` : '1px solid #e2e8f0',
                        background: active ? btnColor : '#f8fafc',
                        color: active ? 'white' : '#64748b',
                        fontWeight: active ? 800 : 600, fontSize: '0.8125rem',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}>
                        {n}
                      </button>
                    );
                  })}
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', alignSelf: 'center', marginLeft: 4 }}>
                    {val ? (val <= 3 ? '⚠ Rarely' : val <= 6 ? '~ Sometimes' : '✓ Often') : '1=Rarely · 10=Almost Always'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem' }}>
          <button onClick={() => step > 0 ? setStep(s => s - 1) : setView('intro')}
            style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 10, padding: '0.625rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            ← {step === 0 ? 'Cancel' : 'Previous'}
          </button>

          {step < 4 ? (
            <button onClick={() => setStep(s => s + 1)}
              style={{ background: currentCat.color, color: 'white', border: 'none', borderRadius: 10, padding: '0.625rem 1.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
              Next Practice →
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving || !allAnswered}
              style={{
                background: allAnswered ? 'linear-gradient(135deg,#0f2044,#0d9488)' : '#e2e8f0',
                color: allAnswered ? 'white' : '#94a3b8',
                border: 'none', borderRadius: 10, padding: '0.625rem 1.5rem', fontWeight: 800, fontSize: '0.875rem',
                cursor: allAnswered ? 'pointer' : 'not-allowed',
              }}>
              {saving ? '⏳ Saving...' : `💾 Save Results (${totalAnswered}/30)`}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── RESULTS ──
  if (view === 'results' && latest) {
    const scores = latest.scores;
    const total  = latest.total;
    const date   = new Date(latest.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const overall = scoreLevel(total / 5); // average per category

    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }} className="space-y-5">
        <PageHeader icon="📊" title="Assessment Results" subtitle={`Completed ${date} · ${history.length} assessment${history.length !== 1 ? 's' : ''} total`}
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setView('history')} style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.875rem', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>📈 Progress</button>
              <button onClick={startNew} style={{ background: '#0f2044', color: 'white', border: 'none', borderRadius: 8, padding: '0.4rem 0.875rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Retake</button>
            </div>
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.25rem', alignItems: 'start' }}>
          {/* Left: scores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Total score hero */}
            <div style={{ borderRadius: 14, background: 'linear-gradient(135deg,#0f2044,#1e3a6e,#0d9488)', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Total Score</p>
                <p style={{ color: 'white', fontSize: '3.5rem', fontWeight: 900, margin: 0, lineHeight: 1 }}>{total}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', margin: '4px 0 0' }}>out of 300</p>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', margin: '0 0 4px' }}>Overall level</p>
                <p style={{ color: overall.color, fontWeight: 900, fontSize: '1.5rem', margin: '0 0 8px' }}>{overall.label}</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', margin: 0, maxWidth: 280, lineHeight: 1.5 }}>
                  Each practice is scored out of 60 (6 questions × 10). Retake every 3 months to track your leadership growth.
                </p>
              </div>
            </div>

            {/* Per-category bars */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px', fontSize: '0.95rem' }}>Score by Leadership Practice</p>
              {CATEGORIES.map(c => {
                const s = scores[c.id] || 0;
                const pct = Math.round((s / 60) * 100);
                const lvl = scoreLevel(s);
                return (
                  <div key={c.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1rem' }}>{c.icon}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{c.label}</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: lvl.color, background: `${lvl.color}18`, borderRadius: 99, padding: '1px 7px' }}>{lvl.label}</span>
                      </div>
                      <span style={{ fontWeight: 900, color: c.color, fontSize: '0.95rem' }}>{s}<span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.75rem' }}>/60</span></span>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 9 }}>
                      <div style={{ height: 9, borderRadius: 9999, background: c.bg, width: `${pct}%`, transition: 'width 1.2s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Strengths & growth areas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1rem' }}>
                <p style={{ fontWeight: 800, color: '#15803d', margin: '0 0 8px', fontSize: '0.8rem' }}>💪 Top Strength</p>
                {(() => {
                  const top = CATEGORIES.reduce((a, b) => (scores[a.id] || 0) >= (scores[b.id] || 0) ? a : b);
                  return <p style={{ color: '#166534', fontSize: '0.8rem', margin: 0 }}>{top.icon} {top.label} — {scores[top.id]}/60</p>;
                })()}
              </div>
              <div style={{ borderRadius: 12, background: '#fff7ed', border: '1px solid #fed7aa', padding: '1rem' }}>
                <p style={{ fontWeight: 800, color: '#c2410c', margin: '0 0 8px', fontSize: '0.8rem' }}>🎯 Growth Area</p>
                {(() => {
                  const low = CATEGORIES.reduce((a, b) => (scores[a.id] || 0) <= (scores[b.id] || 0) ? a : b);
                  return <p style={{ color: '#9a3412', fontSize: '0.8rem', margin: 0 }}>{low.icon} {low.label} — {scores[low.id]}/60</p>;
                })()}
              </div>
            </div>
          </div>

          {/* Right: radar chart */}
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.9rem' }}>Practice Profile</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>Score per leadership practice</p>
            <RadarChart scores={scores} size={240} />

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12, textAlign: 'left' }}>
              {CATEGORIES.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flex: 1 }}>{c.label}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: c.color }}>{scores[c.id] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── HISTORY / PROGRESS ──
  if (view === 'history') {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto' }} className="space-y-5">
        <PageHeader icon="📈" title="Assessment Progress" subtitle="Track your leadership growth over time — retake every 3 months."
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              {latest && <button onClick={() => setView('results')} style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.875rem', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>📊 Results</button>}
              <button onClick={startNew} style={{ background: '#0f2044', color: 'white', border: 'none', borderRadius: 8, padding: '0.4rem 0.875rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>+ New Assessment</button>
            </div>
          }
        />

        {/* Total score trend */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.95rem' }}>Overall Score Trend</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>Total accountability score across all assessments (max 300)</p>
          {history.length < 2 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>Complete at least 2 assessments to see your trend.</p>
          ) : (
            (() => {
              const W = 520, H = 160, PL = 40, PR = 16, PT = 12, PB = 36;
              const cW = W - PL - PR, cH = H - PT - PB;
              const px = i => PL + (i / (history.length - 1)) * cW;
              const py = v => PT + cH - (v / 300) * cH;
              const pts = history.map((h, i) => [px(i), py(h.total)]);
              let d = `M ${pts[0][0]} ${pts[0][1]}`;
              for (let i = 1; i < pts.length; i++) {
                const cpx = (pts[i - 1][0] + pts[i][0]) / 2;
                d += ` C ${cpx} ${pts[i - 1][1]}, ${cpx} ${pts[i][1]}, ${pts[i][0]} ${pts[i][1]}`;
              }
              const fillD = d + ` L ${pts[pts.length - 1][0]} ${PT + cH} L ${pts[0][0]} ${PT + cH} Z`;
              return (
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0, 75, 150, 225, 300].map(v => (
                    <g key={v}>
                      <line x1={PL} y1={py(v)} x2={W - PR} y2={py(v)} stroke="#f1f5f9" strokeWidth="1" />
                      <text x={PL - 4} y={py(v) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
                    </g>
                  ))}
                  <path d={fillD} fill="url(#totalGrad)" />
                  <path d={d} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />
                  {pts.map(([x, y], i) => (
                    <g key={i}>
                      <circle cx={x} cy={y} r="5" fill="white" stroke="#0d9488" strokeWidth="2.5" />
                      <text x={x} y={y - 9} textAnchor="middle" fontSize="10" fontWeight="800" fill="#0f766e">{history[i].total}</text>
                    </g>
                  ))}
                  {history.map((h, i) => {
                    const dl = new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                    return <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">{dl}</text>;
                  })}
                  <line x1={PL} y1={PT + cH} x2={W - PR} y2={PT + cH} stroke="#e2e8f0" strokeWidth="1" />
                </svg>
              );
            })()
          )}
        </div>

        {/* Per-practice trend */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.95rem' }}>Progress by Leadership Practice</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>Score per practice across assessments (max 60 each)</p>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            {CATEGORIES.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 3, borderRadius: 9999, background: c.color }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.icon} {c.label}</span>
              </div>
            ))}
          </div>
          <HistoryChart history={history} />
        </div>

        {/* Assessment history list */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', fontSize: '0.95rem' }}>Assessment History</p>
          {history.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>No assessments yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...history].reverse().map((h, idx) => {
                const d = new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                const lvl = scoreLevel(h.total / 5);
                return (
                  <div key={idx} style={{ borderRadius: 10, border: '1px solid var(--border)', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: '0.875rem' }}>{d}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {CATEGORIES.map(c => (
                          <span key={c.id} style={{ fontSize: '0.68rem', color: c.color, fontWeight: 700 }}>{c.icon} {h.scores[c.id]}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: lvl.color, background: `${lvl.color}18`, borderRadius: 99, padding: '2px 9px' }}>{lvl.label}</span>
                      <span style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '1rem' }}>{h.total}<span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.72rem' }}>/300</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback to intro
  return null;
}
