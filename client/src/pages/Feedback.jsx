import { useState } from 'react';
import toast from 'react-hot-toast';

const sampleFeedback = [
  { id: 1, type: 'Peer', from: 'Anonymous', date: '2024-07-18', category: 'Leadership', rating: 4, text: 'Great job facilitating the team meeting last week. Clear agenda and kept everyone on track.' },
  { id: 2, type: 'Supervisor', from: 'Maria Gonzalez', date: '2024-07-15', category: 'Performance', rating: 5, text: 'Excellent execution on the Q2 project. Your attention to detail and proactiveness made a real difference.' },
  { id: 3, type: 'Peer', from: 'Anonymous', date: '2024-07-10', category: 'Communication', rating: 3, text: 'Sometimes the updates come too late in the day. Earlier communication would help the team plan better.' },
  { id: 4, type: 'Direct Report', from: 'Tom Baker', date: '2024-07-05', category: 'Coaching', rating: 5, text: 'The one-on-one coaching sessions have been incredibly helpful. I feel much more supported in my growth.' },
];

const categories = ['Leadership', 'Performance', 'Communication', 'Coaching', 'Teamwork', 'Technical', 'General'];

export default function Feedback() {
  const [feedback, setFeedback] = useState(sampleFeedback);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('All');
  const [form, setForm] = useState({ type: 'Peer', from: '', anonymous: false, category: 'Leadership', rating: 5, text: '' });

  function submitFeedback(e) {
    e.preventDefault();
    const entry = {
      ...form,
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      from: form.anonymous ? 'Anonymous' : form.from,
    };
    setFeedback(f => [entry, ...f]);
    setForm({ type: 'Peer', from: '', anonymous: false, category: 'Leadership', rating: 5, text: '' });
    setShowForm(false);
    toast.success('Feedback submitted!');
  }

  const types = ['All', 'Peer', 'Supervisor', 'Direct Report', 'Self'];
  const filtered = filterType === 'All' ? feedback : feedback.filter(f => f.type === filterType);
  const avg = feedback.length ? (feedback.reduce((a, f) => a + f.rating, 0) / feedback.length).toFixed(1) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Feedback Box</h1>
          <p className="text-slate-500 text-sm">Anonymous or named feedback from peers, supervisors, and leaders</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Give Feedback</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold" style={{ color: '#0d9488' }}>{avg}</p>
          <p className="text-xs text-slate-500">Avg Rating</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold" style={{ color: '#1e3a6e' }}>{feedback.length}</p>
          <p className="text-xs text-slate-500">Total Feedback</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{feedback.filter(f => f.rating <= 3).length}</p>
          <p className="text-xs text-slate-500">Needs Attention</p>
        </div>
      </div>

      {showForm && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-700 mb-4">Submit Feedback</h3>
          <form onSubmit={submitFeedback} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Feedback Type</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {['Peer', 'Supervisor', 'Direct Report', 'Self'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="anon" checked={form.anonymous} onChange={e => setForm(f => ({ ...f, anonymous: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="anon" className="text-sm font-medium text-slate-700">Submit Anonymously</label>
            </div>
            {!form.anonymous && (
              <div>
                <label className="label">Your Name</label>
                <input className="input" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} placeholder="Your name" />
              </div>
            )}
            <div>
              <label className="label">Rating (1–5)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setForm(f => ({ ...f, rating: n }))}
                    className="w-10 h-10 rounded-full font-bold text-sm transition-all border-2"
                    style={n <= form.rating ? { background: '#0d9488', borderColor: '#0d9488', color: 'white' } : { borderColor: '#e2e8f0', color: '#94a3b8' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Feedback Message</label>
              <textarea className="input" rows={4} required value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="Be specific and constructive..." />
            </div>
            <div className="flex gap-3">
              <button className="btn-primary" type="submit">Submit Feedback</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filterType === t ? 'text-white' : 'bg-slate-100 text-slate-600'}`}
            style={filterType === t ? { background: '#0f2044' } : {}}>
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(f => (
          <div key={f.id} className="card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: '#f0fdfa' }}>
                  {f.from === 'Anonymous' ? '🎭' : f.from[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-800">{f.from}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#e0f2fe', color: '#0369a1' }}>{f.type}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#f1f5f9', color: '#475569' }}>{f.category}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{f.date}</p>
                </div>
              </div>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= f.rating ? '#f59e0b' : '#e2e8f0', fontSize: '1rem' }}>★</span>)}
              </div>
            </div>
            <p className="text-sm text-slate-700 mt-3 leading-relaxed">{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
