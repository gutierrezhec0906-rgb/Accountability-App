import { useState, useEffect } from 'react';
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { logPointEvent, localDateStr } from '../utils/scoring';

const categories = ['Leadership', 'Performance', 'Communication', 'Coaching', 'Teamwork', 'Technical', 'General'];
const types = ['All', 'Peer', 'Supervisor', 'Direct Report', 'Self'];

function StarRow({ rating }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '0.9rem', color: n <= rating ? '#f59e0b' : '#e2e8f0' }}>★</span>)}
    </div>
  );
}

function Avatar({ name }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const colors = ['#0d9488', '#0f2044', '#7c3aed', '#be185d', '#b45309', '#065f46'];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.78rem', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function FeedbackPanel({ given, received, requests, onDelete, onDismissRequest }) {
  const [tab, setTab] = useState('given');

  return (
    <div style={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#0f2044', borderRadius: '12px 12px 0 0', padding: '0.75rem 1rem' }}>
        <p style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem', margin: '0 0 8px' }}>📋 Feedback History</p>
        <div style={{ display: 'flex', gap: 4 }}>
          {['given', 'received', 'requests'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, fontSize: '0.62rem', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: tab === t ? '#0d9488' : 'rgba(255,255,255,0.12)', color: 'white' }}>
              {t === 'given' ? `Given (${given.length})` : t === 'received' ? `Rcvd (${received.length})` : `Req (${requests.filter(r=>r.status==='pending').length})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, border: '1px solid #e8edf5', borderTop: 'none', borderRadius: '0 0 12px 12px', background: '#fafbfc', overflow: 'hidden' }}>
        {tab === 'requests' ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {requests.length === 0 ? (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0, fontStyle: 'italic' }}>No pending requests.</p>
              </div>
            ) : requests.map((r, i) => (
              <div key={r.id} style={{ padding: '0.75rem 1rem', borderBottom: i < requests.length - 1 ? '1px solid #e8edf5' : 'none', background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1e293b', margin: '0 0 2px' }}>To: {r.to}</p>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: 9999, padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700 }}>{r.category}</span>
                      <span style={{ background: r.status === 'pending' ? '#fef9c3' : '#dcfce7', color: r.status === 'pending' ? '#b45309' : '#15803d', borderRadius: 9999, padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700 }}>
                        {r.status === 'pending' ? '⏳ Pending' : '✅ Done'}
                      </span>
                    </div>
                    {r.note && <p style={{ fontSize: '0.68rem', color: '#64748b', margin: '3px 0 0', lineHeight: 1.4 }}>{r.note}</p>}
                    <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '3px 0 0' }}>{r.date}</p>
                  </div>
                  {r.status === 'pending' && (
                    <button onClick={() => onDismissRequest(r.id)}
                      title="Mark as fulfilled"
                      style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px', flexShrink: 0 }}>✓</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(tab === 'given' ? given : received).length === 0 ? (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0, fontStyle: 'italic' }}>No {tab} feedback yet.</p>
              </div>
            ) : (tab === 'given' ? given : received).map((f, i) => (
              <div key={f.id} style={{ padding: '0.75rem 1rem', borderBottom: i < given.length - 1 ? '1px solid #e8edf5' : 'none', background: 'white' }}>
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

// ── Request Feedback Modal ──
function RequestModal({ teamMembers, onClose, onSave }) {
  const [selected, setSelected] = useState([]);
  const [category, setCategory] = useState('General');
  const [note, setNote] = useState('');

  function toggleMember(uid) {
    setSelected(s => s.includes(uid) ? s.filter(id => id !== uid) : [...s, uid]);
  }

  function handleSend() {
    if (selected.length === 0) return toast.error('Select at least one person');
    onSave(selected, category, note.trim());
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: 500, width: '100%', padding: '1.5rem', borderRadius: 18, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '1.05rem' }}>📨 Request Feedback</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0' }}>Select who you want feedback from</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Team member picker */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
              Team Members ({selected.length} selected)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem' }}>
              {teamMembers.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', padding: '0.5rem', margin: 0 }}>No team members found.</p>
              ) : teamMembers.map(m => {
                const checked = selected.includes(m.uid);
                return (
                  <label key={m.uid}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.625rem', borderRadius: 8, cursor: 'pointer', background: checked ? '#f0fdfa' : 'transparent', border: `1px solid ${checked ? '#0d9488' : 'transparent'}`, transition: 'all 0.15s' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleMember(m.uid)} style={{ width: 16, height: 16, accentColor: '#0d9488', flexShrink: 0 }} />
                    <Avatar name={m.displayName} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>{m.displayName || m.email}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{[m.teamName, m.isAdmin ? 'Manager' : m.role].filter(Boolean).join(' · ') || 'Team Member'}</p>
                    </div>
                    {checked && <span style={{ fontSize: '0.8rem', color: '#0d9488', fontWeight: 700 }}>✓</span>}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Feedback Topic
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  style={{ padding: '0.3rem 0.75rem', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                    background: category === c ? '#0f2044' : '#f1f5f9', color: category === c ? 'white' : '#475569' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Optional note */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Add a note <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
            </label>
            <textarea className="input" rows={3}
              placeholder="e.g. I'd appreciate your feedback on my communication style during last week's project..."
              value={note} onChange={e => setNote(e.target.value)}
              style={{ resize: 'vertical' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn-primary" onClick={handleSend} style={{ flex: 1 }}
            disabled={selected.length === 0}>
            📨 Send Request{selected.length > 1 ? `s (${selected.length})` : ''}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function Feedback() {
  const { currentUser, userProfile } = useAuth();
  const [showForm, setShowForm]       = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [filterType, setFilterType]   = useState('All');
  const [form, setForm] = useState({ type: 'Peer', from: '', to: '', anonymous: false, category: 'Leadership', rating: 5, when: '', what: '', effect: '' });
  const [teamMembers, setTeamMembers] = useState([]);
  const [given,    setGiven]    = useState([]);
  const [received, setReceived] = useState([]);
  const [requests, setRequests] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [monthlyFeedbackCount, setMonthlyFeedbackCount] = useState(0);

  const myName = userProfile?.displayName || currentUser?.displayName || currentUser?.email || '';

  useEffect(() => {
    async function fetchAll() {
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          setGiven(data.feedbackEntries || []);
          setRequests(data.feedbackRequests || []);
          // Count feedback points earned in last 30 days
          const thirtyDaysAgo = localDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
          const fbCount = (data.pointEvents || [])
            .filter(e => e.toolLabel === 'Feedback Given' && e.date >= thirtyDaysAgo && e.points > 0)
            .length;
          setMonthlyFeedbackCount(fbCount);

          // Load team members from users collection filtered by same companyId
          const companyId = data.companyId;
          if (companyId) {
            const membersSnap = await getDocs(query(
              collection(db, 'users'),
              where('companyId', '==', companyId)
            ));
            const members = membersSnap.docs
              .map(d => ({ uid: d.id, ...d.data() }))
              .filter(m => m.status === 'approved' || m.isAdmin === true);
            setTeamMembers(members);
          }
        }
      } catch (e) { console.error(e); }
    }
    fetchAll();
  }, [currentUser]);

  async function awardFeedbackPoint() {
    if (monthlyFeedbackCount >= 5) return 'capped-monthly';
    const { awarded, capReached } = await logPointEvent(currentUser.uid, {
      points: 1,
      toolLabel: 'Feedback Given',
      reason: 'Gave feedback to a team member (+1 pt, max 5/month)',
    });
    if (awarded) {
      setMonthlyFeedbackCount(c => c + 1);
      return 'earned';
    }
    return capReached ? 'capped-daily' : false;
  }

  async function persist(entries, reqs) {
    const update = {};
    if (entries !== undefined) update.feedbackEntries  = entries;
    if (reqs    !== undefined) update.feedbackRequests = reqs;
    await setDoc(doc(db, 'users', currentUser.uid), update, { merge: true });
    if (entries !== undefined) setGiven(entries);
    if (reqs    !== undefined) setRequests(reqs);
  }

  async function submitFeedback(e) {
    e.preventDefault();
    if (!form.to) return toast.error('Please select a recipient');
    setSubmitting(true);
    try {
      const newEntry = {
        id: Date.now().toString(),
        uid: currentUser.uid,
        type: form.type,
        from: form.anonymous ? 'Anonymous' : (form.from || myName),
        to: form.to,
        anonymous: form.anonymous,
        category: form.category,
        rating: form.rating,
        when: form.when,
        what: form.what,
        effect: form.effect,
        text: [form.when && `When: ${form.when}`, form.what && `What: ${form.what}`, form.effect && `Effect: ${form.effect}`].filter(Boolean).join('\n\n'),
        date: localDateStr(),
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
      };
      await persist([newEntry, ...given], undefined);
      const earned = await awardFeedbackPoint();
      if (earned === 'earned') toast.success(`Feedback submitted! +1 pt (${monthlyFeedbackCount + 1}/5 this month)`, { duration: 5000 });
      else if (earned === 'capped-monthly') toast('Feedback submitted! You\'ve reached the 5-pt monthly feedback limit. Points reset in 30 days.', { duration: 6000, icon: '📅' });
      else if (earned === 'capped-daily') toast('Feedback submitted! Daily 25-pt cap reached — come back tomorrow.', { duration: 6000, icon: '📅' });
      else toast.success('Feedback submitted!');
      setForm({ type: 'Peer', from: '', to: '', anonymous: false, category: 'Leadership', rating: 5, when: '', what: '', effect: '' });
      setShowForm(false);
    } catch (e) { toast.error('Submit failed: ' + (e?.message || e)); }
    setSubmitting(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this feedback?')) return;
    try {
      await persist(given.filter(f => f.id !== id), undefined);
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  }

  async function handleSendRequests(selectedUids, category, note) {
    const now = localDateStr();
    const newReqs = selectedUids.map(uid => {
      const member = teamMembers.find(m => m.uid === uid);
      return {
        id: `${Date.now()}-${uid}`,
        to: member?.displayName || member?.email || uid,
        toUid: uid,
        toRole: member?.role || '',
        category,
        note,
        date: now,
        status: 'pending',
      };
    });
    try {
      await persist(undefined, [...newReqs, ...requests]);
      const names = newReqs.map(r => r.to).join(', ');
      toast.success(`Request${newReqs.length > 1 ? 's' : ''} sent to ${names}`);
    } catch { toast.error('Could not save requests'); }
  }

  async function handleDismissRequest(id) {
    try {
      await persist(undefined, requests.map(r => r.id === id ? { ...r, status: 'fulfilled' } : r));
      toast.success('Marked as fulfilled');
    } catch { toast.error('Update failed'); }
  }

  const allFeedback = [...given, ...received.filter(r => !given.find(g => g.id === r.id))];
  const filtered    = filterType === 'All' ? allFeedback : allFeedback.filter(f => f.type === filterType);
  const avg = allFeedback.length ? (allFeedback.reduce((a, f) => a + f.rating, 0) / allFeedback.length).toFixed(1) : '—';
  const pendingRequests = requests.filter(r => r.status === 'pending').length;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader icon="📬" title="Feedback Box" subtitle="Anonymous or named feedback from peers, supervisors, and leaders"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setShowRequest(true)} style={{ position: 'relative' }}>
              📨 Request Feedback
              {pendingRequests > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pendingRequests}
                </span>
              )}
            </button>
            <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Give Feedback</button>
          </div>
        }
      />

      {/* Request modal */}
      {showRequest && (
        <RequestModal
          teamMembers={teamMembers}
          onClose={() => setShowRequest(false)}
          onSave={handleSendRequests}
        />
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Avg Rating',        value: avg,                                           color: '#0d9488' },
          { label: 'Total Feedback',    value: allFeedback.length,                            color: '#0f2044' },
          { label: 'Pending Requests',  value: pendingRequests,                               color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="stat-tile" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending requests banner */}
      {pendingRequests > 0 && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 12, padding: '0.75rem 1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1rem' }}>⏳</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e' }}>
            You have {pendingRequests} pending feedback request{pendingRequests > 1 ? 's' : ''}.
          </span>
          <button onClick={() => setShowRequest(true)} style={{ marginLeft: 'auto', background: '#0f2044', color: 'white', border: 'none', borderRadius: 8, padding: '0.3rem 0.875rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            View Requests
          </button>
        </div>
      )}

      {/* Main layout */}
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
                          {m.displayName || m.email}{m.teamName ? ` · ${m.teamName}` : ''}{m.isAdmin ? ' (Manager)' : m.role ? ` (${m.role})` : ''}{m.uid === currentUser.uid ? ' — You' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Rating</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    {[
                      { n: 1, label: 'Small', desc: 'Worth a mention, but limited scope' },
                      { n: 2, label: 'Noticed', desc: 'A positive moment, but minor' },
                      { n: 3, label: 'Solid', desc: 'Met the standard well' },
                      { n: 4, label: 'Strong', desc: 'Clearly did more than expected' },
                      { n: 5, label: 'Exceptional', desc: 'Went well beyond what the situation required' },
                    ].map(({ n, label, desc }) => (
                      <div key={n} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                        onMouseEnter={e => { const tip = e.currentTarget.querySelector('.rating-tip'); if (tip) tip.style.opacity = '1'; }}
                        onMouseLeave={e => { const tip = e.currentTarget.querySelector('.rating-tip'); if (tip) tip.style.opacity = '0'; }}>
                        {/* Tooltip */}
                        <div className="rating-tip" style={{
                          position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
                          background: '#0f2044', color: 'white', borderRadius: 8, padding: '6px 10px',
                          width: 160, fontSize: '0.72rem', lineHeight: 1.4, textAlign: 'center',
                          pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s', zIndex: 10,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        }}>
                          <span style={{ fontWeight: 700, display: 'block', marginBottom: 2 }}>{n} — {label}</span>
                          {desc}
                          {/* Arrow */}
                          <span style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #0f2044' }} />
                        </div>
                        <button type="button" onClick={() => setForm(f => ({ ...f, rating: n }))}
                          style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${n <= form.rating ? '#0d9488' : '#e2e8f0'}`, background: n <= form.rating ? '#0d9488' : 'transparent', color: n <= form.rating ? 'white' : '#94a3b8', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                          {n}
                        </button>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: n <= form.rating ? '#0d9488' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {[
                  { key: 'when',   label: 'When did this happen?',         placeholder: 'e.g. Tuesday\'s huddle, last Thursday\'s client call…' },
                  { key: 'what',   label: 'What did they specifically do?', placeholder: 'e.g. flagged the material delay before being asked…' },
                  { key: 'effect', label: 'What was the positive effect?',  placeholder: 'e.g. team resequenced immediately instead of losing time mid-shift…' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <textarea className="input" rows={2} required value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ resize: 'vertical' }} />
                  </div>
                ))}
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
        <FeedbackPanel given={given} received={received} requests={requests} onDelete={handleDelete} onDismissRequest={handleDismissRequest} />
      </div>
    </div>
  );
}
