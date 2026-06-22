import { useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const prompts = [
  { step: 1, question: "What kind of leader do I want to be known as in 5 years?",         placeholder: "Describe your ideal leadership identity..." },
  { step: 2, question: "What impact do I want to have on my team and organization?",        placeholder: "What change or legacy do you want to leave?" },
  { step: 3, question: "What values are non-negotiable in how I lead?",                     placeholder: "e.g. Integrity, transparency, accountability..." },
  { step: 4, question: "What does success look like for my team in 3 years?",               placeholder: "Describe your team's future state..." },
  { step: 5, question: "What specific actions will I commit to starting this week?",        placeholder: "Be concrete — what will you do Monday?" },
];

export default function Vision() {
  const [mode, setMode] = useState('personal');
  const [answers, setAnswers] = useState({});
  const [vision, setVision] = useState(() => localStorage.getItem('vision-statement') || '');
  const [step, setStep] = useState(0);

  function generateVision() {
    const parts = prompts.map(p => answers[p.step] || '').filter(Boolean);
    if (parts.length < 2) return toast.error('Answer at least 2 questions first');
    const stmt = `As a ${mode === 'personal' ? 'leader' : 'team'}, I am committed to ${answers[2] || 'my core values'}. I will ${answers[1] || 'make a lasting impact'} by ${answers[5] || 'taking deliberate daily actions'}. My vision is to ${answers[4] || 'build a high-performance team'} where ${answers[3] || 'everyone grows and thrives'}.`;
    setVision(stmt);
    localStorage.setItem('vision-statement', stmt);
    toast.success('Vision statement generated!');
  }

  const answeredCount = prompts.filter(p => answers[p.step]).length;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <PageHeader icon="🔭" title="Vision Builder" subtitle="Create a compelling personal or team vision statement" />

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
          <button onClick={() => { setVision(''); localStorage.removeItem('vision-statement'); }}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '0.3rem 0.875rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
            Clear & Start Over
          </button>
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
  );
}
