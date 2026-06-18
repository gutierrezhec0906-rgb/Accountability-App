import { useState, useEffect, useRef } from 'react';

const exercises = [
  {
    name: 'Box Breathing',
    icon: '🟦',
    description: 'Inhale 4s → Hold 4s → Exhale 4s → Hold 4s',
    phases: [
      { label: 'Inhale', duration: 4, color: '#0d9488' },
      { label: 'Hold', duration: 4, color: '#1e3a6e' },
      { label: 'Exhale', duration: 4, color: '#0d9488' },
      { label: 'Hold', duration: 4, color: '#1e3a6e' },
    ],
  },
  {
    name: '4-7-8 Breathing',
    icon: '🌊',
    description: 'Inhale 4s → Hold 7s → Exhale 8s',
    phases: [
      { label: 'Inhale', duration: 4, color: '#0d9488' },
      { label: 'Hold', duration: 7, color: '#1e3a6e' },
      { label: 'Exhale', duration: 8, color: '#14b8a6' },
    ],
  },
  {
    name: 'Deep Belly Breathing',
    icon: '🌿',
    description: 'Slow 5s inhale → 5s exhale',
    phases: [
      { label: 'Inhale', duration: 5, color: '#0d9488' },
      { label: 'Exhale', duration: 5, color: '#14b8a6' },
    ],
  },
];

const affirmations = [
  "I lead with clarity, confidence, and compassion.",
  "I embrace challenges as opportunities to grow.",
  "My team thrives because I invest in them daily.",
  "I make decisions with both urgency and wisdom.",
  "I am accountable to my team, my goals, and myself.",
  "I bring calm energy to high-pressure situations.",
];

export default function Mindfulness() {
  const [selectedEx, setSelectedEx] = useState(exercises[0]);
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(exercises[0].phases[0].duration);
  const [cycles, setCycles] = useState(0);
  const [affIdx, setAffIdx] = useState(0);
  const timerRef = useRef(null);

  function startStop() {
    if (running) {
      clearInterval(timerRef.current);
      setRunning(false);
      setPhaseIdx(0);
      setTimeLeft(selectedEx.phases[0].duration);
    } else {
      setRunning(true);
      setPhaseIdx(0);
      setTimeLeft(selectedEx.phases[0].duration);
    }
  }

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setPhaseIdx(p => {
            const next = (p + 1) % selectedEx.phases.length;
            if (next === 0) setCycles(c => c + 1);
            setTimeLeft(selectedEx.phases[next].duration);
            return next;
          });
          return selectedEx.phases[0].duration;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running, selectedEx]);

  function selectExercise(ex) {
    clearInterval(timerRef.current);
    setRunning(false);
    setSelectedEx(ex);
    setPhaseIdx(0);
    setTimeLeft(ex.phases[0].duration);
    setCycles(0);
  }

  const phase = selectedEx.phases[phaseIdx];
  const phasePct = running ? ((selectedEx.phases[phaseIdx].duration - timeLeft) / selectedEx.phases[phaseIdx].duration) * 100 : 0;
  const r = 70;
  const circ = 2 * Math.PI * r;
  const dash = (phasePct / 100) * circ;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Breathing & Mindfulness</h1>
        <p className="text-slate-500 text-sm">Guided breathing exercises and mindfulness tools for leaders</p>
      </div>

      {/* Exercise Selector */}
      <div className="flex gap-3 flex-wrap">
        {exercises.map(ex => (
          <button key={ex.name} onClick={() => selectExercise(ex)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${selectedEx.name === ex.name ? 'text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            style={selectedEx.name === ex.name ? { background: '#0f2044' } : {}}>
            <span>{ex.icon}</span>{ex.name}
          </button>
        ))}
      </div>

      {/* Breathing Circle */}
      <div className="card p-8 text-center">
        <p className="text-sm text-slate-500 mb-6">{selectedEx.description}</p>

        <div className="flex justify-center mb-6">
          <div className="relative">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
              <circle cx="100" cy="100" r={r} fill="none" stroke={phase.color} strokeWidth="8"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                transform="rotate(-90 100 100)" style={{ transition: 'stroke-dasharray 0.5s linear' }} />
              <circle cx="100" cy="100" r="54" fill={running ? phase.color + '15' : '#f8fafc'} style={{ transition: 'fill 0.5s' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold" style={{ color: phase.color }}>{timeLeft}</p>
              <p className="text-sm font-bold text-slate-600">{running ? phase.label : 'Ready'}</p>
            </div>
          </div>
        </div>

        {running && (
          <div className="flex justify-center gap-2 mb-4 flex-wrap">
            {selectedEx.phases.map((p, i) => (
              <span key={i} className={`px-3 py-1 rounded-full text-xs font-semibold ${i === phaseIdx ? 'text-white' : 'text-slate-400 bg-slate-100'}`} style={i === phaseIdx ? { background: p.color } : {}}>
                {p.label} ({p.duration}s)
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button onClick={startStop} className={`px-8 py-3 rounded-xl font-bold text-white transition-all ${running ? 'hover:opacity-90' : 'hover:shadow-lg'}`} style={{ background: running ? '#ef4444' : '#0d9488' }}>
            {running ? '⏹ Stop' : '▶ Start Breathing'}
          </button>
        </div>

        {cycles > 0 && <p className="text-sm text-slate-500 mt-4">✅ {cycles} cycle{cycles > 1 ? 's' : ''} completed</p>}
      </div>

      {/* Phase Guide */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {selectedEx.phases.map((p, i) => (
          <div key={i} className="card p-3 text-center">
            <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold" style={{ background: p.color }}>{i + 1}</div>
            <p className="text-xs font-bold text-slate-700">{p.label}</p>
            <p className="text-xs text-slate-400">{p.duration} seconds</p>
          </div>
        ))}
      </div>

      {/* Affirmations */}
      <div className="card p-5" style={{ background: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)' }}>
        <h3 className="font-bold text-slate-700 mb-3">Leadership Affirmation</h3>
        <p className="text-lg font-medium text-slate-700 italic">"{affirmations[affIdx]}"</p>
        <button className="btn-secondary mt-4 text-xs" onClick={() => setAffIdx(i => (i + 1) % affirmations.length)}>Next Affirmation →</button>
      </div>
    </div>
  );
}
