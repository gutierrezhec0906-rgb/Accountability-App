import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logPointEvent, calculateScore } from '../utils/scoring';

function printVision(entry, prompts) {
  const dateStr = entry.createdAt
    ? new Date(entry.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const typeLabel = entry.mode === 'team' ? 'Team Vision Statement' : 'Personal Vision Statement';

  const qaRows = prompts
    .filter(p => entry.answers?.[p.step])
    .map(p => `
      <div class="qa">
        <div class="q-label">Q${p.step} — ${p.question}</div>
        <div class="a-text">${entry.answers[p.step]}</div>
      </div>`)
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${typeLabel}</title>
  <style>
    @page { margin: 2cm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; margin: 0; }
    .header { border-bottom: 3px solid #0f2044; padding-bottom: 18px; margin-bottom: 28px; }
    .app-name { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #64748b; margin: 0 0 6px; font-family: Helvetica, Arial, sans-serif; }
    .type-label { font-size: 13px; font-weight: bold; color: #0d9488; letter-spacing: .08em; text-transform: uppercase; font-family: Helvetica, Arial, sans-serif; margin: 0 0 4px; }
    .date { font-size: 12px; color: #94a3b8; font-family: Helvetica, Arial, sans-serif; margin: 0; }
    .vision-box { background: #f0fdf4 !important; border-left: 5px solid #0d9488; padding: 20px 24px; margin-bottom: 32px; border-radius: 4px; }
    .open-quote { font-size: 64px; color: #0d9488; line-height: .6; display: block; margin-bottom: 8px; font-family: Georgia, serif; }
    .vision-text { font-size: 16px; line-height: 1.75; color: #0f2044; font-style: italic; margin: 0; }
    .qa-section-title { font-size: 12px; font-weight: bold; letter-spacing: .1em; text-transform: uppercase; color: #475569; font-family: Helvetica, Arial, sans-serif; margin: 0 0 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .qa { margin-bottom: 18px; padding-left: 14px; border-left: 3px solid #0d9488; }
    .q-label { font-size: 11px; font-weight: bold; color: #0d9488; text-transform: uppercase; letter-spacing: .06em; font-family: Helvetica, Arial, sans-serif; margin-bottom: 4px; }
    .a-text { font-size: 13px; color: #334155; line-height: 1.6; }
    .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; font-family: Helvetica, Arial, sans-serif; }
  </style>
</head>
<body>
  <div class="header">
    <p class="app-name">Accountability App</p>
    <p class="type-label">${typeLabel}</p>
    <p class="date">Created: ${dateStr}</p>
  </div>

  <div class="vision-box">
    <span class="open-quote">"</span>
    <p class="vision-text">${entry.vision}"</p>
  </div>

  ${qaRows ? `<p class="qa-section-title">Reflection Questions & Answers</p>${qaRows}` : ''}

  <div class="footer">Accountability App &nbsp;·&nbsp; Vision Builder &nbsp;·&nbsp; Confidential</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=700');
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

const personalPrompts = [
  { step: 1, question: "What kind of leader do I want to be known as in 5 years?",     placeholder: "Describe your ideal leadership identity..." },
  { step: 2, question: "What impact do I want to have on my team and organization?",    placeholder: "What change or legacy do you want to leave?" },
  { step: 3, question: "What values are non-negotiable in how I lead?",                 placeholder: "e.g. Integrity, transparency, accountability..." },
  { step: 4, question: "What does success look like for my career in 3 years?",        placeholder: "Describe your personal future state..." },
  { step: 5, question: "What specific actions will I commit to starting this week?",    placeholder: "Be concrete — what will you do Monday?" },
];

const teamPrompts = [
  { step: 1, question: "What kind of team do we want to be known as in 5 years?",      placeholder: "Describe your team's ideal identity..." },
  { step: 2, question: "What impact do we want to have on the organization?",           placeholder: "What change or legacy will your team leave?" },
  { step: 3, question: "What values are non-negotiable in how we operate?",             placeholder: "e.g. Accountability, trust, continuous improvement..." },
  { step: 4, question: "What does success look like for our team in 3 years?",         placeholder: "Describe your team's future state..." },
  { step: 5, question: "What commitments will our team make starting this week?",       placeholder: "Be concrete — what will the team do Monday?" },
];

function SavedPanel({ entries, onDelete, onLoad, onEdit, activeTab, setActiveTab, expandedId, setExpandedId }) {
  const personal = entries.filter(e => e.mode === 'personal');
  const team     = entries.filter(e => e.mode === 'team');
  const list     = activeTab === 'personal' ? personal : team;

  return (
    <div style={{ width: 290, flexShrink: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem', alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
      <p style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0 0 12px' }}>Saved Visions</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['personal', `👤 Personal (${personal.length})`], ['team', `👥 Team (${team.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{ flex: 1, padding: '0.3rem 0', borderRadius: 8, fontWeight: 700, fontSize: '0.72rem', border: 'none', cursor: 'pointer',
              background: activeTab === key ? '#0f2044' : '#f1f5f9', color: activeTab === key ? 'white' : '#475569' }}>
            {label}
          </button>
        ))}
      </div>

      {list.length === 0
        ? <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 24 }}>No saved {activeTab} visions yet.</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 620, overflowY: 'auto' }}>
            {list.map(e => {
              const d = e.createdAt ? new Date(e.createdAt) : new Date();
              const isExpanded = expandedId === e.id;
              const prompts = e.mode === 'personal' ? personalPrompts : teamPrompts;
              return (
                <div key={e.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '0.75rem', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>{d.toLocaleDateString()}</p>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 6px', lineHeight: 1.5,
                    ...(!isExpanded ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}) }}>
                    "{e.vision}"
                  </p>

                  {/* Toggle Q&A dropdown */}
                  <button onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    style={{ background: 'none', border: 'none', color: '#0d9488', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', padding: '0 0 6px' }}>
                    {isExpanded ? '▲ Hide answers' : '▼ Show Q&A answers'}
                  </button>

                  {/* Q&A answers dropdown */}
                  {isExpanded && e.answers && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                      {prompts.map(p => e.answers[p.step] && (
                        <div key={p.step} style={{ borderLeft: '3px solid #0d9488', paddingLeft: 8 }}>
                          <p style={{ fontSize: '0.62rem', fontWeight: 700, color: '#0d9488', margin: '0 0 2px', textTransform: 'uppercase' }}>Q{p.step}</p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 2px' }}>{p.question}</p>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{e.answers[p.step]}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => onLoad(e)}
                      style={{ flex: 1, padding: '0.25rem 0', borderRadius: 7, fontSize: '0.7rem', fontWeight: 700, border: '1px solid #0d9488', background: 'white', color: '#0d9488', cursor: 'pointer' }}>
                      Load
                    </button>
                    <button onClick={() => onEdit(e)}
                      style={{ flex: 1, padding: '0.25rem 0', borderRadius: 7, fontSize: '0.7rem', fontWeight: 700, border: '1px solid #0f2044', background: 'white', color: '#0f2044', cursor: 'pointer' }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => printVision(e, prompts)}
                      style={{ flex: 1, padding: '0.25rem 0', borderRadius: 7, fontSize: '0.7rem', fontWeight: 700, border: '1px solid #6366f1', background: 'white', color: '#6366f1', cursor: 'pointer' }}>
                      🖨️ Print
                    </button>
                    <button onClick={() => onDelete(e.id)}
                      style={{ padding: '0.25rem 0.5rem', borderRadius: 7, fontSize: '0.7rem', fontWeight: 700, border: '1px solid #fca5a5', background: 'white', color: '#ef4444', cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

export default function Vision() {
  const { currentUser } = useAuth();
  const [saved, setSaved]           = useState([]);
  const [panelTab, setPanelTab]     = useState('personal');
  const [editingId, setEditingId]   = useState(null);
  const [editVision, setEditVision] = useState('');
  const [editingQ, setEditingQ]     = useState(null);
  const [editQVal, setEditQVal]     = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [mode, setMode]             = useState('personal');

  const [modeState, setModeState] = useState({
    personal: { answers: {}, vision: '', step: 0, loadedId: null },
    team:     { answers: {}, vision: '', step: 0, loadedId: null },
  });

  const { answers, vision, step, loadedId } = modeState[mode];

  function updateMode(patch) {
    setModeState(prev => ({ ...prev, [mode]: { ...prev[mode], ...patch } }));
  }
  const setAnswers  = val => updateMode({ answers: typeof val === 'function' ? val(modeState[mode].answers) : val });
  const setVision   = val => updateMode({ vision: val });
  const setStep     = val => updateMode({ step: typeof val === 'function' ? val(modeState[mode].step) : val });
  const setLoadedId = val => updateMode({ loadedId: val });

  // Load from users/{uid}.visions array
  async function fetchSaved() {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) setSaved(snap.data().visions || []);
    } catch (e) { console.error('fetchSaved error:', e); }
  }

  async function persistSaved(list) {
    await setDoc(doc(db, 'users', currentUser.uid), { visions: list }, { merge: true });
    setSaved(list);
  }

  useEffect(() => { fetchSaved(); }, [currentUser]);

  function generateVision() {
    if (Object.keys(answers).filter(k => answers[k]).length < 2) return toast.error('Answer at least 2 questions first');
    let stmt;
    if (mode === 'personal') {
      stmt = `As a leader, I am committed to ${answers[3] || 'my core values'}. I will ${answers[2] || 'make a lasting impact'} by ${answers[5] || 'taking deliberate daily actions'}. My vision is to ${answers[4] || 'build a high-performance team'} where ${answers[1] || 'I am known as a trusted leader'}.`;
    } else {
      stmt = `As a team, we are committed to ${answers[3] || 'our core values'}. We will ${answers[2] || 'make a lasting impact on the organization'} by ${answers[5] || 'taking deliberate collective action'}. Our vision is to ${answers[4] || 'be a high-performing team'} where ${answers[1] || 'we are known for excellence'}.`;
    }
    setVision(stmt);
    toast.success('Vision statement generated!');
  }

  async function handleSave() {
    if (!vision) return toast.error('Generate a vision statement first');
    if (!currentUser) return toast.error('Not logged in');
    try {
      if (loadedId) {
        const updated = saved.map(e => e.id === loadedId ? { ...e, vision, answers, mode } : e);
        await persistSaved(updated);
        toast.success('Vision updated!');
      } else {
        const newEntry = { id: Date.now().toString(), mode, vision, answers, createdAt: new Date().toISOString() };
        const updated = [newEntry, ...saved];
        await persistSaved(updated);
        setLoadedId(newEntry.id);

        // Award 10 pts once per vision type (personal / team), lifetime, no decay
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        const earned = snap.exists() ? (snap.data().visionPointsEarned || {}) : {};
        if (!earned[mode]) {
          const label = mode === 'personal' ? 'Personal Vision' : 'Team Vision';
          const { awarded, capReached } = await logPointEvent(currentUser.uid, {
            points: 10,
            toolLabel: label,
            reason: `Created first ${label} statement`,
          });
          if (awarded) {
            await updateDoc(doc(db, 'users', currentUser.uid), {
              bonusPoints: increment(10),
              [`visionPointsEarned.${mode}`]: true,
            });
            calculateScore(currentUser.uid).catch(() => {});
            toast.success(`⭐ Vision saved! +10 pts for your first ${label.toLowerCase()}`, { duration: 6000, icon: '🌟' });
          } else {
            // Still mark as earned so points are awarded next day
            await updateDoc(doc(db, 'users', currentUser.uid), { [`visionPointsEarned.${mode}`]: true });
            if (capReached) {
              toast('Vision saved! You\'ve hit your 25-pt daily limit — your +10 pts will be credited when you return tomorrow. 🗓', { duration: 6000, icon: '📅' });
            } else {
              toast.success('Vision saved!');
            }
          }
        } else {
          toast.success('Vision saved!');
        }
      }
      setPanelTab(mode);
    } catch (e) { toast.error('Save failed: ' + e?.message); }
  }

  async function handleDelete(id) {
    try {
      const updated = saved.filter(e => e.id !== id);
      await persistSaved(updated);
      setModeState(prev => ({
        personal: prev.personal.loadedId === id ? { ...prev.personal, loadedId: null } : prev.personal,
        team:     prev.team.loadedId     === id ? { ...prev.team,     loadedId: null } : prev.team,
      }));
      if (expandedId === id) setExpandedId(null);
    } catch (e) { toast.error('Delete failed: ' + e?.message); }
  }

  function handleLoad(entry) {
    setMode(entry.mode);
    setModeState(prev => ({
      ...prev,
      [entry.mode]: { answers: entry.answers || {}, vision: entry.vision, step: 0, loadedId: entry.id },
    }));
    setEditingId(null);
    setEditingQ(null);
    toast.success('Vision loaded!');
  }

  function handleEdit(entry) {
    setEditingId(entry.id);
    setEditVision(entry.vision);
  }

  async function handleSaveEdit() {
    if (!editVision.trim()) return toast.error('Vision statement cannot be empty');
    try {
      if (editingId === 'current') {
        setVision(editVision);
        if (loadedId) {
          const updated = saved.map(e => e.id === loadedId ? { ...e, vision: editVision } : e);
          await persistSaved(updated);
        }
      } else {
        const updated = saved.map(e => e.id === editingId ? { ...e, vision: editVision } : e);
        await persistSaved(updated);
      }
      toast.success('Vision updated!');
      setEditingId(null);
      setEditVision('');
    } catch (e) { toast.error('Update failed: ' + e?.message); }
  }

  function startEditQ(stepNum) {
    setEditingQ(stepNum);
    setEditQVal(answers[stepNum] || '');
  }

  async function saveEditQ(stepNum) {
    const newAnswers = { ...answers, [stepNum]: editQVal };
    setAnswers(newAnswers);
    setEditingQ(null);
    setEditQVal('');
    if (loadedId) {
      try {
        const updated = saved.map(e => e.id === loadedId ? { ...e, answers: newAnswers } : e);
        await persistSaved(updated);
        toast.success('Answer saved');
      } catch (e) { toast.error('Save failed: ' + e?.message); }
    }
  }

  const prompts       = mode === 'personal' ? personalPrompts : teamPrompts;
  const answeredCount = prompts.filter(p => answers[p.step]).length;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader icon="🔭" title="Vision Builder" subtitle="Create a compelling personal or team vision statement" />

      {/* Edit saved vision modal */}
      {editingId && editingId !== 'current' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 1rem', fontSize: '1.05rem' }}>✏️ Edit Vision Statement</h3>
            <textarea className="input" rows={6} value={editVision} onChange={e => setEditVision(e.target.value)}
              style={{ width: '100%', fontSize: '0.9rem', lineHeight: 1.7 }} autoFocus />
            <div style={{ display: 'flex', gap: 10, marginTop: '1rem' }}>
              <button className="btn-primary" onClick={handleSaveEdit}>Save Changes</button>
              <button className="btn-secondary" onClick={() => { setEditingId(null); setEditVision(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
            {[{ key: 'personal', label: '👤 Personal Vision' }, { key: 'team', label: '👥 Team Vision' }].map(m => (
              <button key={m.key} onClick={() => { setMode(m.key); setEditingQ(null); setEditingId(null); setPanelTab(m.key); }}
                style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: mode === m.key ? '#0f2044' : '#f1f5f9', color: mode === m.key ? 'white' : '#475569' }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Vision statement banner */}
          {!vision && (
            <div style={{ borderRadius: 16, padding: '1.75rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg,#0b1a38,#0f2044,#1e3a6e)', color: 'white', position: 'relative', overflow: 'hidden', border: '2px dashed rgba(255,255,255,0.15)' }}>
              <div style={{ position: 'absolute', top: 12, right: 20, fontSize: '5rem', opacity: 0.05, fontFamily: 'Georgia,serif', lineHeight: 1 }}>"</div>
              <p style={{ color: '#99f6e4', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                {mode === 'personal' ? '👤 Personal Vision Statement' : '👥 Team Vision Statement'}
              </p>
              <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 6px', fontStyle: 'italic' }}>
                Your {mode === 'personal' ? 'personal' : 'team'} vision will appear here once generated.
              </p>
              <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                Answer the {prompts.length} questions below and click ✨ Generate Vision Statement.
              </p>
            </div>
          )}
          {vision && (
            <div style={{ borderRadius: 16, padding: '1.75rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg,#0b1a38,#0f2044,#0d9488)', color: 'white', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 12, right: 20, fontSize: '5rem', opacity: 0.07, fontFamily: 'Georgia,serif', lineHeight: 1 }}>"</div>
              <p style={{ color: '#99f6e4', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                Your Vision Statement {loadedId && <span style={{ opacity: 0.7 }}>· Auto-saved</span>}
              </p>
              {editingId === 'current'
                ? <>
                    <textarea value={editVision} onChange={e => setEditVision(e.target.value)} rows={4} autoFocus
                      style={{ width: '100%', fontSize: '0.95rem', lineHeight: 1.7, borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.75rem', marginBottom: 12, resize: 'vertical', outline: 'none' }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={handleSaveEdit}
                        style={{ background: '#0d9488', border: 'none', borderRadius: 8, padding: '0.3rem 0.875rem', color: 'white', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>
                        ✓ Apply
                      </button>
                      <button onClick={() => setEditingId(null)}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '0.3rem 0.875rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                        Cancel
                      </button>
                    </div>
                  </>
                : <>
                    <p style={{ fontSize: '1rem', lineHeight: 1.7, margin: '0 0 14px', color: 'rgba(255,255,255,0.9)' }}>"{vision}"</p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={() => updateMode({ vision: '', answers: {}, step: 0, loadedId: null })}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '0.3rem 0.875rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                        Clear & Start Over
                      </button>
                      <button onClick={() => { setEditingId('current'); setEditVision(vision); }}
                        style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '0.3rem 0.875rem', color: 'white', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>
                        ✏️ Edit
                      </button>
                      <button onClick={handleSave}
                        style={{ background: '#0d9488', border: 'none', borderRadius: 8, padding: '0.3rem 0.875rem', color: 'white', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>
                        💾 {loadedId ? 'Update Vision' : 'Save Vision'}
                      </button>
                      <button onClick={() => printVision({ vision, answers, mode, createdAt: new Date().toISOString() }, prompts)}
                        style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '0.3rem 0.875rem', color: 'white', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>
                        🖨️ Print
                      </button>
                    </div>
                  </>
              }
            </div>
          )}

          {/* Step progress */}
          <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem' }}>
            {prompts.map((p, i) => (
              <button key={p.step} onClick={() => setStep(i)} title={p.question}
                style={{ flex: 1, height: 6, borderRadius: 9999, background: answers[p.step] ? '#0d9488' : step === i ? '#99f6e4' : '#e2e8f0', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }} />
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{answeredCount} of {prompts.length} questions answered</p>

          {/* Current prompt */}
          <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Question {step + 1} of {prompts.length}</p>
            <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem', margin: '0 0 1rem', lineHeight: 1.4 }}>{prompts[step].question}</h3>
            <textarea className="input" rows={5} value={answers[prompts[step].step] || ''}
              onChange={e => setAnswers(a => ({ ...a, [prompts[step].step]: e.target.value }))}
              placeholder={prompts[step].placeholder} />
            <div style={{ display: 'flex', gap: 10, marginTop: '1rem' }}>
              {step > 0 && <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>← Previous</button>}
              {step < prompts.length - 1
                ? <button className="btn-primary" onClick={() => setStep(s => s + 1)}>Next →</button>
                : <button className="btn-primary" onClick={generateVision}>✨ Generate Vision Statement</button>
              }
            </div>
          </div>

          {/* Answers summary with inline edit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {prompts.map((p, i) => answers[p.step] && (
              <div key={p.step} className="card" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Q{p.step}</p>
                  {editingQ !== p.step
                    ? <button onClick={() => startEditQ(p.step)}
                        style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
                        ✏️ Edit
                      </button>
                    : <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => saveEditQ(p.step)}
                          style={{ background: '#0d9488', border: 'none', borderRadius: 6, padding: '2px 10px', fontSize: '0.68rem', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
                          Save
                        </button>
                        <button onClick={() => setEditingQ(null)}
                          style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                  }
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 6px' }}>{p.question}</p>
                {editingQ === p.step
                  ? <textarea className="input" rows={3} value={editQVal} onChange={e => setEditQVal(e.target.value)}
                      style={{ fontSize: '0.875rem' }} autoFocus />
                  : <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, cursor: 'pointer' }}
                      onClick={() => setStep(i)}>
                      {answers[p.step]}
                    </p>
                }
              </div>
            ))}
          </div>
        </div>

        <SavedPanel
          entries={saved}
          onDelete={handleDelete}
          onLoad={handleLoad}
          onEdit={handleEdit}
          activeTab={panelTab}
          setActiveTab={setPanelTab}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
        />
      </div>
    </div>
  );
}
