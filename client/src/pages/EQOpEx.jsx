import { useState } from 'react';
import toast from 'react-hot-toast';

const eqDimensions = [
  { id: 'self-awareness', label: 'Self-Awareness', icon: '🪞', desc: 'Understanding your emotions and their impact', questions: ['I recognize my emotional states in real-time', 'I understand my triggers and how they affect my behavior', 'I seek feedback to understand my blind spots', 'I know my strengths and development areas clearly'] },
  { id: 'self-regulation', label: 'Self-Regulation', icon: '🎛️', desc: 'Managing your emotions and impulses effectively', questions: ['I stay calm under pressure and in conflict', 'I think before reacting in tense situations', 'I adapt my approach when things change unexpectedly', 'I maintain a positive attitude in challenging situations'] },
  { id: 'motivation', label: 'Motivation', icon: '🔥', desc: 'Internal drive toward goals beyond external rewards', questions: ['I maintain enthusiasm even when facing obstacles', 'I set challenging goals and pursue them with energy', 'I continuously look for ways to improve', 'I inspire others through my own commitment'] },
  { id: 'empathy', label: 'Empathy', icon: '❤️', desc: 'Understanding and sharing the feelings of others', questions: ["I actively listen without planning my response", "I consider others' emotions before making decisions", 'I adapt my communication style to different people', "I can sense the team's morale and address it proactively"] },
  { id: 'social-skills', label: 'Social Skills', icon: '🤝', desc: 'Managing relationships and inspiring others', questions: ['I build trust with people at all levels', 'I resolve conflicts constructively and quickly', 'I communicate clearly and persuasively', 'I build high-performing collaborative teams'] },
];

const opexChecklist = [
  { category: 'Process Excellence', items: ['Standard work documented and followed', 'KPIs are visible and reviewed daily', 'Process variation is measured and reduced', 'Value stream mapping completed and updated'] },
  { category: 'Continuous Improvement', items: ['Kaizen events conducted quarterly', 'Employee ideas captured and implemented', 'Lessons learned are shared across teams', 'PDCA cycle is actively used for problems'] },
  { category: 'Leadership Behaviors', items: ['Daily gemba walks completed', 'Coaching conversations held weekly', 'Recognition given frequently and specifically', 'Accountability conversations handled promptly'] },
  { category: 'Customer Focus', items: ['Voice of customer captured monthly', 'Customer complaint root causes addressed', 'First-time quality metrics tracked', 'On-time delivery performance monitored'] },
];

export default function EQOpEx() {
  const [activeTab, setActiveTab] = useState('eq');
  const [eqScores, setEqScores] = useState({});
  const [opexChecks, setOpexChecks] = useState({});

  function setScore(dimId, qIdx, val) {
    setEqScores(s => ({ ...s, [`${dimId}-${qIdx}`]: val }));
  }

  function toggleOpex(cat, idx) {
    const key = `${cat}-${idx}`;
    setOpexChecks(c => ({ ...c, [key]: !c[key] }));
  }

  const eqResults = eqDimensions.map(dim => {
    const scores = dim.questions.map((_, i) => eqScores[`${dim.id}-${i}`] || 0).filter(Boolean);
    const avg = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
    return { ...dim, avg };
  });

  const totalOpex = opexChecklist.reduce((a, c) => a + c.items.length, 0);
  const checkedOpex = Object.values(opexChecks).filter(Boolean).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">EQ & OpEx Tools</h1>
        <p className="text-slate-500 text-sm">Emotional Intelligence self-assessment and Operational Excellence checklist</p>
      </div>

      <div className="flex gap-2">
        {[{ id: 'eq', label: '💡 EQ Assessment' }, { id: 'opex', label: '⚙️ OpEx Checklist' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${activeTab === t.id ? 'text-white' : 'bg-slate-100 text-slate-600'}`}
            style={activeTab === t.id ? { background: '#0f2044' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'eq' && (
        <div className="space-y-4">
          {eqResults.some(d => d.avg > 0) && (
            <div className="grid grid-cols-5 gap-2">
              {eqResults.map(dim => (
                <div key={dim.id} className="card p-3 text-center">
                  <div className="text-xl">{dim.icon}</div>
                  <div className="text-lg font-bold mt-1" style={{ color: dim.avg >= 4 ? '#0d9488' : dim.avg >= 3 ? '#f59e0b' : dim.avg > 0 ? '#ef4444' : '#94a3b8' }}>{dim.avg || '—'}</div>
                  <div className="text-xs text-slate-500 leading-tight">{dim.label}</div>
                </div>
              ))}
            </div>
          )}
          {eqDimensions.map(dim => (
            <div key={dim.id} className="card overflow-hidden">
              <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <span className="text-xl">{dim.icon}</span>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{dim.label}</h4>
                  <p className="text-xs text-slate-500">{dim.desc}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {dim.questions.map((q, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-4 flex-wrap">
                    <p className="flex-1 text-sm text-slate-700">{q}</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setScore(dim.id, i, n)}
                          className="w-8 h-8 rounded-full text-xs font-bold transition-all border-2"
                          style={n <= (eqScores[`${dim.id}-${i}`] || 0)
                            ? { background: '#0d9488', borderColor: '#0d9488', color: 'white' }
                            : { borderColor: '#e2e8f0', color: '#94a3b8' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button className="btn-primary" onClick={() => toast.success('EQ assessment saved!')}>Save Assessment</button>
        </div>
      )}

      {activeTab === 'opex' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-700">OpEx Compliance Score</span>
              <span className="text-2xl font-bold" style={{ color: '#0d9488' }}>{Math.round((checkedOpex / totalOpex) * 100)}%</span>
            </div>
            <div className="bg-slate-100 rounded-full h-3">
              <div className="h-3 rounded-full transition-all" style={{ width: `${(checkedOpex / totalOpex) * 100}%`, background: '#0d9488' }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">{checkedOpex} of {totalOpex} behaviors practiced</p>
          </div>
          {opexChecklist.map(cat => (
            <div key={cat.category} className="card overflow-hidden">
              <div className="px-4 py-3 font-bold text-white text-sm" style={{ background: '#0f2044' }}>{cat.category}</div>
              <div className="divide-y divide-slate-100">
                {cat.items.map((item, i) => {
                  const key = `${cat.category}-${i}`;
                  return (
                    <button key={i} onClick={() => toggleOpex(cat.category, i)} className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-slate-50">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${opexChecks[key] ? 'text-white border-transparent' : 'border-slate-300'}`}
                        style={opexChecks[key] ? { background: '#0d9488' } : {}}>
                        {opexChecks[key] && '✓'}
                      </div>
                      <span className={`text-sm ${opexChecks[key] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
