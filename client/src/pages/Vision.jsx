import { useState } from 'react';
import toast from 'react-hot-toast';

const prompts = [
  { step: 1, question: "What kind of leader do I want to be known as in 5 years?", placeholder: "Describe your ideal leadership identity..." },
  { step: 2, question: "What impact do I want to have on my team and organization?", placeholder: "What change or legacy do you want to leave?" },
  { step: 3, question: "What values are non-negotiable in how I lead?", placeholder: "e.g. Integrity, transparency, accountability..." },
  { step: 4, question: "What does success look like for my team in 3 years?", placeholder: "Describe your team's future state..." },
  { step: 5, question: "What specific actions will I commit to starting this week?", placeholder: "Be concrete — what will you do Monday?" },
];

export default function Vision() {
  const [mode, setMode] = useState('personal');
  const [answers, setAnswers] = useState({});
  const [vision, setVision] = useState(() => localStorage.getItem('vision-statement') || '');
  const [step, setStep] = useState(0);
  const [generated, setGenerated] = useState(false);

  function generateVision() {
    const parts = prompts.map(p => answers[p.step] || '').filter(Boolean);
    if (parts.length < 2) return toast.error('Answer at least 2 questions first');
    const stmt = `As a ${mode === 'personal' ? 'leader' : 'team'}, I am committed to ${answers[2] || 'my core values'}. I will ${answers[1] || 'make a lasting impact'} by ${answers[5] || 'taking deliberate daily actions'}. My vision is to ${answers[4] || 'build a high-performance team'} where ${answers[3] || 'everyone grows and thrives'}.`;
    setVision(stmt);
    localStorage.setItem('vision-statement', stmt);
    setGenerated(true);
    toast.success('Vision statement generated!');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Vision Builder</h1>
        <p className="text-slate-500 text-sm">Create a compelling personal or team vision statement</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        {['personal', 'team'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm capitalize transition-all ${mode === m ? 'text-white' : 'bg-slate-100 text-slate-600'}`}
            style={mode === m ? { background: '#0f2044' } : {}}>
            {m === 'personal' ? '👤 Personal Vision' : '👥 Team Vision'}
          </button>
        ))}
      </div>

      {/* Existing Vision Statement */}
      {vision && (
        <div className="rounded-xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f2044, #1e3a6e)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5eead4' }}>Your Vision Statement</p>
          <p className="text-base leading-relaxed">"{vision}"</p>
          <button className="mt-3 text-xs underline" style={{ color: '#99f6e4' }} onClick={() => { setVision(''); localStorage.removeItem('vision-statement'); setGenerated(false); }}>Clear & Start Over</button>
        </div>
      )}

      {/* Step Progress */}
      <div className="flex gap-2">
        {prompts.map((p, i) => (
          <button key={p.step} onClick={() => setStep(i)}
            className="flex-1 h-2 rounded-full transition-all"
            style={{ background: answers[p.step] ? '#0d9488' : step === i ? '#5eead4' : '#e2e8f0' }} />
        ))}
      </div>

      {/* Current Prompt */}
      <div className="card p-6">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#0d9488' }}>Question {step + 1} of {prompts.length}</p>
        <h3 className="font-bold text-slate-800 text-lg mb-4">{prompts[step].question}</h3>
        <textarea className="input" rows={5} value={answers[prompts[step].step] || ''} onChange={e => setAnswers(a => ({ ...a, [prompts[step].step]: e.target.value }))} placeholder={prompts[step].placeholder} />
        <div className="flex gap-3 mt-4">
          {step > 0 && <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>← Previous</button>}
          {step < prompts.length - 1
            ? <button className="btn-primary" onClick={() => setStep(s => s + 1)}>Next →</button>
            : <button className="btn-primary" onClick={generateVision}>✨ Generate Vision Statement</button>
          }
        </div>
      </div>

      {/* All answers summary */}
      <div className="space-y-3">
        {prompts.map((p, i) => answers[p.step] && (
          <div key={p.step} className="card p-4 cursor-pointer hover:shadow-sm" onClick={() => setStep(i)}>
            <p className="text-xs font-bold mb-1" style={{ color: '#0d9488' }}>Q{p.step}</p>
            <p className="text-xs text-slate-500 mb-1">{p.question}</p>
            <p className="text-sm text-slate-700">{answers[p.step]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
