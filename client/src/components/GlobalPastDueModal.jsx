import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

// Same status logic as the Visual Management board.
function computeStatus(dueDate, recommitmentDate) {
  const active = recommitmentDate || dueDate;
  if (!active) return { overdue: false, daysLeft: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(active + 'T00:00:00');
  const days = Math.round((due - today) / 86400000);
  return { overdue: days < 0, daysLeft: days };
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Session-start reminder shown on EVERY module: lists every past-due action on the
// user's Accountability Board and asks for a new commitment date per action —
// the same recommitment flow as the board itself. Fires once per browser session.
export default function GlobalPastDueModal() {
  const { currentUser } = useAuth();
  const [board, setBoard] = useState([]);       // full visualBoard array
  const [pending, setPending] = useState([]);   // past-due items still to handle
  const [dates, setDates] = useState({});       // { [id]: 'YYYY-MM-DD' }
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    if (sessionStorage.getItem('pastDueReminderShown')) return;
    sessionStorage.setItem('pastDueReminderShown', '1');
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        const all = snap.exists() ? (snap.data().visualBoard || []) : [];
        const overdue = all.filter(i => !i.closed && computeStatus(i.dueDate, i.recommitmentDate).overdue);
        if (overdue.length) { setBoard(all); setPending(overdue); setOpen(true); }
      } catch { /* ignore */ }
    })();
  }, [currentUser]);

  async function recommit(item) {
    const newDate = dates[item.id];
    if (!newDate || newDate < todayStr()) return;
    setSaving(item.id);
    // Mirror the board's handleRecommit: set the new date, bump the count, and
    // reset deductionApplied so a future miss re-triggers the penalty.
    const updated = board.map(i => i.id === item.id
      ? { ...i, recommitmentDate: newDate, recommitmentCount: (i.recommitmentCount || 0) + 1, recommitmentSetAt: { seconds: Math.floor(Date.now() / 1000) }, deductionApplied: false }
      : i);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { visualBoard: updated }, { merge: true });
      setBoard(updated);
      const remaining = pending.filter(i => i.id !== item.id);
      setPending(remaining);
      if (!remaining.length) setOpen(false);
    } catch { /* ignore */ }
    setSaving(null);
  }

  if (!open || !pending.length) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: '1rem' }}>
      <style>{`
        .pastdue-scroll::-webkit-scrollbar { width: 8px; -webkit-appearance: none; }
        .pastdue-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 8px; }
        .pastdue-scroll::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 8px; }
      `}</style>
      <div style={{ background: 'white', borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', flexShrink: 0 }}>🔴</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 900, color: '#b91c1c', margin: 0, fontSize: '1.02rem' }}>
              {pending.length} Past-Due Action{pending.length > 1 ? 's' : ''} — Recommitment Needed
            </p>
            <p style={{ fontSize: '0.76rem', color: '#7f1d1d', margin: '2px 0 0', lineHeight: 1.4 }}>
              Set a new commitment date for each to keep it active and protect your accountability.
            </p>
          </div>
        </div>

        {/* Scrollable list of past-due actions, each with full detail + date picker */}
        <div className="pastdue-scroll" style={{ padding: '1rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pending.map(item => {
            const st = computeStatus(item.dueDate, item.recommitmentDate);
            const original = item.recommitmentDate || item.dueDate;
            const dateVal = dates[item.id] || '';
            const valid = dateVal && dateVal >= todayStr();
            return (
              <div key={item.id} style={{ border: '1px solid #fecaca', borderLeft: '4px solid #ef4444', borderRadius: 10, padding: '0.875rem 1rem', background: '#fff8f8', flexShrink: 0 }}>
                <p style={{ fontWeight: 800, color: '#1e293b', margin: '0 0 4px', fontSize: '0.92rem' }}>{item.title || 'Untitled action'}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: '0.74rem', color: '#64748b', marginBottom: 6 }}>
                  {item.owner && <span>👤 {item.owner}</span>}
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>🚨 {Math.abs(st.daysLeft)}d overdue</span>
                  <span>📅 was due {new Date(original + 'T00:00:00').toLocaleDateString()}</span>
                  {item.recommitmentCount > 0 && <span style={{ color: '#b45309', fontWeight: 700 }}>🔄 {item.recommitmentCount} prior recommit{item.recommitmentCount > 1 ? 's' : ''}</span>}
                </div>
                {item.notes && <p style={{ fontSize: '0.76rem', color: '#475569', margin: '0 0 8px', lineHeight: 1.45 }}>{item.notes}</p>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="date" min={todayStr()} value={dateVal}
                    onChange={e => setDates(d => ({ ...d, [item.id]: e.target.value }))}
                    style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '2px solid #e2e8f0', fontSize: '0.82rem' }} />
                  <button onClick={() => recommit(item)} disabled={!valid || saving === item.id}
                    style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: '0.8rem',
                      cursor: valid && saving !== item.id ? 'pointer' : 'not-allowed',
                      background: valid && saving !== item.id ? '#0f2044' : '#e2e8f0',
                      color: valid && saving !== item.id ? 'white' : '#94a3b8' }}>
                    {saving === item.id ? 'Saving…' : '✓ Recommit'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>You can also manage these on the Accountability Board.</span>
          <button onClick={() => setOpen(false)}
            style={{ padding: '0.5rem 1.1rem', borderRadius: 8, background: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', border: '1px solid #e2e8f0', cursor: 'pointer', flexShrink: 0 }}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
