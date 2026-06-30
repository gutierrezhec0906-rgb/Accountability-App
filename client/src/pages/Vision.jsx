import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, query, where, doc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const prompts = [
  { step: 1, question: "What kind of leader do I want to be known as in 5 years?",        placeholder: "Describe your ideal leadership identity..." },
  { step: 2, question: "What impact do I want to have on my team and organization?",       placeholder: "What change or legacy do you want to leave?" },
  { step: 3, question: "What values are non-negotiable in how I lead?",                    placeholder: "e.g. Integrity, transparency, accountability..." },
  { step: 4, question: "What does success look like for my team in 3 years?",              placeholder: "Describe your team's future state..." },
  { step: 5, question: "What specific actions will I commit to starting this week?",       placeholder: "Be concrete — what will you do Monday?" },
];

function escalation(dueDate) {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dueDate + 'T00:00:00');
  const days  = Math.round((due - today) / 86400000);
  if (days < 0)  return { color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', label: `${Math.abs(days)}d overdue`, icon: '🔴', overdue: true };
  if (days <= 5) return { color: '#d97706', bg: '#fffbeb', border: '#fcd34d', label: days === 0 ? 'Due today' : `Due in ${days}d`, icon: '🟡', overdue: false };
  return           { color: '#059669', bg: '#ecfdf5', border: '#6ee7b7', label: `Due in ${days}d`, icon: '🟢', overdue: false };
}

// Modal for past-due recommitment
function RecommitModal({ entry, onSubmit, onDismiss }) {
  const [newDate, setNewDate] = useState('');
  const esc = escalation(entry.dueDate);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 18, padding: '2rem', maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>🔴</div>
          <div>
            <p style={{ fontWeight: 900, color: '#ef4444', margin: 0, fontSize: '1rem' }}>Action Past Due — Recommitment Required</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Originally due {new Date(entry.dueDate + 'T00:00:00').toLocaleDateString()} · {esc?.label}</p>
          </div>
        </div>

        {/* Vision excerpt */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.875rem', marginBottom: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{entry.mode === 'personal' ? '👤 Personal' : '👥 Team'} Vision</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{entry.vision}"</p>
        </div>

        {/* Penalty warning */}
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '0.75rem', marginBottom: '1.25rem', display: 'flex', gap: 8 }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: '0.78rem', color: '#92400e', margin: 0, lineHeight: 1.5 }}>
            <strong>5 points will be deducted</strong> from your accountability score if you close this without setting a new commitment date.
          </p>
        </div>

        {/* New date picker */}
        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: 6 }}>
          📅 New Commitment Date
        </label>
        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          style={{ width: '100%', padding: '0.6rem 0.875rem', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: '0.9rem', marginBottom: '1.25rem', boxSizing: 'border-box', outline: 'none' }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onSubmit(entry.id, newDate)} disabled={!newDate}
            style={{ flex: 1, padding: '0.65rem', borderRadius: 10, background: newDate ? '#0f2044' : '#e2e8f0', color: newDate ? 'white' : '#94a3b8', fontWeight: 800, fontSize: '0.875rem', border: 'none', cursor: newDate ? 'pointer' : 'not-allowed' }}>
            ✓ Commit to New Date
          </button>
          <button onClick={onDismiss}
            style={{ padding: '0.65rem 1rem', borderRadius: 10, background: '#fef2f2', color: '#ef4444', fontWeight: 700, fontSize: '0.875rem', border: '1px solid #fca5a5', cursor: 'pointer' }}>
            Close (−5 pts)
          </button>
        </div>
      </div>
    </div>
  );
}

function SavedPanel({ entries, onDelete, onLoad, activeTab, setActiveTab }) {
  const personal = entries.filter(e => e.mode === 'personal');
  const team     = entries.filter(e => e.mode === 'team');
  const list     = activeTab === 'personal' ? personal : team;

  return (
    <div style={{ width: 280, flexShrink: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem', alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['🔴', '#ef4444', 'Past due'], ['🟡', '#d97706', '≤ 5 days'], ['🟢', '#059669', '6+ days']].map(([icon, color, label]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.65rem', color, fontWeight: 700 }}>
            {icon} {label}
          </span>
        ))}
      </div>

      {list.length === 0
        ? <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 24 }}>No saved {activeTab} visions yet.</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 540, overflowY: 'auto' }}>
            {list.map(e => {
              const saved = e.createdAt?.seconds ? new Date(e.createdAt.seconds * 1000) : new Date();
              const activeDue = e.recommitmentDate || e.dueDate;
              const esc = escalation(activeDue);
              return (
                <div key={e.id} style={{
                  borderRadius: 10, padding: '0.75rem',
                  border: `2px solid ${esc ? esc.border : 'var(--border)'}`,
                  background: esc ? esc.bg : '#f8fafc',
                }}>
                  {esc && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: esc.color, background: 'white', border: `1px solid ${esc.border}`, borderRadius: 9999, padding: '1px 8px' }}>
                        {esc.icon} {esc.label}
                      </span>
                      {e.recommitmentDate && (
                        <span style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 700 }}>🔄 Recommitted</span>
                      )}
                    </div>
                  )}
                  {esc && (
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>
                      Due {new Date(activeDue + 'T00:00:00').toLocaleDateString()}
                    </p>
                  )}
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>Saved {saved.toLocaleDateString()}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    "{e.vision}"
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onLoad(e)}
                      style={{ flex: 1, padding: '0.25rem 0', borderRadius: 7, fontSize: '0.7rem', fontWeight: 700, border: '1px solid #0d9488', background: 'white', color: '#0d9488', cursor: 'pointer' }}>
                      Load
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
  const [mode, setMode]         = useState('personal');
  const [answers, setAnswers]   = useState({});
  const [vision, setVision]     = useState('');
  const [dueDate, setDueDate]   = useState('');
  const [step, setStep]         = useState(0);
  const [saved, setSaved]       = useState([]);
  const [panelTab, setPanelTab] = useState('personal');
  // modal state: null or the entry needing recommitment
  const [modalEntry, setModalEntry] = useState(null);

  async function fetchSaved() {
    if (!currentUser) return;
    try {
      const q = query(collection(db, 'visions'), where('uid', '==', currentUser.uid));
      const snap = await getDocs(q);
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      entries.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setSaved(entries);

      // Find first past-due entry that hasn't been penalized yet and has no recommitment
      const overdueEntry = entries.find(e => {
        const activeDue = e.recommitmentDate || e.dueDate;
        const esc = escalation(activeDue);
        return esc?.overdue && !e.deductionApplied;
      });
      if (overdueEntry) setModalEntry(overdueEntry);
    } catch (e) {
      console.error('fetchSaved error:', e);
    }
  }

  useEffect(() => { fetchSaved(); }, [currentUser]);

  async function handleRecommit(id, newDate) {
    try {
      await updateDoc(doc(db, 'visions', id), {
        recommitmentDate: newDate,
        recommitmentSetAt: serverTimestamp(),
        deductionApplied: true, // mark so we don't prompt again
      });
      toast.success('New commitment date set!');
      setModalEntry(null);
      fetchSaved();
    } catch (e) {
      toast.error('Failed to save: ' + e?.message);
    }
  }

  async function handleDismissModal() {
    if (!modalEntry || !currentUser) { setModalEntry(null); return; }
    try {
      // Mark deduction applied on the vision doc so modal doesn't re-fire
      await updateDoc(doc(db, 'visions', modalEntry.id), { deductionApplied: true });
      // Deduct 5 points from user's penalty tracker
      await updateDoc(doc(db, 'users', currentUser.uid), { penaltyPoints: increment(5) });
      toast.error('−5 points deducted for missed recommitment');
      setModalEntry(null);
      fetchSaved();
    } catch (e) {
      console.error('Dismiss error:', e);
      setModalEntry(null);
    }
  }

  function generateVision() {
    if (Object.keys(answers).filter(k => answers[k]).length < 2) return toast.error('Answer at least 2 questions first');
    const stmt = `As a ${mode === 'personal' ? 'leader' : 'team'}, I am committed to ${answers[2] || 'my core values'}. I will ${answers[1] || 'make a lasting impact'} by ${answers[5] || 'taking deliberate daily actions'}. My vision is to ${answers[4] || 'build a high-performance team'} where ${answers[3] || 'everyone grows and thrives'}.`;
    setVision(stmt);
    toast.success('Vision statement generated!');
  }

  async function handleSave() {
    if (!vision)  return toast.error('Generate a vision statement first');
    if (!dueDate) return toast.error('Please set an action due date before saving');
    if (!currentUser) return toast.error('Not logged in');
    try {
      await addDoc(collection(db, 'visions'), {
        uid: currentUser.uid,
        mode,
        vision,
        answers,
        dueDate,
        deductionApplied: false,
        createdAt: serverTimestamp(),
      });
      toast.success('Vision saved!');
      fetchSaved();
      setPanelTab(mode);
    } catch (e) {
      toast.error('Save failed: ' + e?.message);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, 'visions', id));
      fetchSaved();
    } catch (e) {
      toast.error('Delete failed: ' + e?.message);
    }
  }

  function handleLoad(entry) {
    setMode(entry.mode);
    setAnswers(entry.answers || {});
    setVision(entry.vision);
    setDueDate(entry.recommitmentDate || entry.dueDate || '');
    setStep(0);
    toast.success('Vision loaded!');
  }

  const answeredCount = prompts.filter(p => answers[p.step]).length;
  const esc = escalation(dueDate);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader icon="🔭" title="Vision Builder" subtitle="Create a compelling personal or team vision statement" />

      {/* Recommitment modal */}
      {modalEntry && (
        <RecommitModal
          entry={modalEntry}
          onSubmit={handleRecommit}
          onDismiss={handleDismissModal}
        />
      )}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
            {[{ key: 'personal', label: '👤 Personal Vision' }, { key: 'team', label: '👥 Team Vision' }].map(m => (
              <button key={m.key} onClick={() => setMode(m.key)}
                style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: mode === m.key ? '#0f2044' : '#f1f5f9', color: mode === m.key ? 'white' : '#475569' }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Vision statement display */}
          {vision && (
            <div style={{ borderRadius: 16, padding: '1.75rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg,#0b1a38,#0f2044,#0d9488)', color: 'white', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 12, right: 20, fontSize: '5rem', opacity: 0.07, fontFamily: 'Georgia,serif', lineHeight: 1 }}>"</div>
              <p style={{ color: '#99f6e4', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>Your Vision Statement</p>
              <p style={{ fontSize: '1rem', lineHeight: 1.7, margin: '0 0 16px', color: 'rgba(255,255,255,0.9)' }}>"{vision}"</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>📅 Action Due Date:</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '0.25rem 0.625rem', color: 'white', fontSize: '0.78rem', cursor: 'pointer', colorScheme: 'dark' }} />
                </div>
                {esc && (
                  <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 800, background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}>
                    {esc.icon} {esc.label}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setVision(''); setAnswers({}); setDueDate(''); }}
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '0.3rem 0.875rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                  Clear & Start Over
                </button>
                <button onClick={handleSave}
                  style={{ background: '#0d9488', border: 'none', borderRadius: 8, padding: '0.3rem 0.875rem', color: 'white', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>
                  💾 Save Vision
                </button>
              </div>
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
            <textarea className="input" rows={5} value={answers[prompts[step].step] || ''} onChange={e => setAnswers(a => ({ ...a, [prompts[step].step]: e.target.value }))} placeholder={prompts[step].placeholder} />
            <div style={{ display: 'flex', gap: 10, marginTop: '1rem' }}>
              {step > 0 && <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>← Previous</button>}
              {step < prompts.length - 1
                ? <button className="btn-primary" onClick={() => setStep(s => s + 1)}>Next →</button>
                : <button className="btn-primary" onClick={generateVision}>✨ Generate Vision Statement</button>
              }
            </div>
          </div>

          {/* Answers summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {prompts.map((p, i) => answers[p.step] && (
              <div key={p.step} className="card" style={{ padding: '1rem 1.25rem', cursor: 'pointer' }} onClick={() => setStep(i)}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Q{p.step}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>{p.question}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{answers[p.step]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: saved panel */}
        <SavedPanel
          entries={saved}
          onDelete={handleDelete}
          onLoad={handleLoad}
          activeTab={panelTab}
          setActiveTab={setPanelTab}
        />
      </div>
    </div>
  );
}
