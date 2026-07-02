import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { collection, addDoc, getDocs, updateDoc, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const SCALE_LABELS = {
  1: { label: 'Rarely',    desc: 'This behavior is absent or reactive. Others would not recognize it as a strength. Immediate focus needed.' },
  2: { label: 'Sometimes', desc: 'Visible in low-stakes moments but breaks down under pressure or when it costs something. Inconsistent.' },
  3: { label: 'Often',     desc: 'Practiced intentionally but not yet automatic. You catch yourself after the fact more than in the moment.' },
  4: { label: 'Usually',   desc: 'Reliable across most situations, including difficult ones. Others notice and trust it. Minor blind spots remain.' },
  5: { label: 'Always',    desc: 'Deeply embedded. You demonstrate it when hard, teach it to others, and it shapes how your team operates.' },
};

function ScaleButton({ n, selected, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isActive = n <= selected;
  const color = isActive ? '#0d9488' : hovered ? '#0f2044' : '#e2e8f0';
  const textColor = isActive || hovered ? 'white' : '#94a3b8';

  return (
    <div style={{ position: 'relative' }}>
      {hovered && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
          background: '#0f2044', color: 'white', borderRadius: 10, padding: '8px 12px', zIndex: 100,
          width: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', pointerEvents: 'none',
        }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#99f6e4', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {n} — {SCALE_LABELS[n].label}
          </p>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.45 }}>
            {SCALE_LABELS[n].desc}
          </p>
          <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #0f2044' }} />
        </div>
      )}
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: 34, height: 34, borderRadius: '50%', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
          border: `2px solid ${color}`, background: isActive ? '#0d9488' : hovered ? '#0f2044' : 'transparent',
          color: textColor, transition: 'all 0.15s' }}>
        {n}
      </button>
    </div>
  );
}

const eqDimensions = [
  { id: 'self-awareness', label: 'Self-Awareness',  icon: '🪞', desc: 'Understanding your emotions and their impact',         questions: ['I recognize my emotional states in real-time','I understand my triggers and how they affect my behavior','I seek feedback to understand my blind spots','I know my strengths and development areas clearly'] },
  { id: 'self-regulation',label: 'Self-Regulation', icon: '🎛️', desc: 'Managing your emotions and impulses effectively',       questions: ['I stay calm under pressure and in conflict','I think before reacting in tense situations','I adapt my approach when things change unexpectedly','I maintain a positive attitude in challenging situations'] },
  { id: 'motivation',     label: 'Motivation',      icon: '🔥', desc: 'Internal drive toward goals beyond external rewards',   questions: ['I maintain enthusiasm even when facing obstacles','I set challenging goals and pursue them with energy','I continuously look for ways to improve','I inspire others through my own commitment'] },
  { id: 'empathy',        label: 'Empathy',          icon: '❤️', desc: 'Understanding and sharing the feelings of others',      questions: ['I actively listen without planning my response',"I consider others' emotions before making decisions",'I adapt my communication style to different people',"I can sense the team's morale and address it proactively"] },
  { id: 'social-skills',  label: 'Social Skills',   icon: '🤝', desc: 'Managing relationships and inspiring others',           questions: ['I build trust with people at all levels','I resolve conflicts constructively and quickly','I communicate clearly and persuasively','I build high-performing collaborative teams'] },
];

const opexChecklist = [
  { category: 'Process Excellence',     items: ['Standard work documented and followed','KPIs are visible and reviewed daily','Process variation is measured and reduced','Value stream mapping completed and updated'] },
  { category: 'Continuous Improvement', items: ['Kaizen events conducted quarterly','Employee ideas captured and implemented','Lessons learned are shared across teams','PDCA cycle is actively used for problems'] },
  { category: 'Leadership Behaviors',   items: ['Daily gemba walks completed','Coaching conversations held weekly','Recognition given frequently and specifically','Accountability conversations handled promptly'] },
  { category: 'Customer Focus',         items: ['Voice of customer captured monthly','Customer complaint root causes addressed','First-time quality metrics tracked','On-time delivery performance monitored'] },
];

function calcDimAvg(scores, dimId, qCount) {
  const vals = Array.from({ length: qCount }, (_, i) => scores[`${dimId}-${i}`] || 0).filter(Boolean);
  return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ScoreBar({ value, max = 5 }) {
  const pct = (value / max) * 100;
  const color = value >= 4 ? '#0d9488' : value >= 3 ? '#f59e0b' : value > 0 ? '#ef4444' : '#e2e8f0';
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 9999, height: 6, flex: 1 }}>
      <div style={{ height: 6, borderRadius: 9999, background: color, width: `${pct}%`, transition: 'width 0.4s' }} />
    </div>
  );
}

export default function EQOpEx() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('eq');
  const [eqScores, setEqScores] = useState({});
  const [opexChecks, setOpexChecks] = useState({});
  const [opexDocId, setOpexDocId] = useState(null);
  const [saving, setSaving] = useState(false);

  // EQ history sidebar
  const [eqHistory, setEqHistory] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null); // record being viewed in sidebar
  const [saveLabel, setSaveLabel] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    async function load() {
      try {
        // Load EQ history (all snapshots), sort client-side
        const eqSnap = await getDocs(query(
          collection(db, 'eqAssessments'),
          where('uid', '==', currentUser.uid)
        ));
        const records = eqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        records.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setEqHistory(records);

        // Load OpEx (single doc, overwrite model)
        const opexSnap = await getDocs(query(collection(db, 'eqOpex'), where('uid', '==', currentUser.uid), where('type', '==', 'opex')));
        opexSnap.forEach(d => { setOpexChecks(d.data().checks || {}); setOpexDocId(d.id); });
      } catch (e) { console.error(e); }
    }
    load();
  }, [currentUser]);

  async function saveEQ() {
    if (!currentUser) return toast.error('Not logged in');
    const now = new Date();
    const nextTest = new Date(now);
    nextTest.setDate(nextTest.getDate() + 60);
    const label = saveLabel.trim() || `Assessment — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    setSaving(true);
    try {
      const dimResults = eqDimensions.map(d => ({
        id: d.id, label: d.label, icon: d.icon,
        avg: calcDimAvg(eqScores, d.id, d.questions.length),
      }));
      const scored = dimResults.filter(d => d.avg > 0);
      const overall = scored.length ? +(scored.reduce((a, d) => a + d.avg, 0) / scored.length).toFixed(1) : 0;
      const strongest = [...dimResults].filter(d => d.avg > 0).sort((a, b) => b.avg - a.avg)[0];
      const weakest  = [...dimResults].filter(d => d.avg > 0).sort((a, b) => a.avg - b.avg)[0];
      const nextTestISO = nextTest.toISOString().slice(0, 10);
      const ref = await addDoc(collection(db, 'eqAssessments'), {
        uid: currentUser.uid, label, scores: eqScores, dimResults, overall,
        strongest: strongest?.label || '', weakest: weakest?.label || '',
        nextTestDate: nextTestISO, createdAt: serverTimestamp(),
      });
      const newRecord = {
        id: ref.id, label, scores: eqScores, dimResults, overall,
        strongest: strongest?.label || '', weakest: weakest?.label || '',
        nextTestDate: nextTestISO, createdAt: { seconds: Math.floor(now.getTime() / 1000) },
      };
      setEqHistory(h => [newRecord, ...h]);
      setSaveLabel('');
      setShowLabelInput(false);
      toast.success('Assessment saved!');
    } catch (e) { toast.error('Save failed: ' + e.message); }
    setSaving(false);
  }

  async function saveOpex() {
    if (!currentUser) return toast.error('Not logged in');
    setSaving(true);
    try {
      if (opexDocId) {
        await updateDoc(doc(db, 'eqOpex', opexDocId), { checks: opexChecks });
      } else {
        const ref = await addDoc(collection(db, 'eqOpex'), { uid: currentUser.uid, type: 'opex', checks: opexChecks, createdAt: serverTimestamp() });
        setOpexDocId(ref.id);
      }
      toast.success('OpEx checklist saved!');
    } catch (e) { toast.error('Save failed: ' + e.message); }
    setSaving(false);
  }

  function setScore(dimId, qIdx, val) { setEqScores(s => ({ ...s, [`${dimId}-${qIdx}`]: val })); }
  function toggleOpex(cat, idx) { const k = `${cat}-${idx}`; setOpexChecks(c => ({ ...c, [k]: !c[k] })); }

  function loadRecord(record) {
    setEqScores(record.scores || {});
    setSelectedRecord(record.id);
    toast.success(`Loaded: ${record.label}`);
  }

  const eqResults = eqDimensions.map(dim => {
    const avg = calcDimAvg(eqScores, dim.id, dim.questions.length);
    return { ...dim, avg };
  });
  const avgEQ = eqResults.filter(d => d.avg > 0).length
    ? +(eqResults.filter(d => d.avg > 0).reduce((a, d) => a + d.avg, 0) / eqResults.filter(d => d.avg > 0).length).toFixed(1)
    : 0;

  const totalOpex = opexChecklist.reduce((a, c) => a + c.items.length, 0);
  const checkedOpex = Object.values(opexChecks).filter(Boolean).length;
  const opexPct = Math.round((checkedOpex / totalOpex) * 100);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader icon="💡" title="EQ & OpEx Tools" subtitle="Emotional Intelligence self-assessment and Operational Excellence checklist" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {[{ id: 'eq', label: '💡 EQ Assessment' }, { id: 'opex', label: '⚙️ OpEx Checklist' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: activeTab === t.id ? '#0f2044' : '#f1f5f9', color: activeTab === t.id ? 'white' : '#475569' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'eq' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* Main assessment area */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {eqResults.some(d => d.avg > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 4 }}>
                {eqResults.map(dim => (
                  <div key={dim.id} className="stat-tile" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.375rem', marginBottom: 4 }}>{dim.icon}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: dim.avg >= 4 ? '#0d9488' : dim.avg >= 3 ? '#f59e0b' : dim.avg > 0 ? '#ef4444' : '#94a3b8' }}>{dim.avg || '—'}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{dim.label}</div>
                  </div>
                ))}
              </div>
            )}

            {eqDimensions.map(dim => (
              <div key={dim.id} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '0.875rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{dim.icon}</span>
                    <div>
                      <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.9375rem' }}>{dim.label}</h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>{dim.desc}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <div key={n} style={{ flex: 1, background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#0d9488', marginBottom: 2 }}>{n} — {SCALE_LABELS[n].label}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>{SCALE_LABELS[n].desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {dim.questions.map((q, i) => (
                  <div key={i} style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderBottom: i < dim.questions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <p style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>{q}</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <ScaleButton key={n} n={n} selected={eqScores[`${dim.id}-${i}`] || 0} onClick={() => setScore(dim.id, i, n)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Save area */}
            <div className="card" style={{ padding: '1rem' }}>
              {showLabelInput ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="Assessment label (e.g. Q2 2025)"
                    value={saveLabel}
                    onChange={e => setSaveLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEQ()}
                    autoFocus
                  />
                  <button className="btn-primary" onClick={saveEQ} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                  <button className="btn-secondary" onClick={() => { setShowLabelInput(false); setSaveLabel(''); }}>Cancel</button>
                </div>
              ) : (
                <button className="btn-primary" onClick={() => setShowLabelInput(true)}>Save Assessment</button>
              )}
            </div>
          </div>

          {/* Right sidebar — history */}
          <div style={{ width: 260, flexShrink: 0 }}>
            <div className="card" style={{ overflow: 'hidden', position: 'sticky', top: 20 }}>
              <div style={{ padding: '0.875rem 1rem', background: '#0f2044', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '0.875rem' }}>Saved Assessments</span>
                <span style={{ color: '#99f6e4', fontSize: '0.75rem', fontWeight: 700 }}>{eqHistory.length}</span>
              </div>
              {eqHistory.length === 0 ? (
                <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '1.5rem', margin: '0 0 6px' }}>📋</p>
                  <p style={{ fontSize: '0.78rem', margin: 0 }}>No assessments saved yet</p>
                </div>
              ) : (
                <div style={{ maxHeight: 620, overflowY: 'auto' }}>
                  {eqHistory.map((rec, idx) => {
                    const isSelected = selectedRecord === rec.id;
                    const overall = rec.overall || 0;
                    const nextDate = rec.nextTestDate
                      ? new Date(rec.nextTestDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : null;
                    const today = new Date(); today.setHours(0,0,0,0);
                    const daysUntil = rec.nextTestDate
                      ? Math.round((new Date(rec.nextTestDate + 'T00:00:00') - today) / 86400000)
                      : null;
                    const reminderColor = daysUntil !== null && daysUntil <= 0 ? '#ef4444' : daysUntil <= 7 ? '#f59e0b' : '#0d9488';
                    const reminderBg   = daysUntil !== null && daysUntil <= 0 ? '#fef2f2' : daysUntil <= 7 ? '#fefce8' : '#f0fdf4';
                    const reminderText = daysUntil !== null && daysUntil <= 0 ? 'Retake overdue!' : daysUntil === 0 ? 'Retake today!' : daysUntil !== null ? `Retake in ${daysUntil}d` : null;
                    return (
                      <div key={rec.id} style={{ borderBottom: idx < eqHistory.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ padding: '0.875rem 1rem', background: isSelected ? '#f0fdf4' : 'white' }}>

                          {/* Header row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isSelected ? '#0d9488' : 'var(--text-primary)', lineHeight: 1.3, flex: 1, marginRight: 6 }}>{rec.label}</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: overall >= 4 ? '#0d9488' : overall >= 3 ? '#f59e0b' : overall > 0 ? '#ef4444' : '#94a3b8', flexShrink: 0 }}>{overall || '—'}<span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>/5</span></span>
                          </div>

                          {/* Date */}
                          {rec.createdAt && (
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>📅 {formatDate(rec.createdAt)}</p>
                          )}

                          {/* Dimension bars */}
                          {rec.dimResults && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                              {rec.dimResults.map(d => (
                                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: '0.65rem', width: 76, color: 'var(--text-muted)', flexShrink: 0 }}>{d.icon} {d.label}</span>
                                  <ScoreBar value={d.avg} />
                                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: d.avg >= 4 ? '#0d9488' : d.avg >= 3 ? '#f59e0b' : d.avg > 0 ? '#ef4444' : '#94a3b8', width: 22, textAlign: 'right', flexShrink: 0 }}>{d.avg || '—'}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Strongest / Weakest */}
                          {(rec.strongest || rec.weakest) && (
                            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                              {rec.strongest && <span style={{ fontSize: '0.65rem', background: '#f0fdf4', color: '#0d9488', border: '1px solid #0d948830', borderRadius: 6, padding: '2px 7px', fontWeight: 700 }}>⬆ {rec.strongest}</span>}
                              {rec.weakest  && <span style={{ fontSize: '0.65rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #ef444430', borderRadius: 6, padding: '2px 7px', fontWeight: 700 }}>⬇ {rec.weakest}</span>}
                            </div>
                          )}

                          {/* 60-day reminder */}
                          {nextDate && (
                            <div style={{ background: reminderBg, border: `1px solid ${reminderColor}44`, borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
                              <p style={{ fontSize: '0.68rem', fontWeight: 800, color: reminderColor, margin: '0 0 1px' }}>🔔 Next assessment: {nextDate}</p>
                              {reminderText && <p style={{ fontSize: '0.65rem', color: reminderColor, margin: 0, fontWeight: 600 }}>{reminderText}</p>}
                            </div>
                          )}

                          {/* Load button */}
                          <button
                            onClick={() => loadRecord(rec)}
                            style={{ width: '100%', padding: '0.3rem', borderRadius: 7, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${isSelected ? '#0d9488' : '#e2e8f0'}`, background: isSelected ? '#0d9488' : 'white', color: isSelected ? 'white' : '#64748b', transition: 'all 0.15s' }}>
                            {isSelected ? '✓ Loaded' : 'Load this assessment'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'opex' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>OpEx Compliance Score</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 900, color: opexPct >= 80 ? '#0d9488' : opexPct >= 60 ? '#f59e0b' : '#ef4444' }}>{opexPct}%</span>
            </div>
            <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 10 }}>
              <div style={{ height: 10, borderRadius: 9999, background: opexPct >= 80 ? '#0d9488' : opexPct >= 60 ? '#f59e0b' : '#ef4444', width: `${opexPct}%`, transition: 'width 0.6s ease' }} />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>{checkedOpex} of {totalOpex} behaviors practiced</p>
          </div>

          {opexChecklist.map(cat => (
            <div key={cat.category} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.25rem', background: '#0f2044' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '0.875rem' }}>{cat.category}</span>
              </div>
              {cat.items.map((item, i) => {
                const key = `${cat.category}-${i}`;
                return (
                  <button key={i} onClick={() => toggleOpex(cat.category, i)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1.25rem', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderBottom: i < cat.items.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${opexChecks[key] ? '#0d9488' : '#e2e8f0'}`, background: opexChecks[key] ? '#0d9488' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s' }}>
                      {opexChecks[key] && '✓'}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: opexChecks[key] ? '#94a3b8' : 'var(--text-secondary)', textDecoration: opexChecks[key] ? 'line-through' : 'none' }}>{item}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <button className="btn-primary" onClick={saveOpex} disabled={saving}>{saving ? 'Saving…' : 'Save Checklist'}</button>
        </div>
      )}
    </div>
  );
}
