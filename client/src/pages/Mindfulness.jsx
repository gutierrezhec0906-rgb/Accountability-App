import { useState, useEffect, useRef } from 'react';
import PageHeader from '../components/PageHeader';

const exercises = [
  {
    name: 'Box Breathing',
    icon: '🟦',
    description: 'Inhale 4s → Hold 4s → Exhale 4s → Hold 4s',
    phases: [
      { label: 'Inhale', duration: 4, color: '#0d9488' },
      { label: 'Hold',   duration: 4, color: '#1e3a6e' },
      { label: 'Exhale', duration: 4, color: '#0d9488' },
      { label: 'Hold',   duration: 4, color: '#1e3a6e' },
    ],
  },
  {
    name: '4-7-8 Breathing',
    icon: '🌊',
    description: 'Inhale 4s → Hold 7s → Exhale 8s',
    phases: [
      { label: 'Inhale', duration: 4, color: '#0d9488' },
      { label: 'Hold',   duration: 7, color: '#1e3a6e' },
      { label: 'Exhale', duration: 8, color: '#14b8a6' },
    ],
  },
  {
    name: 'Deep Belly',
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
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <PageHeader icon="🧘" title="Breathing & Mindfulness" subtitle="Guided breathing exercises and mindfulness tools for leaders" />

      {/* Exercise selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {exercises.map(ex => (
          <button key={ex.name} onClick={() => selectExercise(ex)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1.125rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: selectedEx.name === ex.name ? '#0f2044' : '#f1f5f9', color: selectedEx.name === ex.name ? 'white' : '#475569' }}>
            <span>{ex.icon}</span>{ex.name}
          </button>
        ))}
      </div>

      {/* Breathing circle */}
      <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{selectedEx.description}</p>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
              <circle cx="100" cy="100" r={r} fill="none" stroke={phase.color} strokeWidth="8"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                transform="rotate(-90 100 100)" style={{ transition: 'stroke-dasharray 0.5s linear' }} />
              <circle cx="100" cy="100" r="54" fill={running ? phase.color + '18' : '#f8fafc'} style={{ transition: 'fill 0.5s' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: '2rem', fontWeight: 900, color: phase.color, margin: 0 }}>{timeLeft}</p>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>{running ? phase.label : 'Ready'}</p>
            </div>
          </div>
        </div>

        {running && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
            {selectedEx.phases.map((p, i) => (
              <span key={i} style={{ padding: '2px 12px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, background: i === phaseIdx ? p.color : '#f1f5f9', color: i === phaseIdx ? 'white' : '#94a3b8', transition: 'all 0.3s' }}>
                {p.label} ({p.duration}s)
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button onClick={startStop}
            style={{ padding: '0.625rem 2rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', border: 'none', cursor: 'pointer', color: 'white', background: running ? '#ef4444' : '#0d9488', transition: 'all 0.15s' }}>
            {running ? '⏹ Stop' : '▶ Start Breathing'}
          </button>
        </div>
        {cycles > 0 && <p style={{ fontSize: '0.8rem', color: '#0d9488', marginTop: '1rem', fontWeight: 600 }}>✅ {cycles} cycle{cycles > 1 ? 's' : ''} completed</p>}
      </div>

      {/* Phase guide */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedEx.phases.length}, 1fr)`, gap: 12, marginBottom: '1.25rem' }}>
        {selectedEx.phases.map((p, i) => (
          <div key={i} className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.color, color: 'white', fontWeight: 900, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>{i + 1}</div>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem', margin: '0 0 2px' }}>{p.label}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{p.duration} seconds</p>
          </div>
        ))}
      </div>

      {/* Affirmation */}
      <div style={{ borderRadius: 16, padding: '1.5rem', background: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border: '1px solid #bbf7d0' }}>
        <h3 style={{ fontWeight: 800, color: '#166534', margin: '0 0 4px', fontSize: '1rem' }}>Leadership Affirmation</h3>
        <p style={{ fontSize: '0.78rem', color: '#15803d', margin: '0 0 14px' }}>Start or end your session with intention</p>
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: '0.875rem', boxShadow: '0 1px 4px rgba(15,32,68,0.06)' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>"{affirmations[affIdx]}"</p>
        </div>
        <button className="btn-secondary" onClick={() => setAffIdx(i => (i + 1) % affirmations.length)}>Next Affirmation →</button>
      </div>
    </div>
  );
}
