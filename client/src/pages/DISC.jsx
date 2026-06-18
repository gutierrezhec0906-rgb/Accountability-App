import { useState } from 'react';
import toast from 'react-hot-toast';

const discProfiles = {
  D: { name: 'Dominance', color: '#ef4444', traits: ['Results-oriented', 'Direct & decisive', 'Competitive', 'Problem-solver', 'High sense of urgency'], strengths: 'Drives results, takes initiative, thrives under pressure', challenges: 'May overlook feelings, appear blunt, move too fast', tips: 'Slow down for team input. Ask questions before deciding.' },
  I: { name: 'Influence', color: '#f59e0b', traits: ['Enthusiastic & optimistic', 'Collaborative', 'Persuasive', 'People-focused', 'Creative'], strengths: 'Inspires others, builds relationships, creates excitement', challenges: 'May avoid conflict, lose focus, overcommit', tips: 'Follow through on commitments. Use structure to stay organized.' },
  S: { name: 'Steadiness', color: '#0d9488', traits: ['Patient & consistent', 'Dependable', 'Team player', 'Good listener', 'Diplomatic'], strengths: 'Creates harmony, reliable under stress, strong team builder', challenges: 'May resist change, avoid confrontation, struggle with urgency', tips: 'Practice speaking up earlier. Change is growth.' },
  C: { name: 'Conscientiousness', color: '#1e3a6e', traits: ['Analytical & precise', 'Quality-focused', 'Systematic', 'Detail-oriented', 'Fact-based'], strengths: 'Produces high-quality work, identifies risks, ensures accuracy', challenges: 'Analysis paralysis, overly critical, slow to decide', tips: 'Good is sometimes better than perfect. Ship and iterate.' },
};

const questions = [
  { id: 1, text: 'In a group project, I usually:', D: 'Take charge and set direction', I: 'Motivate and energize the team', S: 'Support and listen to everyone', C: 'Analyze and ensure quality' },
  { id: 2, text: 'When facing a problem, I:', D: 'Act quickly and decisively', I: 'Brainstorm with others enthusiastically', S: 'Think carefully and seek consensus', C: 'Research thoroughly before deciding' },
  { id: 3, text: 'My biggest strength at work is:', D: 'Getting results fast', I: 'Building relationships', S: 'Being reliable and calm', C: 'High accuracy and quality' },
  { id: 4, text: 'Others would describe me as:', D: 'Direct and driven', I: 'Energetic and fun', S: 'Steady and dependable', C: 'Thorough and precise' },
  { id: 5, text: 'Under pressure, I tend to:', D: 'Push harder and faster', I: 'Talk more and rally people', S: 'Stay calm and patient', C: 'Become more analytical' },
  { id: 6, text: 'I prefer meetings that are:', D: 'Short, decisive, and action-focused', I: 'Collaborative with open discussion', S: 'Structured and inclusive', C: 'Data-driven with clear agendas' },
  { id: 7, text: 'My communication style is:', D: 'Blunt and to the point', I: 'Expressive and storytelling', S: 'Warm and diplomatic', C: 'Factual and detailed' },
  { id: 8, text: 'I am most motivated by:', D: 'Achieving challenging goals', I: 'Recognition and fun', S: 'Team harmony and stability', C: 'Mastery and accuracy' },
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">DISC Personality Assessment</h1>
        <p className="text-slate-500 text-sm">Understand your behavioral style and leadership tendencies</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[{ id: 'assessment', label: '📋 Assessment' }, { id: 'profiles', label: '📖 DISC Profiles' }, ...(result ? [{ id: 'results', label: '🏆 My Results' }] : [])].map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${view === v.id ? 'text-white' : 'bg-slate-100 text-slate-600'}`}
            style={view === v.id ? { background: '#0f2044' } : {}}>
            {v.label}
          </button>
        ))}
      </div>

      {view === 'assessment' && (
        <div className="space-y-4">
          <div className="card p-3 flex items-center gap-3">
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${(answerCount / questions.length) * 100}%`, background: '#0d9488' }} />
            </div>
            <span className="text-xs font-bold text-slate-500">{answerCount}/{questions.length}</span>
          </div>
          {questions.map(q => (
            <div key={q.id} className="card p-4">
              <p className="font-semibold text-slate-700 mb-3">{q.id}. {q.text}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {Object.entries({ D: q.D, I: q.I, S: q.S, C: q.C }).map(([type, text]) => (
                  <button key={type} onClick={() => setAnswers(a => ({ ...a, [q.id]: type }))}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-all border-2"
                    style={answers[q.id] === type
                      ? { background: discProfiles[type].color, borderColor: discProfiles[type].color, color: 'white', fontWeight: 600 }
                      : { borderColor: '#e2e8f0', color: '#475569' }}>
                    <span className="font-bold mr-2">{type}:</span>{text}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="btn-primary w-full justify-center" onClick={calculate} disabled={!allAnswered}>
            {allAnswered ? '✓ Calculate My DISC Profile' : `Answer ${questions.length - answerCount} more question${questions.length - answerCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {view === 'profiles' && (
        <div className="grid md:grid-cols-2 gap-4">
          {Object.entries(discProfiles).map(([key, profile]) => (
            <div key={key} className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-black" style={{ background: profile.color }}>{key}</div>
                <h4 className="font-bold text-slate-800">{profile.name}</h4>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {profile.traits.map(t => <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: profile.color + '20', color: profile.color }}>{t}</span>)}
              </div>
              <p className="text-xs text-slate-600 mb-1"><span className="font-bold">Strengths:</span> {profile.strengths}</p>
              <p className="text-xs text-slate-600 mb-2"><span className="font-bold">Watch out for:</span> {profile.challenges}</p>
              <p className="text-xs font-medium italic" style={{ color: profile.color }}>💡 {profile.tips}</p>
            </div>
          ))}
        </div>
      )}

      {view === 'results' && result && (
        <div className="space-y-4">
          <div className="rounded-xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${discProfiles[result.primary].color}, #0f2044)` }}>
            <p className="text-sm opacity-80 mb-1">Your Primary DISC Style</p>
            <h2 className="text-4xl font-black">{result.primary} — {discProfiles[result.primary].name}</h2>
            <p className="mt-2 opacity-90">{discProfiles[result.primary].strengths}</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(result.scores).map(([type, score]) => (
              <div key={type} className="card p-3 text-center">
                <div className="text-2xl font-black" style={{ color: discProfiles[type].color }}>{score}</div>
                <div className="text-xs font-bold text-slate-600">{type}</div>
                <div className="text-xs text-slate-400">{discProfiles[type].name}</div>
              </div>
            ))}
          </div>
          <div className="card p-5">
            <h4 className="font-bold text-slate-700 mb-2">Development Tips for {result.primary} Style</h4>
            <p className="text-sm text-slate-600 mb-2"><span className="font-bold">Watch out for:</span> {discProfiles[result.primary].challenges}</p>
            <p className="text-sm font-medium" style={{ color: '#0d9488' }}>💡 {discProfiles[result.primary].tips}</p>
          </div>
          <button className="btn-secondary" onClick={() => { setAnswers({}); setResult(null); setView('assessment'); }}>Retake Assessment</button>
        </div>
      )}
    </div>
  );
}
