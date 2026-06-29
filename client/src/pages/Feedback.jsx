import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const sampleFeedback = [
  { id: 1, type: 'Peer',          from: 'Anonymous',      date: '2024-07-18', category: 'Leadership',   rating: 4, text: 'Great job facilitating the team meeting last week. Clear agenda and kept everyone on track.' },
  { id: 2, type: 'Supervisor',    from: 'Maria Gonzalez', date: '2024-07-15', category: 'Performance',  rating: 5, text: 'Excellent execution on the Q2 project. Your attention to detail and proactiveness made a real difference.' },
  { id: 3, type: 'Peer',          from: 'Anonymous',      date: '2024-07-10', category: 'Communication',rating: 3, text: 'Sometimes the updates come too late in the day. Earlier communication would help the team plan better.' },
  { id: 4, type: 'Direct Report', from: 'Tom Baker',      date: '2024-07-05', category: 'Coaching',     rating: 5, text: 'The one-on-one coaching sessions have been incredibly helpful. I feel much more supported in my growth.' },
];

const categories = ['Leadership', 'Performance', 'Communication', 'Coaching', 'Teamwork', 'Technical', 'General'];
const types = ['All', 'Peer', 'Supervisor', 'Direct Report', 'Self'];

export default function Feedback() {
  const { currentUser } = useAuth();
  const [feedback, setFeedback] = useState(sampleFeedback);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('All');
  const [form, setForm] = useState({ type: 'Peer', from: '', to: '', anonymous: false, category: 'Leadership', rating: 5, text: '' });
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    async function fetchTeam() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const members = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(m => m.status === 'approved' && m.uid !== currentUser?.uid);
        setTeamMembers(members);
      } catch {}
    }
    if (currentUser) fetchTeam();
  }, [currentUser]);

  function submitFeedback(e) {
    e.preventDefault();
    setFeedback(f => [{ ...form, id: Date.now(), date: new Date().toISOString().split('T')[0], from: form.anonymous ? 'Anonymous' : form.from }, ...f]);
    setForm({ type: 'Peer', from: '', to: '', anonymous: false, category: 'Leadership', rating: 5, text: '' });
    setShowForm(false);
    toast.success('Feedback submitted!');
  }

  const filtered = filterType === 'All' ? feedback : feedback.filter(f => f.type === filterType);
  const avg = feedback.length ? (feedback.reduce((a, f) => a + f.rating, 0) / feedback.length).toFixed(1) : 0;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHeader icon="📬" title="Feedback Box" subtitle="Anonymous or named feedback from peers, supervisors, and leaders"
        action={<button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Give Feedback</button>} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Avg Rating',     value: avg,                                          color: '#0d9488' },
          { label: 'Total Feedback', value: feedback.length,                              color: '#0f2044' },
          { label: 'Needs Attention',value: feedback.filter(f => f.rating <= 3).length,  color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="stat-tile" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>Submit Feedback</h3>
          <form onSubmit={submitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><label className="label">Feedback Type</label><select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{types.slice(1).map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className="label">Category</label><select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="anon" checked={form.anonymous} onChange={e => setForm(f => ({ ...f, anonymous: e.target.checked }))} style={{ width: 16, height: 16 }} />
              <label htmlFor="anon" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Submit Anonymously</label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {!form.anonymous && <div><label className="label">Your Name (From)</label><input className="input" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} placeholder="Your name" /></div>}
              <div style={form.anonymous ? { gridColumn: '1 / -1' } : {}}>
                <label className="label">Recipient (To) *</label>
                <select className="input" required value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))}>
                  <option value="">— Select team member —</option>
                  {teamMembers.map(m => (
                    <option key={m.uid} value={m.displayName || m.email}>{m.displayName || m.email}{m.role ? ` (${m.role})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Rating</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setForm(f => ({ ...f, rating: n }))}
                    style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${n <= form.rating ? '#0d9488' : '#e2e8f0'}`, background: n <= form.rating ? '#0d9488' : 'transparent', color: n <= form.rating ? 'white' : '#94a3b8', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="label">Feedback Message</label><textarea className="input" rows={4} required value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="Be specific and constructive..." /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">Submit Feedback</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {types.map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            style={{ padding: '0.375rem 1rem', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: filterType === t ? '#0f2044' : '#f1f5f9', color: filterType === t ? '#fff' : '#475569' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(f => (
          <div key={f.id} className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#e0f2fe,#bae6fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', flexShrink: 0 }}>
                  {f.from === 'Anonymous' ? '🎭' : f.from[0]}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{f.from}</span>
                    {f.to && <><span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>→</span><span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0d9488' }}>{f.to}</span></>}
                    <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 9999, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{f.type}</span>
                    <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 9999, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{f.category}</span>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>{f.date}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '1rem', color: n <= f.rating ? '#f59e0b' : '#e2e8f0' }}>★</span>)}
              </div>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
