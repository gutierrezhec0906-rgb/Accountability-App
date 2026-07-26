import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

// Career milestone check-in windows (anchored to careerPlan.completedAt).
const CAREER_CHECKINS = [
  { key: 'd30', label: '30-Day Progress Note', days: 30 },
  { key: 'd90', label: '90-Day Progress Note', days: 90 },
  { key: 'm6',  label: '6-Month Progress Note', days: 180 },
  { key: 'm12', label: '12-Month Completion / Renewal Note', days: 365 },
];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
function overdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') < today;
}
function daysOverdue(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.abs(Math.round((new Date(dateStr + 'T00:00:00') - today) / 86400000));
}

// Section metadata: which user-doc array each source lives in, plus labels.
const SECTIONS = [
  { kind: 'board',    field: 'visualBoard', label: 'Accountability Board', icon: '🔴' },
  { kind: 'training', field: 'trainings',   label: 'Training Center',      icon: '🎓' },
  { kind: 'goal',     field: 'smartGoals',  label: 'SMART Goals',          icon: '🎯' },
  { kind: 'career',   field: null,          label: 'Career Development',   icon: '🚀' },
];

// Session-start reminder shown on EVERY module: lists every past-due activity across
// the deadline-bearing modules (Accountability Board actions, trainings, SMART goals)
// and asks for a new commitment date per item. Fires once per browser session.
export default function GlobalPastDueModal() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState({});        // { visualBoard, trainings, smartGoals }
  const [pending, setPending] = useState([]);  // unified past-due items
  const [dates, setDates] = useState({});       // { [key]: 'YYYY-MM-DD' }
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(null);

  // Re-check whenever the user navigates to a new module, and keep reminding on
  // every module open until EVERY past-due item has been recommitted. "Later"
  // only closes the current popup — it reappears on the next navigation.
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        const d = snap.exists() ? snap.data() : {};
        setData({ visualBoard: d.visualBoard || [], trainings: d.trainings || [], smartGoals: d.smartGoals || [] });
        const items = [];
        (d.visualBoard || []).forEach(i => {
          const due = i.recommitmentDate || i.dueDate;
          if (!i.closed && overdue(due)) items.push({ key: `board-${i.id}`, kind: 'board', id: i.id, title: i.title || 'Untitled action', sub: i.owner, due, notes: i.notes, recommits: i.recommitmentCount });
        });
        (d.trainings || []).forEach(t => {
          if (!t.completed && overdue(t.dueDate)) items.push({ key: `training-${t.id}`, kind: 'training', id: t.id, title: t.title || 'Untitled training', sub: t.category, due: t.dueDate });
        });
        (d.smartGoals || []).forEach(g => {
          if (g && g.status !== 'completed' && g.status !== 'deleted' && overdue(g.dueDate)) items.push({ key: `goal-${g.id}`, kind: 'goal', id: g.id, title: g.title || 'Untitled goal', due: g.dueDate });
        });
        // Career milestone check-ins that are past due with no progress note logged.
        const cp = d.careerPlan;
        if (cp && cp.completedAt) {
          const anchor = new Date(cp.completedAt).getTime();
          CAREER_CHECKINS.forEach(ck => {
            const dueMs = anchor + ck.days * 86400000;
            const noteFilled = ((cp.checkIns && cp.checkIns[ck.key] && cp.checkIns[ck.key].note) || '').trim().length > 0;
            const dueStr = new Date(dueMs).toISOString().split('T')[0];
            if (!noteFilled && overdue(dueStr)) {
              items.push({ key: `career-${ck.key}`, kind: 'career', id: ck.key, title: ck.label, due: dueStr });
            }
          });
        }
        setPending(items);
        if (items.length) setOpen(true);
      } catch { /* ignore */ }
    })();
  }, [currentUser, location.pathname]);

  async function recommit(item) {
    const newDate = dates[item.key];
    if (!newDate || newDate < todayStr()) return;
    const sec = SECTIONS.find(s => s.kind === item.kind);
    setSaving(item.key);
    try {
      const arr = data[sec.field] || [];
      const updated = arr.map(row => {
        if (row.id !== item.id) return row;
        if (item.kind === 'board') {
          // Mirror the board's recommit: new date, bump count, reset deduction flag.
          return { ...row, recommitmentDate: newDate, recommitmentCount: (row.recommitmentCount || 0) + 1, recommitmentSetAt: { seconds: Math.floor(Date.now() / 1000) }, deductionApplied: false };
        }
        // Trainings & goals: recommitting means a new due date.
        return { ...row, dueDate: newDate };
      });
      await setDoc(doc(db, 'users', currentUser.uid), { [sec.field]: updated }, { merge: true });
      setData(d => ({ ...d, [sec.field]: updated }));
      const remaining = pending.filter(p => p.key !== item.key);
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
      <div style={{ background: 'white', borderRadius: 18, width: '100%', maxWidth: 540, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', flexShrink: 0 }}>🚨</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 900, color: '#b91c1c', margin: 0, fontSize: '1.02rem' }}>
              {pending.length} Past-Due Activit{pending.length > 1 ? 'ies' : 'y'} — Recommitment Needed
            </p>
            <p style={{ fontSize: '0.76rem', color: '#7f1d1d', margin: '2px 0 0', lineHeight: 1.4 }}>
              Set a new commitment date for each to keep it active and protect your accountability.
            </p>
          </div>
        </div>

        {/* Scrollable list, grouped by section */}
        <div className="pastdue-scroll" style={{ padding: '0.75rem 1.25rem 1rem', overflowY: 'auto' }}>
          {SECTIONS.map(sec => {
            const rows = pending.filter(p => p.kind === sec.kind);
            if (!rows.length) return null;
            return (
              <div key={sec.kind} style={{ marginTop: 10 }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '6px 0 8px' }}>
                  {sec.icon} {sec.label} · {rows.length}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {rows.map(item => {
                    const dateVal = dates[item.key] || '';
                    const valid = dateVal && dateVal >= todayStr();
                    return (
                      <div key={item.key} style={{ border: '1px solid #fecaca', borderLeft: '4px solid #ef4444', borderRadius: 10, padding: '0.75rem 0.9rem', background: '#fff8f8' }}>
                        <p style={{ fontWeight: 800, color: '#1e293b', margin: '0 0 4px', fontSize: '0.9rem' }}>{item.title}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: '0.73rem', color: '#64748b', marginBottom: 6 }}>
                          {item.sub && <span>{item.kind === 'training' ? '🏷️' : '👤'} {item.sub}</span>}
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>🚨 {daysOverdue(item.due)}d overdue</span>
                          <span>📅 was due {new Date(item.due + 'T00:00:00').toLocaleDateString()}</span>
                          {item.recommits > 0 && <span style={{ color: '#b45309', fontWeight: 700 }}>🔄 {item.recommits} prior</span>}
                        </div>
                        {item.notes && <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0 0 8px', lineHeight: 1.45 }}>{item.notes}</p>}
                        {item.kind === 'career' ? (
                          <button onClick={() => { setOpen(false); navigate('/career'); }}
                            style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', background: '#0f2044', color: 'white' }}>
                            📝 Add Progress Note →
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input type="date" min={todayStr()} value={dateVal}
                              onChange={e => setDates(d => ({ ...d, [item.key]: e.target.value }))}
                              style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '2px solid #e2e8f0', fontSize: '0.82rem' }} />
                            <button onClick={() => recommit(item)} disabled={!valid || saving === item.key}
                              style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: '0.8rem',
                                cursor: valid && saving !== item.key ? 'pointer' : 'not-allowed',
                                background: valid && saving !== item.key ? '#0f2044' : '#e2e8f0',
                                color: valid && saving !== item.key ? 'white' : '#94a3b8' }}>
                              {saving === item.key ? 'Saving…' : '✓ Recommit'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>This reminder keeps appearing until every item is recommitted.</span>
          <button onClick={() => setOpen(false)}
            style={{ padding: '0.5rem 1.1rem', borderRadius: 8, background: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', border: '1px solid #e2e8f0', cursor: 'pointer', flexShrink: 0 }}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
