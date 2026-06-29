import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, query, where, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const categories = ['Leadership', 'Performance', 'Communication', 'Coaching', 'Teamwork', 'Technical', 'General'];
const types = ['All', 'Peer', 'Supervisor', 'Direct Report', 'Self'];

function StarRow({ rating }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '0.9rem', color: n <= rating ? '#f59e0b' : '#e2e8f0' }}>★</span>)}
    </div>
  );
}

function FeedbackPanel({ given, received, onDelete }) {
  const [tab, setTab] = useState('given');
  const entries = tab === 'given' ? given : received;

  return (
    <div style={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#0f2044', borderRadius: '12px 12px 0 0', padding: '0.75rem 1rem' }}>
        <p style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem', margin: '0 0 8px' }}>📋 Feedback History</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {['given', 'received'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, fontSize: '0.7rem', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: 'none', cursor: 'pointer', background: tab === t ? '#0d9488' : 'rgba(255,255,255,0.12)', color: 'white' }}>
              {t === 'given' ? `Given (${given.length})` : `Received (${received.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, border: '1px solid #e8edf5', borderTop: 'none', borderRadius: '0 0 12px 12px', background: '#fafbfc', overflow: 'hidden' }}>
        {entries.length === 0 ? (
          <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0, fontStyle: 'italic' }}>
              No {tab} feedback yet.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {entries.map((f, i) => (
              <div key={f.id} style={{ padding: '0.75rem 1rem', borderBottom: i < entries.length - 1 ? '1px solid #e8edf5' : 'none', background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1e293b', margin: '0 0 1px' }}>
                      {tab === 'given' ? `To: ${f.to}` : `From: ${f.anonymous ? 'Anonymous' : f.from}`}
                    </p>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 9999, padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700 }}>{f.type}</span>
                      <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 9999, padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700 }}>{f.category}</span>
                    </div>
                  </div>
                  <button onClick={() => onDelete(f.id)}
                    style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px', flexShrink: 0 }}>🗑</button>
                </div>
                <StarRow rating={f.rating} />
                <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '4px 0 0', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f.text}</p>
                {f.createdAt && <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '4px 0 0' }}>{new Date(f.createdAt.seconds * 1000).toLocaleDateString()}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Feedback() {
  const { currentUser, userProfile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('All');
  const [form, setForm] = useState({ type: 'Peer', from: '', to: '', anonymous: false, category: 'Leadership', rating: 5, text: '' });
  const [teamMembers, setTeamMembers] = useState([]);
  const [given,    setGiven]    = useState([]);
  const [received, setReceived] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const myName = userProfile?.displayName || currentUser?.displayName || currentUser?.email || '';

  // Fetch team members
  useEffect(() => {
    async function fetchTeam() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        setTeamMembers(snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(m => m.status === 'approved' && m.uid !== currentUser?.uid));
      } catch {}
    }
    if (currentUser) fetchTeam();
  }, [currentUser]);

  // Fetch feedback given and received
  async function fetchFeedback() {
    if (!currentUser) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'feedback'),
        where('uid', '==', currentUser.uid),
      ));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setGiven(all);
    } catch (e) { console.error('fetchGiven:', e); }

    try {
      const snap2 = await getDocs(query(
        collection(db, 'feedback'),
        where('to', '==', myName),
      ));
      const recv = snap2.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setReceived(recv);
    } catch (e) { console.error('fetchReceived:', e); }
  }

  useEffect(() => { fetchFeedback(); }, [currentUser]);

  async function submitFeedback(e) {
    e.preventDefault();
    if (!form.to) return toast.error('Please select a recipient');
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        uid: currentUser.uid,
        type: form.type,
        from: form.anonymous ? 'Anonymous' : (form.from || myName),
        to: form.to,
        anonymous: form.anonymous,
        category: form.category,
        rating: form.rating,
        text: form.text,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
      });
      toast.success('Feedback submitted!');
      setForm({ type: 'Peer', from: '', to: '', anonymous: false, category: 'Leadership', rating: 5, text: '' });
      setShowForm(false);
      fetchFeedback();
    } catch (e) { toast.error('Submit failed: ' + (e?.message || e)); }
    setSubmitting(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this feedback?')) return;
    try {
      await deleteDoc(doc(db, 'feedback', id));
      toast.success('Deleted');
      fetchFeedback();
    } catch { toast.error('Delete failed'); }
  }

  // Combine given + received for the main feed display (deduplicated)
  const allFeedback = [...given, ...received.filter(r => !given.find(g => g.id === r.id))];
  const filtered = filterType === 'All' ? allFeedback : allFeedback.filter(f => f.type === filterType);
  const avg = allFeedback.length ? (allFeedback.reduce((a, f) => a + f.rating, 0) / allFeedback.length).toFixed(1) : '—';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader icon="📬" title="Feedback Box" subtitle="Anonymous or named feedback from peers, supervisors, and leaders"
        action={<button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Give Feedback</button>} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Avg Rating',      value: avg,                                               color: '#0d9488' },
          { label: 'Total Feedback',  value: allFeedback.length,                                color: '#0f2044' },
          { label: 'Needs Attention', value: allFeedback.filter(f => f.rating <= 3).length,     color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="stat-tile" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Main layout: feed + right panel */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Submit form */}
          {showForm && (
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>Submit Feedback</h3>
              <form onSubmit={submitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div><label className="label">Feedback Type</label>
                    <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      {types.slice(1).map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Category</label>
                    <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="anon" checked={form.anonymous} onChange={e => setForm(f => ({ ...f, anonymous: e.target.checked }))} style={{ width: 16, height: 16 }} />
                  <label htmlFor="anon" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Submit Anonymously</label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {!form.anonymous && (
                    <div><label className="label">Your Name (From)</label>
                      <input className="input" value={form.from || myName} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} placeholder="Your name" />
                    </div>
                  )}
                  <div style={form.anonymous ? { gridColumn: '1 / -1' } : {}}>
                    <label className="label">Recipient (To) *</label>
                    <select className="input" required value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))}>
                      <option value="">— Select team member —</option>
                      {teamMembers.map(m => (
                        <option key={m.uid} value={m.displayName || m.email}>
                          {m.displayName || m.email}{m.role ? ` (${m.role})` : ''}
                        </option>
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
                <div><label className="label">Feedback Message</label>
                  <textarea className="input" rows={4} required value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="Be specific and constructive..." />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-primary" type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Feedback'}</button>
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

          {/* Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.length === 0 ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No feedback yet. Click "+ Give Feedback" to get started.</div>
            ) : filtered.map(f => (
              <div key={f.id} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#e0f2fe,#bae6fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', flexShrink: 0 }}>
                      {f.from === 'Anonymous' ? '🎭' : (f.from?.[0] || '?')}
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
                  <StarRow rating={f.rating} />
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <FeedbackPanel given={given} received={received} onDelete={handleDelete} />
      </div>
    </div>
  );
}
