import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logPointEvent } from '../utils/scoring';

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
            <strong>5 points will be deducted</strong> from your accountability score if you close this without setting a new commitment date.
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
            style={{ padding: '0.65rem 1rem', borderRadius: 10, background: '#fef2f2', color: '#ef4444', fontWeight: 700, fontSize: '0.875rem', border: '1px solid #fca5a5', cursor: 'pointer' }}>
            Close (−5 pts)
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

  async function fetchItems() {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      const entries = snap.exists() ? (snap.data().visualBoard || []) : [];
      entries.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(entries);

      // Fire recommitment modal for first past-due item not yet deducted
      const overdue = entries.find(e => {
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
        recommitmentDate: null,
        deductionApplied: false,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
      };
      await persist([newItem, ...items]);

      // Award +1 if user arrived from Problem Solving Quick Action within 5 min
      const qaTs = localStorage.getItem('ps_quick_action_ts');
      if (qaTs && Date.now() - parseInt(qaTs, 10) < 5 * 60 * 1000) {
        localStorage.removeItem('ps_quick_action_ts');
        await logPointEvent(currentUser.uid, {
          points: 1,
          toolLabel: 'Quick Action',
          reason: 'Created a board action within 5 min of Problem Solving Quick Action',
        });
        toast.success('+1 point — action logged within 5 minutes! 🏆');
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

  async function handleDelete(id) {
    try {
      await persist(items.filter(i => i.id !== id));
    } catch (e) {
      toast.error('Delete failed: ' + e?.message);
    }
  }

  async function handleRecommit(id, newDate, item) {
    // newDate must not be past due
    const st = computeStatus(newDate, null);
    if (st.overdue) return toast.error('Recommitment date must be today or in the future');
    try {
      const wasDeducted = item?.deductionApplied && item?.recommitmentDate == null;
      const updatedItem = {
        ...item,
        recommitmentDate: newDate,
        recommitmentSetAt: { seconds: Math.floor(Date.now() / 1000) },
        deductionApplied: true,
        pointsRestored: wasDeducted ? true : (item?.pointsRestored || false),
      };
      await persist(items.map(i => i.id === id ? updatedItem : i));
      // Restore 5 points if they were previously deducted (dismissed modal)
      if (wasDeducted && !item?.pointsRestored) {
        await updateDoc(doc(db, 'users', currentUser.uid), { penaltyPoints: increment(-5) });
        await logPointEvent(currentUser.uid, {
          points: +5,
          tool: 'Visual Board',
          toolLabel: 'Visual Management Board',
          reason: `Recommitted to action: "${item.title}" — 5 points restored`,
        });
        toast.success('+5 points restored for recommitting!');
      } else {
        toast.success('New commitment date set!');
      }
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
        tool: 'Visual Board',
        toolLabel: 'Visual Management Board',
        reason: `Missed recommitment deadline for action: "${modalEntry.title}"`,
      });
      toast.error('−5 points deducted for missed recommitment');
      setModalEntry(null);
    } catch (e) {
      console.error(e);
      setModalEntry(null);
    }
  }

  // Compute status on the fly for each item
  const enriched = items.map(item => ({ ...item, st: computeStatus(item.dueDate, item.recommitmentDate) }));
  const counts = { Green: 0, Yellow: 0, Red: 0 };
  enriched.forEach(i => { if (counts[i.st.label] !== undefined) counts[i.st.label]++; });
  const filtered = filter === 'All' ? enriched : enriched.filter(i => i.st.label === filter);

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
      </div>

      {/* Status summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
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

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
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
      </div>

      {/* Board items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(item => {
          const { st } = item;
          const activeDue = item.recommitmentDate || item.dueDate;
          const inlineDate = inlineDates[item.id] || '';
          const inlineSt = inlineDate ? computeStatus(inlineDate, null) : null;
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
                    {item.recommitmentDate && !st.overdue && (
                      <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: '0.65rem', fontWeight: 700, background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' }}>
                        🔄 Recommitted
                      </span>
                    )}
                  </div>
                  {item.notes && <p style={{ color: 'var(--text-secondary)', fontSize: '0.8375rem', margin: '0 0 6px', lineHeight: 1.5 }}>{item.notes}</p>}
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>👤 {item.owner}</span>
                    {activeDue && <span>📅 Due: {new Date(activeDue + 'T00:00:00').toLocaleDateString()}</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(item.id)}
                  style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>×</button>
              </div>

              {/* Inline recommitment row — only for red items */}
              {st.overdue && (
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
                    {item.deductionApplied && !item.pointsRestored ? ' (+5 pts)' : ''}
                  </button>
                  {inlineSt?.overdue && <span style={{ fontSize: '0.68rem', color: '#ef4444' }}>Date must be today or later</span>}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {items.length === 0 ? 'No actions yet — click "+ Add Action" to get started' : 'No items for this filter'}
          </div>
        )}
      </div>
    </div>
  );
}
