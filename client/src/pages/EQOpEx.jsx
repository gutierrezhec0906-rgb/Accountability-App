import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { arrayUnion, doc, getDoc, setDoc } from 'firebase/firestore';
import { generateEQReport } from '../utils/eqReport';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const SCALE_LABELS = {
  1: { label: 'Rarely',    desc: 'This behavior is absent or reactive. Others would not recognize it as a strength. Immediate focus needed.' },
  2: { label: 'Sometimes', desc: 'Visible in low-stakes moments but breaks down under pressure or when it costs something. Inconsistent.' },
  3: { label: 'Often',     desc: 'Practiced intentionally but not yet automatic. You catch yourself after the fact more than in the moment.' },
  4: { label: 'Usually',   desc: 'Reliable across most situations, including difficult ones. Others notice and trust it. Minor blind spots remain.' },
  5: { label: 'Always',    desc: 'Deeply embedded. You demonstrate it when hard, teach it to others, and it shapes how your team operates.' },
};

function ScaleButton({ n, selected, onClick, isLast }) {
  const [hovered, setHovered] = useState(false);
  const isActive = n <= selected;
  const color = isActive ? '#0d9488' : hovered ? '#0f2044' : '#e2e8f0';
  const textColor = isActive || hovered ? 'white' : '#94a3b8';

  // Shift tooltip left for the last button so it doesn't overflow viewport
  const tooltipLeft = isLast ? 'auto' : '50%';
  const tooltipRight = isLast ? 0 : 'auto';
  const tooltipTransform = isLast ? 'none' : 'translateX(-50%)';
  const arrowLeft = isLast ? 'auto' : '50%';
  const arrowRight = isLast ? 12 : 'auto';
  const arrowTransform = isLast ? 'none' : 'translateX(-50%)';

  return (
    <div style={{ position: 'relative' }}>
      {hovered && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)',
          left: tooltipLeft, right: tooltipRight, transform: tooltipTransform,
          background: '#0f2044', color: 'white', borderRadius: 10, padding: '8px 12px', zIndex: 100,
          width: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', pointerEvents: 'none',
        }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#99f6e4', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {n} — {SCALE_LABELS[n].label}
          </p>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.45 }}>
            {SCALE_LABELS[n].desc}
          </p>
          <div style={{ position: 'absolute', bottom: -6, left: arrowLeft, right: arrowRight, transform: arrowTransform, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #0f2044' }} />
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

function formatDate(val) {
  if (!val) return '';
  const d = val.toDate ? val.toDate() : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
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
  const { currentUser, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('eq');
  const [eqScores, setEqScores] = useState({});
  const [opexChecks, setOpexChecks] = useState({});
  const [opexFindings, setOpexFindings] = useState({});
  const [opexArea, setOpexArea] = useState('');
  const [opexExpandedItem, setOpexExpandedItem] = useState(null);
  const [opexHistory, setOpexHistory] = useState([]);
  const [opexExpandedAudit, setOpexExpandedAudit] = useState(null);
  const [saving, setSaving] = useState(false);

  // EQ history sidebar
  const [eqHistory, setEqHistory] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [saveLabel, setSaveLabel] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    async function load() {
      try {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          const history = (data.eqHistory || []).slice().reverse();
          setEqHistory(history);
          setOpexHistory(data.opexAudits || []);
        }
      } catch (e) { console.error(e); setLoadError(true); }
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
      const weakest   = [...dimResults].filter(d => d.avg > 0).sort((a, b) => a.avg - b.avg)[0];
      const newRecord = {
        id: now.getTime().toString(),
        label,
        scores: eqScores,
        dimResults,
        overall,
        strongest: strongest?.label || '',
        weakest:   weakest?.label  || '',
        nextTestDate: nextTest.toISOString().slice(0, 10),
        savedAt: now.toISOString(),
      };
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { eqHistory: arrayUnion(newRecord) }, { merge: true });
      setEqHistory(h => [newRecord, ...h]);
      setSaveLabel('');
      setShowLabelInput(false);
      toast.success('Assessment saved!');
    } catch (e) {
      console.error(e);
      toast.error('Save failed: ' + e.message, { duration: 6000 });
    }
    setSaving(false);
  }

  async function saveOpexAudit() {
    if (!currentUser) return toast.error('Not logged in');
    if (!opexArea.trim()) return toast.error('Please enter the area being audited');
    if (checkedOpex === 0) return toast.error('Complete at least one checklist item before saving');
    const dupName = opexArea.trim().toLowerCase();
    if (opexHistory.some(a => a.area.toLowerCase() === dupName)) {
      return toast.error(`An audit for "${opexArea.trim()}" already exists. Use a different name or delete the existing one first.`);
    }
    setSaving(true);
    try {
      const findingsNoImages = Object.fromEntries(
        Object.entries(opexFindings).filter(([, v]) => v.note).map(([k, v]) => [k, { note: v.note }])
      );
      const record = {
        id: Date.now().toString(),
        area: opexArea.trim(),
        score: opexPct,
        checked: checkedOpex,
        total: totalOpex,
        checks: { ...opexChecks },
        findings: findingsNoImages,
        date: new Date().toISOString(),
      };
      const updated = [record, ...opexHistory].slice(0, 50);
      await setDoc(doc(db, 'users', currentUser.uid), { opexAudits: updated }, { merge: true });
      setOpexHistory(updated);
      toast.success(`Audit saved — ${opexPct}% for "${opexArea}"`);
    } catch (e) { toast.error('Save failed: ' + e.message); }
    setSaving(false);
  }

  function loadOpexAudit(record) {
    setOpexChecks(record.checks || {});
    setOpexFindings(record.findings || {});
    setOpexArea(record.area || '');
    setOpexExpandedItem(null);
    toast.success(`Loaded audit: ${record.area}`);
  }

  async function deleteOpexAudit(id) {
    const updated = opexHistory.filter(a => a.id !== id);
    await setDoc(doc(db, 'users', currentUser.uid), { opexAudits: updated }, { merge: true });
    setOpexHistory(updated);
    toast.success('Audit deleted');
  }

  function resetOpexAudit() {
    setOpexChecks({});
    setOpexFindings({});
    setOpexArea('');
    setOpexExpandedItem(null);
  }

  function setOpexFinding(key, field, value) {
    setOpexFindings(f => ({ ...f, [key]: { ...(f[key] || {}), [field]: value } }));
  }

  function handleOpexImageUpload(key, e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setOpexFinding(key, 'image', ev.target.result);
    reader.readAsDataURL(file);
  }

  function removeOpexImage(key) {
    setOpexFindings(f => ({ ...f, [key]: { ...(f[key] || {}), image: null } }));
  }

  function setScore(dimId, qIdx, val) { setEqScores(s => ({ ...s, [`${dimId}-${qIdx}`]: val })); }
  function toggleOpex(cat, idx) { const k = `${cat}-${idx}`; setOpexChecks(c => ({ ...c, [k]: !c[k] })); }

  function loadRecord(record) {
    setEqScores(record.scores || {});
    setSelectedRecord(record.id);
    toast.success(`Loaded: ${record.label}`);
  }

  async function deleteRecord(recordId) {
    if (!currentUser) return;
    const updated = eqHistory.filter(r => r.id !== recordId);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { eqHistory: updated }, { merge: true });
      setEqHistory(updated);
      if (selectedRecord === recordId) setSelectedRecord(null);
      toast.success('Assessment deleted.');
    } catch {
      toast.error('Could not delete — try again.');
    }
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Saved assessments history panel */}
          {(eqHistory.length > 0 || loadError) && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0.875rem 1.25rem', background: '#0f2044', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>📋 Saved Assessments</span>
                <span style={{ color: '#99f6e4', fontSize: '0.78rem', fontWeight: 700 }}>{eqHistory.length} record{eqHistory.length !== 1 ? 's' : ''}</span>
              </div>
              {loadError && (
                <div style={{ padding: '0.75rem 1.25rem', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                  <p style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700, margin: 0 }}>⚠️ Could not load history — check Firestore rules for the users collection.</p>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 0 }}>
                {eqHistory.map((rec, idx) => {
                  const isSelected = selectedRecord === rec.id;
                  const overall = rec.overall || 0;
                  const nextDate = rec.nextTestDate
                    ? new Date(rec.nextTestDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : null;
                  const today = new Date(); today.setHours(0,0,0,0);
                  const daysUntil = rec.nextTestDate ? Math.round((new Date(rec.nextTestDate + 'T00:00:00') - today) / 86400000) : null;
                  const reminderColor = daysUntil !== null && daysUntil <= 0 ? '#ef4444' : daysUntil !== null && daysUntil <= 7 ? '#f59e0b' : '#0d9488';
                  const reminderBg   = daysUntil !== null && daysUntil <= 0 ? '#fef2f2' : daysUntil !== null && daysUntil <= 7 ? '#fefce8' : '#f0fdf4';
                  const reminderText = daysUntil !== null && daysUntil <= 0 ? 'Retake overdue!' : daysUntil !== null ? `Retake in ${daysUntil} days` : null;
                  return (
                    <div key={rec.id} style={{ padding: '1rem 1.25rem', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: isSelected ? '#f0fdf4' : 'white' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 800, color: isSelected ? '#0d9488' : 'var(--text-primary)', flex: 1, marginRight: 8 }}>{rec.label}</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: overall >= 4 ? '#0d9488' : overall >= 3 ? '#f59e0b' : overall > 0 ? '#ef4444' : '#94a3b8' }}>
                          {overall || '—'}<span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>/5</span>
                        </span>
                      </div>
                      {/* Date */}
                      {(rec.savedAt || rec.createdAt) && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>📅 {formatDate(rec.savedAt || rec.createdAt)}</p>
                      )}
                      {/* Dimension bars */}
                      {rec.dimResults && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                          {rec.dimResults.map(d => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.68rem', width: 90, color: 'var(--text-muted)', flexShrink: 0 }}>{d.icon} {d.label}</span>
                              <ScoreBar value={d.avg} />
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: d.avg >= 4 ? '#0d9488' : d.avg >= 3 ? '#f59e0b' : d.avg > 0 ? '#ef4444' : '#94a3b8', width: 24, textAlign: 'right', flexShrink: 0 }}>{d.avg || '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Strongest / Weakest tags */}
                      {(rec.strongest || rec.weakest) && (
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                          {rec.strongest && <span style={{ fontSize: '0.68rem', background: '#f0fdf4', color: '#0d9488', border: '1px solid #0d948830', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>⬆ {rec.strongest}</span>}
                          {rec.weakest   && <span style={{ fontSize: '0.68rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #ef444430', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>⬇ {rec.weakest}</span>}
                        </div>
                      )}
                      {/* 60-day reminder */}
                      {nextDate && (
                        <div style={{ background: reminderBg, border: `1px solid ${reminderColor}44`, borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
                          <p style={{ fontSize: '0.72rem', fontWeight: 800, color: reminderColor, margin: '0 0 2px' }}>🔔 Next: {nextDate}</p>
                          {reminderText && <p style={{ fontSize: '0.68rem', color: reminderColor, margin: 0, fontWeight: 600 }}>{reminderText}</p>}
                        </div>
                      )}
                      {/* Load + Delete buttons */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <button onClick={() => loadRecord(rec)}
                          style={{ flex: 1, padding: '0.35rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${isSelected ? '#0d9488' : '#e2e8f0'}`, background: isSelected ? '#0d9488' : 'white', color: isSelected ? 'white' : '#64748b', transition: 'all 0.15s' }}>
                          {isSelected ? '✓ Loaded' : 'Load'}
                        </button>
                        <button onClick={() => {
                          if (window.confirm('Delete this assessment? This cannot be undone.')) deleteRecord(rec.id);
                        }}
                          style={{ padding: '0.35rem 0.6rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: '1.5px solid #fecaca', background: 'white', color: '#ef4444', transition: 'all 0.15s' }}>
                          🗑 Delete
                        </button>
                      </div>
                      {/* PDF Report button */}
                      <button
                        onClick={() => generateEQReport(rec, userProfile?.displayName || currentUser?.displayName || '', userProfile?.role || '')}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: '1.5px solid #0f2044', background: '#0f2044', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                        📄 Download Recommendations Report
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assessment form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                </div>
                {dim.questions.map((q, i) => (
                  <div key={i} style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderBottom: i < dim.questions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <p style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>{q}</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <ScaleButton key={n} n={n} selected={eqScores[`${dim.id}-${i}`] || 0} onClick={() => setScore(dim.id, i, n)} isLast={n === 5} />
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
                    placeholder="Label (e.g. Q2 2025) — optional"
                    value={saveLabel}
                    onChange={e => setSaveLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEQ()}
                    autoFocus
                  />
                  <button className="btn-primary" onClick={saveEQ} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                  <button className="btn-secondary" onClick={() => { setShowLabelInput(false); setSaveLabel(''); }}>Cancel</button>
                </div>
              ) : (
                <button className="btn-primary" onClick={() => {
                  const totalQuestions = eqDimensions.reduce((sum, d) => sum + d.questions.length, 0);
                  const answered = eqDimensions.reduce((sum, d) => sum + d.questions.filter((_, i) => eqScores[`${d.id}-${i}`]).length, 0);
                  if (answered < totalQuestions) {
                    toast.error(`Please complete the full assessment — ${answered} of ${totalQuestions} questions answered.`, { duration: 4000 });
                    return;
                  }
                  setShowLabelInput(true);
                }}>Save Assessment</button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'opex' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* ── Left: checklist ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Area input + score card */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: 12 }}>
                <label className="label">Area / Location Being Audited</label>
                <input className="input" value={opexArea} onChange={e => setOpexArea(e.target.value)}
                  placeholder="e.g. Production Floor, Warehouse, Office — Q3 2026…" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>OpEx Compliance Score</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 900, color: opexPct >= 80 ? '#0d9488' : opexPct >= 60 ? '#f59e0b' : '#ef4444' }}>{opexPct}%</span>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 10, marginBottom: 6 }}>
                <div style={{ height: 10, borderRadius: 9999, background: opexPct >= 80 ? '#0d9488' : opexPct >= 60 ? '#f59e0b' : '#ef4444', width: `${opexPct}%`, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{checkedOpex} of {totalOpex} behaviors practiced</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }} onClick={resetOpexAudit}>↺ Reset</button>
                  <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.875rem' }} onClick={saveOpexAudit} disabled={saving}>{saving ? 'Saving…' : '💾 Save Audit'}</button>
                  {(opexArea.trim() || checkedOpex > 0) && (
                    <button style={{ fontSize: '0.78rem', padding: '0.3rem 0.875rem', borderRadius: 9999, fontWeight: 700, border: '1.5px solid #0d9488', background: 'white', color: '#0d9488', cursor: 'pointer' }} onClick={resetOpexAudit}>＋ New Audit</button>
                  )}
                </div>
              </div>
            </div>

            {opexChecklist.map(cat => (
              <div key={cat.category} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1.25rem', background: '#0f2044' }}>
                  <span style={{ color: 'white', fontWeight: 800, fontSize: '0.875rem' }}>{cat.category}</span>
                </div>
                {cat.items.map((item, i) => {
                  const key = `${cat.category}-${i}`;
                  const isExpanded = opexExpandedItem === key;
                  const finding = opexFindings[key] || {};
                  const hasFinding = finding.note || finding.image;
                  return (
                    <div key={i} style={{ borderBottom: i < cat.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1.25rem' }}>
                        <button onClick={() => toggleOpex(cat.category, i)}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${opexChecks[key] ? '#0d9488' : '#e2e8f0'}`, background: opexChecks[key] ? '#0d9488' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s' }}>
                            {opexChecks[key] && '✓'}
                          </div>
                          <span style={{ fontSize: '0.875rem', color: opexChecks[key] ? '#94a3b8' : 'var(--text-secondary)', textDecoration: opexChecks[key] ? 'line-through' : 'none' }}>{item}</span>
                        </button>
                        {hasFinding && !isExpanded && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#fef9c3', color: '#b45309', border: '1px solid #fde68a', borderRadius: 9999, padding: '1px 7px', flexShrink: 0 }}>
                            {finding.image ? '📎 Photo' : '📝 Note'}
                          </span>
                        )}
                        <button onClick={() => setOpexExpandedItem(isExpanded ? null : key)}
                          title={isExpanded ? 'Collapse' : 'Add finding / photo'}
                          style={{ background: isExpanded ? '#f1f5f9' : 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '3px 9px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', cursor: 'pointer', flexShrink: 0 }}>
                          {isExpanded ? '▲' : '📎'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div style={{ margin: '0 1.25rem 0.875rem', background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Finding Details</p>
                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description / Finding</label>
                            <textarea className="input" rows={3} style={{ fontSize: '0.825rem', resize: 'vertical' }}
                              placeholder="Describe what was observed, the gap, or the non-conformance…"
                              value={finding.note || ''}
                              onChange={e => setOpexFinding(key, 'note', e.target.value)} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Photo Evidence (PNG, JPG, GIF — max 5 MB)</label>
                            {finding.image ? (
                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                <img src={finding.image} alt="Finding" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                                <button onClick={() => removeOpexImage(key)}
                                  style={{ position: 'absolute', top: 6, right: 6, background: '#ef4444', border: 'none', borderRadius: '50%', width: 24, height: 24, color: 'white', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              </div>
                            ) : (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderRadius: 8, border: '1.5px dashed #cbd5e1', cursor: 'pointer', background: 'white', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                                📷 Click to attach photo
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleOpexImageUpload(key, e)} />
                              </label>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ── Right: audit history ── */}
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: '1.125rem' }}>
              <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', fontSize: '0.9rem' }}>📋 Audit History</h4>
              {opexHistory.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', margin: '1.5rem 0' }}>No audits saved yet. Complete the checklist and click Save Audit.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {opexHistory.map(record => {
                    const scoreColor = record.score >= 80 ? '#0d9488' : record.score >= 60 ? '#f59e0b' : '#ef4444';
                    const scoreBg    = record.score >= 80 ? '#f0fdfa' : record.score >= 60 ? '#fffbeb' : '#fef2f2';
                    const isExp = opexExpandedAudit === record.id;
                    const dateStr = new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <div key={record.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.area}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{dateStr}</p>
                          </div>
                          <span style={{ background: scoreBg, color: scoreColor, fontWeight: 800, fontSize: '0.875rem', borderRadius: 8, padding: '2px 10px', border: `1px solid ${scoreColor}33`, flexShrink: 0 }}>{record.score}%</span>
                        </div>
                        <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                          <button onClick={() => loadOpexAudit(record)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#0d9488' }}>
                            📂 Load
                          </button>
                          <button onClick={() => setOpexExpandedAudit(isExp ? null : record.id)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#64748b' }}>
                            {isExp ? '▲' : '▼'} Details
                          </button>
                          <button onClick={() => deleteOpexAudit(record.id)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                            🗑
                          </button>
                        </div>
                        {isExp && (
                          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', background: '#f8fafc', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{record.checked} / {record.total} items completed</p>
                            {Object.keys(record.findings || {}).length > 0 && (
                              <p style={{ margin: 0, color: '#b45309' }}>📝 {Object.keys(record.findings).length} note(s) recorded</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
