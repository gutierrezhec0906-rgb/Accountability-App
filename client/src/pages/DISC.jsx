import { useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const discProfiles = {
  D: { name: 'Dominance',        color: '#ef4444', traits: ['Results-oriented','Direct & decisive','Competitive','Problem-solver','High sense of urgency'], strengths: 'Drives results, takes initiative, thrives under pressure', challenges: 'May overlook feelings, appear blunt, move too fast', tips: 'Slow down for team input. Ask questions before deciding.' },
  I: { name: 'Influence',        color: '#f59e0b', traits: ['Enthusiastic & optimistic','Collaborative','Persuasive','People-focused','Creative'], strengths: 'Inspires others, builds relationships, creates excitement', challenges: 'May avoid conflict, lose focus, overcommit', tips: 'Follow through on commitments. Use structure to stay organized.' },
  S: { name: 'Steadiness',       color: '#0d9488', traits: ['Patient & consistent','Dependable','Team player','Good listener','Diplomatic'], strengths: 'Creates harmony, reliable under stress, strong team builder', challenges: 'May resist change, avoid confrontation, struggle with urgency', tips: 'Practice speaking up earlier. Change is growth.' },
  C: { name: 'Conscientiousness',color: '#1e3a6e', traits: ['Analytical & precise','Quality-focused','Systematic','Detail-oriented','Fact-based'], strengths: 'Produces high-quality work, identifies risks, ensures accuracy', challenges: 'Analysis paralysis, overly critical, slow to decide', tips: 'Good is sometimes better than perfect. Ship and iterate.' },
};

const questions = [
  { id: 1, text: 'In a group project, I usually:',      D: 'Take charge and set direction',       I: 'Motivate and energize the team',           S: 'Support and listen to everyone',   C: 'Analyze and ensure quality' },
  { id: 2, text: 'When facing a problem, I:',           D: 'Act quickly and decisively',           I: 'Brainstorm with others enthusiastically',  S: 'Think carefully and seek consensus',C: 'Research thoroughly before deciding' },
  { id: 3, text: 'My biggest strength at work is:',    D: 'Getting results fast',                 I: 'Building relationships',                   S: 'Being reliable and calm',          C: 'High accuracy and quality' },
  { id: 4, text: 'Others would describe me as:',       D: 'Direct and driven',                    I: 'Energetic and fun',                        S: 'Steady and dependable',            C: 'Thorough and precise' },
  { id: 5, text: 'Under pressure, I tend to:',         D: 'Push harder and faster',               I: 'Talk more and rally people',               S: 'Stay calm and patient',            C: 'Become more analytical' },
  { id: 6, text: 'I prefer meetings that are:',        D: 'Short, decisive, and action-focused',  I: 'Collaborative with open discussion',       S: 'Structured and inclusive',         C: 'Data-driven with clear agendas' },
  { id: 7, text: 'My communication style is:',         D: 'Blunt and to the point',               I: 'Expressive and storytelling',              S: 'Warm and diplomatic',              C: 'Factual and detailed' },
  { id: 8, text: 'I am most motivated by:',            D: 'Achieving challenging goals',           I: 'Recognition and fun',                      S: 'Team harmony and stability',       C: 'Mastery and accuracy' },
];

export default function DISC() {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [view, setView] = useState('assessment');

  function calculate() {
    if (Object.keys(answers).length < questions.length) return toast.error('Please answer all questions');
    const scores = { D: 0, I: 0, S: 0, C: 0 };
    Object.values(answers).forEach(t => scores[t]++);
    const primary = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    setResult({ scores, primary });
    setView('results');
  }

  const answerCount = Object.keys(answers).length;
  const allAnswered = answerCount === questions.length;
  const tabs = [{ id: 'assessment', label: '📋 Assessment' }, { id: 'profiles', label: '📖 DISC Profiles' }, ...(result ? [{ id: 'results', label: '🏆 My Results' }] : [])];

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHeader icon="🧠" title="DISC Personality Assessment" subtitle="Understand your behavioral style and leadership tendencies" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: view === t.id ? '#0f2044' : '#f1f5f9', color: view === t.id ? 'white' : '#475569' }}>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'assessment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 9999, height: 8 }}>
              <div style={{ height: 8, borderRadius: 9999, background: '#0d9488', width: `${(answerCount / questions.length) * 100}%`, transition: 'width 0.4s ease' }} />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>{answerCount}/{questions.length}</span>
          </div>
          {questions.map(q => (
            <div key={q.id} className="card" style={{ padding: '1.25rem' }}>
              <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.875rem', fontSize: '0.9375rem' }}>{q.id}. {q.text}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {Object.entries({ D: q.D, I: q.I, S: q.S, C: q.C }).map(([type, text]) => (
                  <button key={type} onClick={() => setAnswers(a => ({ ...a, [q.id]: type }))}
                    style={{ textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: 10, fontSize: '0.85rem', cursor: 'pointer', border: `2px solid ${answers[q.id] === type ? discProfiles[type].color : '#e2e8f0'}`, background: answers[q.id] === type ? discProfiles[type].color : 'transparent', color: answers[q.id] === type ? 'white' : '#475569', fontWeight: answers[q.id] === type ? 700 : 400, transition: 'all 0.15s' }}>
                    <span style={{ fontWeight: 800, marginRight: 6 }}>{type}:</span>{text}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="btn-primary" onClick={calculate} disabled={!allAnswered}
            style={{ opacity: allAnswered ? 1 : 0.6, cursor: allAnswered ? 'pointer' : 'not-allowed' }}>
            {allAnswered ? '✓ Calculate My DISC Profile' : `Answer ${questions.length - answerCount} more question${questions.length - answerCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {view === 'profiles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: 14 }}>
          {Object.entries(discProfiles).map(([key, profile]) => (
            <div key={key} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.875rem' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.25rem', fontWeight: 900, flexShrink: 0, background: profile.color }}>{key}</div>
                <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '1.0625rem' }}>{profile.name}</h4>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '0.875rem' }}>
                {profile.traits.map(t => (
                  <span key={t} style={{ padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, background: profile.color + '18', color: profile.color }}>{t}</span>
                ))}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}><strong>Strengths:</strong> {profile.strengths}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 8px' }}><strong>Watch out for:</strong> {profile.challenges}</p>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, fontStyle: 'italic', color: profile.color, margin: 0 }}>💡 {profile.tips}</p>
            </div>
          ))}
        </div>
      )}

      {view === 'results' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ borderRadius: 16, padding: '1.75rem', color: 'white', background: `linear-gradient(135deg, ${discProfiles[result.primary].color}, #0f2044)` }}>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Your Primary DISC Style</p>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 8px', color: 'white' }}>{result.primary} — {discProfiles[result.primary].name}</h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: '0.9rem' }}>{discProfiles[result.primary].strengths}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {Object.entries(result.scores).map(([type, score]) => (
              <div key={type} className="stat-tile" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: discProfiles[type].color }}>{score}</div>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{type}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{discProfiles[type].name}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', fontSize: '0.9375rem' }}>Development Tips for {result.primary} Style</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 8px' }}><strong>Watch out for:</strong> {discProfiles[result.primary].challenges}</p>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0d9488', margin: 0 }}>💡 {discProfiles[result.primary].tips}</p>
          </div>
          <button className="btn-secondary" onClick={() => { setAnswers({}); setResult(null); setView('assessment'); }}>Retake Assessment</button>
        </div>
      )}
    </div>
  );
}
