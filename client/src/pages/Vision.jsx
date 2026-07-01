import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const prompts = [
  { step: 1, question: "What kind of leader do I want to be known as in 5 years?",        placeholder: "Describe your ideal leadership identity..." },
  { step: 2, question: "What impact do I want to have on my team and organization?",       placeholder: "What change or legacy do you want to leave?" },
  { step: 3, question: "What values are non-negotiable in how I lead?",                    placeholder: "e.g. Integrity, transparency, accountability..." },
  { step: 4, question: "What does success look like for my team in 3 years?",              placeholder: "Describe your team's future state..." },
  { step: 5, question: "What specific actions will I commit to starting this week?",       placeholder: "Be concrete — what will you do Monday?" },
];

function SavedPanel({ entries, onDelete, onLoad, onEdit, activeTab, setActiveTab }) {
  const personal = entries.filter(e => e.mode === 'personal');
  const team     = entries.filter(e => e.mode === 'team');
  const list     = activeTab === 'personal' ? personal : team;

  return (
    <div style={{ width: 270, flexShrink: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem', alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
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
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
            {list.map(e => {
              const d = e.createdAt?.seconds ? new Date(e.createdAt.seconds * 1000) : new Date();
              return (
                <div key={e.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '0.75rem', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>{d.toLocaleDateString()}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    "{e.vision}"
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onLoad(e)}
                      style={{ flex: 1, padding: '0.25rem 0', borderRadius: 7, fontSize: '0.7rem', fontWeight: 700, border: '1px solid #0d9488', background: 'white', color: '#0d9488', cursor: 'pointer' }}>
                      Load
                    </button>
                    <button onClick={() => onEdit(e)}
                      style={{ flex: 1, padding: '0.25rem 0', borderRadius: 7, fontSize: '0.7rem', fontWeight: 700, border: '1px solid #0f2044', background: 'white', color: '#0f2044', cursor: 'pointer' }}>
                      ✏️ Edit
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
  const [mode, setMode]           = useState('personal');
  const [answers, setAnswers]     = useState({});
  const [vision, setVision]       = useState('');
  const [step, setStep]           = useState(0);
  const [saved, setSaved]         = useState([]);
  const [panelTab, setPanelTab]   = useState('personal');
  const [editingId, setEditingId] = useState(null);
  const [editVision, setEditVision] = useState('');

  async function fetchSaved() {
    if (!currentUser) return;
    try {
      const q = query(collection(db, 'visions'), where('uid', '==', currentUser.uid));
      const snap = await getDocs(q);
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      entries.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setSaved(entries);
    } catch (e) {
      console.error('fetchSaved error:', e);
    }
  }

  useEffect(() => { fetchSaved(); }, [currentUser]);

  function generateVision() {
    if (Object.keys(answers).filter(k => answers[k]).length < 2) return toast.error('Answer at least 2 questions first');
    const stmt = `As a ${mode === 'personal' ? 'leader' : 'team'}, I am committed to ${answers[2] || 'my core values'}. I will ${answers[1] || 'make a lasting impact'} by ${answers[5] || 'taking deliberate daily actions'}. My vision is to ${answers[4] || 'build a high-performance team'} where ${answers[3] || 'everyone grows and thrives'}.`;
    setVision(stmt);
    toast.success('Vision statement generated!');
  }

  async function handleSave() {
    if (!vision) return toast.error('Generate a vision statement first');
    if (!currentUser) return toast.error('Not logged in');
    try {
      await addDoc(collection(db, 'visions'), {
        uid: currentUser.uid,
        mode,
        vision,
        answers,
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
      if (editingId === id) { setEditingId(null); setEditVision(''); }
      fetchSaved();
    } catch (e) {
      toast.error('Delete failed: ' + e?.message);
    }
  }

  function handleLoad(entry) {
    setMode(entry.mode);
    setAnswers(entry.answers || {});
    setVision(entry.vision);
    setStep(0);
    setEditingId(null);
    toast.success('Vision loaded!');
  }

  function handleEdit(entry) {
    setEditingId(entry.id);
    setEditVision(entry.vision);
  }

  async function handleSaveEdit() {
    if (!editVision.trim()) return toast.error('Vision statement cannot be empty');
    try {
      await updateDoc(doc(db, 'visions', editingId), { vision: editVision });
      toast.success('Vision updated!');
      setEditingId(null);
      setEditVision('');
      fetchSaved();
    } catch (e) {
      toast.error('Update failed: ' + e?.message);
    }
  }

  const answeredCount = prompts.filter(p => answers[p.step]).length;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader icon="🔭" title="Vision Builder" subtitle="Create a compelling personal or team vision statement" />

      {/* Edit modal overlay */}
      {editingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 1rem', fontSize: '1.05rem' }}>✏️ Edit Vision Statement</h3>
            <textarea
              className="input"
              rows={6}
              value={editVision}
              onChange={e => setEditVision(e.target.value)}
              style={{ width: '100%', fontSize: '0.9rem', lineHeight: 1.7 }}
            />
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
              <p style={{ fontSize: '1rem', lineHeight: 1.7, margin: '0 0 14px', color: 'rgba(255,255,255,0.9)' }}>"{vision}"</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => { setVision(''); setAnswers({}); }}
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '0.3rem 0.875rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                  Clear & Start Over
                </button>
                <button onClick={() => { setEditingId('current'); setEditVision(vision); }}
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '0.3rem 0.875rem', color: 'white', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>
                  ✏️ Edit
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

        <SavedPanel
          entries={saved}
          onDelete={handleDelete}
          onLoad={handleLoad}
          onEdit={handleEdit}
          activeTab={panelTab}
          setActiveTab={setPanelTab}
        />
      </div>
    </div>
  );
}
