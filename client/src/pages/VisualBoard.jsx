import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logPointEvent, calculateScore } from '../utils/scoring';

// Status is computed automatically from due date — never manually set
function computeStatus(dueDate, recommitmentDate) {
  const active = recommitmentDate || dueDate;
  if (!active) return { label: 'Green', color: '#22c55e', bg: '#dcfce7', text: '#15803d', border: '#86efac', overdue: false, daysLeft: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(active + 'T00:00:00');
  const days  = Math.round((due - today) / 86400000);
  if (days < 0)  return { label: 'Red',    color: '#ef4444', bg: '#fee2e2', text: '#dc2626', border: '#fca5a5', overdue: true,  daysLeft: days };
  if (days <= 5) return { label: 'Yellow', color: '#eab308', bg: '#fef9c3', text: '#b45309', border: '#fde047', overdue: false, daysLeft: days };
  return           { label: 'Green',  color: '#22c55e', bg: '#dcfce7', text: '#15803d', border: '#86efac', overdue: false, daysLeft: days };
}

function RecommitModal({ entry, onSubmit, onDismiss }) {
  const [newDate, setNewDate] = useState('');
  const st = computeStatus(entry.dueDate, entry.recommitmentDate);
  const overdueDays = Math.abs(st.daysLeft);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 18, padding: '2rem', maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>🔴</div>
          <div>
            <p style={{ fontWeight: 900, color: '#ef4444', margin: 0, fontSize: '1rem' }}>Action Past Due — Recommitment Required</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              {overdueDays}d overdue · Originally due {new Date((entry.recommitmentDate || entry.dueDate) + 'T00:00:00').toLocaleDateString()}
            </p>
          </div>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.875rem', marginBottom: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.9rem' }}>{entry.title}</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>👤 {entry.owner}</p>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '0.75rem', marginBottom: '1.25rem', display: 'flex', gap: 8 }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: '0.78rem', color: '#92400e', margin: 0, lineHeight: 1.5 }}>
            <strong>−5 points have been deducted</strong> from your accountability score for going past due. Set a new date to keep this action active.
          </p>
        </div>

        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: 6 }}>
          📅 New Commitment Date
        </label>
        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          style={{ width: '100%', padding: '0.6rem 0.875rem', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: '0.9rem', marginBottom: '1.25rem', boxSizing: 'border-box' }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onSubmit(entry.id, newDate)} disabled={!newDate}
            style={{ flex: 1, padding: '0.65rem', borderRadius: 10, background: newDate ? '#0f2044' : '#e2e8f0', color: newDate ? 'white' : '#94a3b8', fontWeight: 800, fontSize: '0.875rem', border: 'none', cursor: newDate ? 'pointer' : 'not-allowed' }}>
            ✓ Commit to New Date
          </button>
          <button onClick={onDismiss}
            style={{ padding: '0.65rem 1rem', borderRadius: 10, background: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: '0.875rem', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = { title: '', owner: '', dueDate: '', notes: '' };

export default function VisualBoard() {
  const { currentUser } = useAuth();
  const [items, setItems]       = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter]     = useState('All');
  const [form, setForm]         = useState(EMPTY_FORM);
  const [modalEntry, setModalEntry] = useState(null);
  const [inlineDates, setInlineDates] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [sortBy, setSortBy] = useState('date-asc');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [closingId, setClosingId] = useState(null);   // id of card showing close-confirm
  const [showClosed, setShowClosed] = useState(false);

  async function fetchItems() {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      const entries = snap.exists() ? (snap.data().visualBoard || []) : [];
      entries.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(entries);

      // Fire recommitment modal for first past-due open item not yet deducted
      const overdue = entries.find(e => {
        if (e.closed) return false;
        const st = computeStatus(e.dueDate, e.recommitmentDate);
        return st.overdue && !e.deductionApplied;
      });
      if (overdue) setModalEntry(overdue);
    } catch (e) {
      toast.error('Load failed: ' + e?.message);
    }
  }

  async function persist(updated) {
    await setDoc(doc(db, 'users', currentUser.uid), { visualBoard: updated }, { merge: true });
    setItems(updated);
  }

  useEffect(() => { fetchItems(); }, [currentUser]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!currentUser) return toast.error('Not logged in');
    try {
      const newItem = {
        id: Date.now().toString(),
        uid: currentUser.uid,
        title:   form.title,
        owner:   form.owner,
        dueDate: form.dueDate,
        notes:   form.notes,
        recommitmentDate:  null,
        recommitmentCount: 0,
        deductionApplied:  false,
        closed:     false,
        closedAt:   null,
        closedOnTime: false,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
      };
      await persist([newItem, ...items]);

      const qaTs = localStorage.getItem('ps_quick_action_ts');
      if (qaTs && Date.now() - parseInt(qaTs, 10) < 5 * 60 * 1000) {
        localStorage.removeItem('ps_quick_action_ts');
        const { awarded, capReached } = await logPointEvent(currentUser.uid, {
          points: 1,
          toolLabel: 'Quick Action',
          reason: 'Created a board action within 5 min of Problem Solving Quick Action',
        });
        if (awarded) {
          await updateDoc(doc(db, 'users', currentUser.uid), { bonusPoints: increment(1) });
          calculateScore(currentUser.uid).catch(() => {});
          toast.success('+1 pt — action logged within 5 minutes!', { duration: 6000 });
        } else if (capReached) {
          toast('Action added to board. Daily 25-pt limit reached — keep going tomorrow!', { duration: 6000, icon: '📅' });
        } else {
          toast.success('Action added to board');
        }
      } else {
        if (qaTs) localStorage.removeItem('ps_quick_action_ts');
        toast.success('Action added to board');
      }

      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (e) {
      toast.error('Save failed: ' + e?.message);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditForm({ title: item.title, owner: item.owner, dueDate: item.dueDate, notes: item.notes || '' });
  }

  async function handleEditSave(id) {
    try {
      await persist(items.map(i => i.id === id ? { ...i, ...editForm, updatedAt: { seconds: Math.floor(Date.now() / 1000) } } : i));
      setEditingId(null);
      toast.success('Action updated');
    } catch (e) {
      toast.error('Update failed: ' + e?.message);
    }
  }

  async function handleDelete(id) {
    try {
      await persist(items.filter(i => i.id !== id));
    } catch (e) {
      toast.error('Delete failed: ' + e?.message);
    }
  }

  // Close an action — awards +5 pts if on time AND zero recommitments
  async function handleClose(item) {
    const st = computeStatus(item.dueDate, item.recommitmentDate);
    const recommitCount = item.recommitmentCount || 0;
    const closedOnTime  = !st.overdue && recommitCount === 0;
    try {
      await persist(items.map(i => i.id === item.id
        ? { ...i, closed: true, closedAt: { seconds: Math.floor(Date.now() / 1000) }, closedOnTime }
        : i
      ));
      setClosingId(null);

      if (closedOnTime) {
        const { awarded, capReached } = await logPointEvent(currentUser.uid, {
          points: 5,
          toolLabel: 'Action Closed On Time',
          reason: `Closed action on time with no recommitments: "${item.title}"`,
        });
        if (awarded) {
          calculateScore(currentUser.uid).catch(() => {});
          toast.success('+5 pts! Action closed on time with no recommitments.', { duration: 6000 });
        } else if (capReached) {
          toast('Action closed! Daily 25-pt cap reached — great work today.', { duration: 5000, icon: '📅' });
        } else {
          toast.success('Action closed!');
        }
      } else if (recommitCount > 0) {
        toast('Action closed. No points awarded — action had recommitments.', { icon: '📋', duration: 5000 });
      } else {
        // closed past due
        toast('Action closed.', { icon: '📋' });
      }
    } catch (e) {
      toast.error('Close failed: ' + e?.message);
    }
  }

  async function handleRecommit(id, newDate, item) {
    const st = computeStatus(newDate, null);
    if (st.overdue) return toast.error('Recommitment date must be today or in the future');
    try {
      const updatedItem = {
        ...item,
        recommitmentDate:  newDate,
        recommitmentCount: (item.recommitmentCount || 0) + 1,
        recommitmentSetAt: { seconds: Math.floor(Date.now() / 1000) },
        // Reset deductionApplied so a future miss also triggers -5 pts
        deductionApplied: false,
        pointsRestored: item?.pointsRestored || false,
      };
      await persist(items.map(i => i.id === id ? updatedItem : i));
      toast.success('New commitment date set!');
      setModalEntry(null);
    } catch (e) {
      toast.error('Failed to save: ' + e?.message);
    }
  }

  async function handleDismissModal() {
    if (!modalEntry || !currentUser) { setModalEntry(null); return; }
    try {
      await persist(items.map(i => i.id === modalEntry.id ? { ...i, deductionApplied: true } : i));
      await updateDoc(doc(db, 'users', currentUser.uid), { penaltyPoints: increment(5) });
      await logPointEvent(currentUser.uid, {
        points: -5,
        toolLabel: 'Visual Board Past Due',
        reason: `Action went past due: "${modalEntry.title}"`,
      });
      calculateScore(currentUser.uid).catch(() => {});
      toast.error('−5 pts deducted — action is past due');
      setModalEntry(null);
    } catch (e) {
      console.error(e);
      setModalEntry(null);
    }
  }

  const activeItems = items.filter(i => !i.closed);
  const closedItems = items.filter(i => i.closed);

  const enriched = activeItems.map(item => ({ ...item, st: computeStatus(item.dueDate, item.recommitmentDate) }));
  const counts = { Green: 0, Yellow: 0, Red: 0 };
  enriched.forEach(i => { if (counts[i.st.label] !== undefined) counts[i.st.label]++; });

  const owners = ['All', ...Array.from(new Set(activeItems.map(i => i.owner).filter(Boolean))).sort()];

  const filtered = enriched
    .filter(i => filter === 'All' || i.st.label === filter)
    .filter(i => ownerFilter === 'All' || i.owner === ownerFilter)
    .sort((a, b) => {
      if (sortBy === 'date-asc')  return (a.dueDate || '') < (b.dueDate || '') ? -1 : 1;
      if (sortBy === 'date-desc') return (a.dueDate || '') > (b.dueDate || '') ? -1 : 1;
      if (sortBy === 'alpha')     return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'owner')     return (a.owner || '').localeCompare(b.owner || '');
      return 0;
    });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <PageHeader icon="🔴" title="Visual Management Board" subtitle="Escalation tracker — status updates automatically based on due date"
        action={<button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Action</button>} />

      {modalEntry && (
        <RecommitModal entry={modalEntry} onSubmit={(id, date) => handleRecommit(id, date, modalEntry)} onDismiss={handleDismissModal} />
      )}

      {/* Status legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[['🔴', '#ef4444', 'Red — Past due'], ['🟡', '#d97706', 'Yellow — Due ≤ 5 days'], ['🟢', '#15803d', 'Green — Due 6+ days']].map(([icon, color, label]) => (
          <span key={label} style={{ fontSize: '0.72rem', fontWeight: 700, color, background: color + '12', padding: '2px 10px', borderRadius: 9999 }}>
            {icon} {label}
          </span>
        ))}
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0d9488', background: '#f0fdfa', padding: '2px 10px', borderRadius: 9999 }}>
          ✅ Closed on time = +5 pts (this week)
        </span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '2px 10px', borderRadius: 9999 }}>
          ⚠️ Past due = −5 pts each occurrence
        </span>
      </div>

      {/* Status summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {['Green', 'Yellow', 'Red'].map(s => {
          const st = computeStatus(s === 'Green' ? '9999-01-01' : s === 'Yellow' ? new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] : '2000-01-01');
          return (
            <div key={s} onClick={() => setFilter(f => f === s ? 'All' : s)}
              style={{ background: filter === s ? st.bg : '#fff', border: `1.5px solid ${filter === s ? st.color : 'var(--border)'}`, borderRadius: 14, padding: '1rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.18s', boxShadow: '0 2px 8px rgba(15,32,68,0.05)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: st.color, margin: '0 auto 8px' }} />
              <p style={{ fontSize: '2rem', fontWeight: 900, color: st.color, margin: 0, lineHeight: 1 }}>{counts[s]}</p>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: st.text, margin: '4px 0 0' }}>{s}</p>
            </div>
          );
        })}
        {/* Closed tile */}
        <div onClick={() => setShowClosed(s => !s)}
          style={{ background: showClosed ? '#f0fdfa' : '#fff', border: `1.5px solid ${showClosed ? '#0d9488' : 'var(--border)'}`, borderRadius: 14, padding: '1rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.18s', boxShadow: '0 2px 8px rgba(15,32,68,0.05)' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0d9488', margin: '0 auto 8px' }} />
          <p style={{ fontSize: '2rem', fontWeight: 900, color: '#0d9488', margin: 0, lineHeight: 1 }}>{closedItems.length}</p>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0d9488', margin: '4px 0 0' }}>Closed ✓</p>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>New Action Item</h3>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label className="label">Title / Action</label><input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Describe the action..." /></div>
            <div><label className="label">Owner</label><input className="input" required value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Responsible person" /></div>
            <div><label className="label">Due Date <span style={{ color: '#ef4444' }}>*</span></label><input className="input" type="date" required value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                🟢 6+ days · 🟡 ≤5 days · 🔴 Past due<br />Status is set <strong>automatically</strong> from due date.
              </p>
            </div>
            <div style={{ gridColumn: '1/-1' }}><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional details..." /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">Add to Board</button>
              <button className="btn-secondary" type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Closed items panel */}
      {showClosed && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #0d9488' }}>
          <h3 style={{ fontWeight: 800, color: '#0d9488', marginBottom: '1rem', fontSize: '0.95rem', margin: '0 0 1rem' }}>
            ✅ Closed Actions ({closedItems.length})
          </h3>
          {closedItems.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No closed actions yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {closedItems.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem', background: '#f8fffe', border: '1px solid #99f6e4', borderRadius: 10 }}>
                  <span style={{ fontSize: '1.1rem' }}>✅</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>{item.title}</p>
                    <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      <span>👤 {item.owner}</span>
                      {item.closedAt?.seconds && <span>Closed {new Date(item.closedAt.seconds * 1000).toLocaleDateString()}</span>}
                      {item.recommitmentCount > 0 && <span style={{ color: '#f59e0b' }}>🔄 {item.recommitmentCount} recommitment{item.recommitmentCount > 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 800,
                    background: item.closedOnTime ? '#dcfce7' : '#f1f5f9',
                    color: item.closedOnTime ? '#15803d' : '#64748b' }}>
                    {item.closedOnTime ? '+5 pts' : 'No pts'}
                  </span>
                  <button onClick={() => handleDelete(item.id)} title="Remove"
                    style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '1.1rem', padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter + Sort toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', 'Green', 'Yellow', 'Red'].map(s => {
          const stColor = s === 'Green' ? '#22c55e' : s === 'Yellow' ? '#eab308' : s === 'Red' ? '#ef4444' : '#0f2044';
          return (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '0.375rem 1rem', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: filter === s ? stColor : '#f1f5f9',
                color: filter === s ? '#fff' : '#475569' }}>
              {s} ({s === 'All' ? enriched.length : counts[s]})
            </button>
          );
        })}

        <div style={{ width: 1, background: '#e2e8f0', alignSelf: 'stretch' }} />

        {[
          { key: 'date-asc',  label: '📅 Date ↑' },
          { key: 'date-desc', label: '📅 Date ↓' },
          { key: 'alpha',     label: '🔤 A → Z' },
          { key: 'owner',     label: '👤 Owner' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setSortBy(key)}
            style={{ padding: '0.375rem 0.875rem', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, border: `1.5px solid ${sortBy === key ? '#0f2044' : '#e2e8f0'}`, cursor: 'pointer', transition: 'all 0.15s',
              background: sortBy === key ? '#0f2044' : 'white',
              color: sortBy === key ? '#fff' : '#64748b' }}>
            {label}
          </button>
        ))}

        <div style={{ width: 1, background: '#e2e8f0', alignSelf: 'stretch' }} />

        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
          style={{ padding: '0.35rem 0.75rem', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, border: '1.5px solid #e2e8f0', background: ownerFilter !== 'All' ? '#eff6ff' : 'white', color: ownerFilter !== 'All' ? '#1d4ed8' : '#64748b', cursor: 'pointer', outline: 'none' }}>
          {owners.map(o => <option key={o}>{o === 'All' ? '👤 All Owners' : o}</option>)}
        </select>

        {(filter !== 'All' || ownerFilter !== 'All') && (
          <button onClick={() => { setFilter('All'); setOwnerFilter('All'); }}
            style={{ padding: '0.35rem 0.875rem', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 700, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}>
            ✕ Clear filters · {filtered.length} shown
          </button>
        )}
      </div>

      {/* Board items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(item => {
          const { st } = item;
          const activeDue = item.recommitmentDate || item.dueDate;
          const inlineDate = inlineDates[item.id] || '';
          const inlineSt = inlineDate ? computeStatus(inlineDate, null) : null;
          const isConfirmingClose = closingId === item.id;
          const recommitCount = item.recommitmentCount || 0;
          return (
            <div key={item.id} className="card" style={{ padding: '1rem 1.25rem', borderLeft: `4px solid ${st.color}`, background: st.overdue ? '#fff8f8' : 'white' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.9375rem' }}>{item.title}</h4>
                    <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 800, background: st.bg, color: st.text, border: `1px solid ${st.border}` }}>
                      {st.label === 'Red' ? '🔴' : st.label === 'Yellow' ? '🟡' : '🟢'} {st.label}
                      {st.daysLeft !== null && st.daysLeft < 0 && ` · ${Math.abs(st.daysLeft)}d overdue`}
                      {st.daysLeft !== null && st.daysLeft >= 0 && ` · ${st.daysLeft}d left`}
                    </span>
                    {recommitCount > 0 && (
                      <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: '0.65rem', fontWeight: 700, background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' }}>
                        🔄 {recommitCount} recommitment{recommitCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {item.notes && <p style={{ color: 'var(--text-secondary)', fontSize: '0.8375rem', margin: '0 0 6px', lineHeight: 1.5 }}>{item.notes}</p>}
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>👤 {item.owner}</span>
                    {activeDue && <span>📅 Due: {new Date(activeDue + 'T00:00:00').toLocaleDateString()}</span>}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                  {!isConfirmingClose && (
                    <button onClick={() => { setClosingId(item.id); setEditingId(null); }} title="Mark as closed"
                      style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 7, color: '#0d9488', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✅ Close
                    </button>
                  )}
                  <button onClick={() => { startEdit(item); setClosingId(null); }} title="Edit"
                    style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, color: '#64748b', cursor: 'pointer', fontSize: '0.8rem', padding: '3px 8px', lineHeight: 1 }}>✏️</button>
                  <button onClick={() => handleDelete(item.id)} title="Delete"
                    style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0 4px' }}>×</button>
                </div>
              </div>

              {/* Close confirmation inline */}
              {isConfirmingClose && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '2px dashed #0d9488', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#f0fdfa', borderRadius: '0 0 10px 10px', margin: '12px -1.25rem -1rem', padding: '0.75rem 1.25rem 1rem' }}>
                  <span style={{ fontSize: '1rem' }}>✅</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0d9488', margin: 0 }}>
                      Mark this action as closed?
                    </p>
                    <p style={{ fontSize: '0.72rem', color: '#0d9488', margin: '2px 0 0' }}>
                      {recommitCount === 0 && !computeStatus(item.dueDate, item.recommitmentDate).overdue
                        ? '+5 pts will be added (on time, no recommitments)'
                        : recommitCount > 0
                          ? 'No points — action had recommitments'
                          : 'No points — action is past due'}
                    </p>
                  </div>
                  <button onClick={() => handleClose(item)}
                    style={{ padding: '0.4rem 1.1rem', borderRadius: 8, background: '#0d9488', color: 'white', fontWeight: 800, fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}>
                    Yes, Close
                  </button>
                  <button onClick={() => setClosingId(null)}
                    style={{ padding: '0.4rem 0.875rem', borderRadius: 8, background: 'white', color: '#64748b', fontWeight: 700, fontSize: '0.8rem', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              )}

              {/* Inline edit form */}
              {editingId === item.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div><label className="label">Title / Action</label><input className="input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></div>
                    <div><label className="label">Owner</label><input className="input" value={editForm.owner} onChange={e => setEditForm(f => ({ ...f, owner: e.target.value }))} /></div>
                    <div><label className="label">Due Date</label><input className="input" type="date" value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
                    <div style={{ gridColumn: '1/-1' }}><label className="label">Notes</label><textarea className="input" rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }} onClick={() => handleEditSave(item.id)}>Save Changes</button>
                    <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Inline recommitment row — only for red items */}
              {st.overdue && !isConfirmingClose && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #fca5a5', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626' }}>📅 Recommit to:</span>
                  <input
                    type="date"
                    value={inlineDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setInlineDates(d => ({ ...d, [item.id]: e.target.value }))}
                    style={{ padding: '0.25rem 0.5rem', borderRadius: 8, border: `1.5px solid ${inlineSt ? inlineSt.border : '#fca5a5'}`, fontSize: '0.8rem', outline: 'none' }}
                  />
                  {inlineDate && inlineSt && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: inlineSt.text }}>
                      {inlineSt.label === 'Green' ? '🟢' : inlineSt.label === 'Yellow' ? '🟡' : '🔴'} {inlineSt.label}
                    </span>
                  )}
                  <button
                    disabled={!inlineDate || (inlineSt && inlineSt.overdue)}
                    onClick={() => {
                      handleRecommit(item.id, inlineDate, item);
                      setInlineDates(d => ({ ...d, [item.id]: '' }));
                    }}
                    style={{
                      padding: '0.25rem 0.875rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: (!inlineDate || (inlineSt && inlineSt.overdue)) ? 'not-allowed' : 'pointer',
                      background: (!inlineDate || (inlineSt && inlineSt.overdue)) ? '#e2e8f0' : '#0f2044',
                      color: (!inlineDate || (inlineSt && inlineSt.overdue)) ? '#94a3b8' : 'white',
                    }}>
                    ✓ Commit
                  </button>
                  {inlineSt?.overdue && <span style={{ fontSize: '0.68rem', color: '#ef4444' }}>Date must be today or later</span>}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {activeItems.length === 0 ? 'No open actions — click "+ Add Action" to get started' : 'No items for this filter'}
          </div>
        )}
      </div>
    </div>
  );
}
