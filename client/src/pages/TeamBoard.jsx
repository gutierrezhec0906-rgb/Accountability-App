import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const REFRESH_INTERVAL = 60; // seconds

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

export default function TeamBoard() {
  const { userProfile } = useAuth();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [filterStatus, setFilterStatus] = useState('All'); // All | Green | Yellow | Red

  const fetchAll = useCallback(async () => {
    const companyId = userProfile?.companyId;
    if (!companyId) return;
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('companyId', '==', companyId)));
      const all = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const name = data.displayName || data.email || 'Unknown';
        (data.visualBoard || []).forEach(item => {
          if (!item.closed) all.push({ ...item, ownerName: name });
        });
      });
      // Sort: Red first, then Yellow, then Green; within each group by due date asc
      const order = { Red: 0, Yellow: 1, Green: 2 };
      all.sort((a, b) => {
        const sa = computeStatus(a.dueDate, a.recommitmentDate);
        const sb = computeStatus(b.dueDate, b.recommitmentDate);
        if (order[sa.label] !== order[sb.label]) return order[sa.label] - order[sb.label];
        return (a.dueDate || '') < (b.dueDate || '') ? -1 : 1;
      });
      setActions(all);
      setLastRefresh(new Date());
      setCountdown(REFRESH_INTERVAL);
    } catch (e) {
      console.error('Team board fetch error', e);
    }
    setLoading(false);
  }, [userProfile?.companyId]);

  // Initial load + auto-refresh
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1)), 1000);
    return () => clearInterval(tick);
  }, [lastRefresh]);

  const enriched = actions.map(a => ({ ...a, st: computeStatus(a.dueDate, a.recommitmentDate) }));
  const counts = { Green: 0, Yellow: 0, Red: 0 };
  enriched.forEach(a => { if (counts[a.st.label] !== undefined) counts[a.st.label]++; });

  const filtered = filterStatus === 'All' ? enriched : enriched.filter(a => a.st.label === filterStatus);

  const statusBar = [
    { label: 'All',    count: enriched.length, color: '#0f2044', bg: '#e8edf5' },
    { label: 'Red',    count: counts.Red,       color: '#ef4444', bg: '#fee2e2' },
    { label: 'Yellow', count: counts.Yellow,    color: '#d97706', bg: '#fef9c3' },
    { label: 'Green',  count: counts.Green,     color: '#16a34a', bg: '#dcfce7' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ background: '#0f2044', borderBottom: '1px solid #1e3a6e', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🔴</div>
          <div>
            <h1 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
              Team Action Tracker
              {userProfile?.companyName && <span style={{ fontWeight: 400, opacity: 0.6, fontSize: '0.85rem', marginLeft: 8 }}>— {userProfile.companyName}</span>}
            </h1>
          </div>
        </div>

        {/* Summary counts */}
        <div style={{ display: 'flex', gap: 8 }}>
          {statusBar.map(s => (
            <button key={s.label} onClick={() => setFilterStatus(s.label)}
              style={{ padding: '4px 14px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 800, border: `1.5px solid ${filterStatus === s.label ? s.color : 'transparent'}`, background: filterStatus === s.label ? s.bg : 'rgba(255,255,255,0.08)', color: filterStatus === s.label ? s.color : 'rgba(255,255,255,0.7)', cursor: 'pointer', transition: 'all 0.15s' }}>
              {s.label} {s.count}
            </button>
          ))}
        </div>

        {/* Refresh indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite' }} />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem' }}>
            Live · refreshes in {countdown}s
          </span>
          <button onClick={fetchAll} style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', fontSize: '0.68rem', cursor: 'pointer', fontWeight: 600 }}>
            ↻ Now
          </button>
        </div>

        {/* Last refresh */}
        {lastRefresh && (
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', flexShrink: 0 }}>
            {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* ── Board ── */}
      <div style={{ flex: 1, padding: '12px 20px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Loading team actions…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>No open actions for this filter.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
            {filtered.map(item => {
              const { st } = item;
              const activeDue = item.recommitmentDate || item.dueDate;
              const recommitCount = item.recommitmentCount || 0;
              return (
                <div key={item.id + item.ownerName} style={{
                  background: '#1e293b',
                  border: `1.5px solid ${st.color}40`,
                  borderLeft: `4px solid ${st.color}`,
                  borderRadius: 10,
                  padding: '9px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                }}>
                  {/* Title + status badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                    <p style={{ fontWeight: 800, fontSize: '0.82rem', color: 'white', margin: 0, lineHeight: 1.3, flex: 1 }}>{item.title}</p>
                    <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: '0.62rem', fontWeight: 800, background: st.bg, color: st.text, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {st.label === 'Red' ? '🔴' : st.label === 'Yellow' ? '🟡' : '🟢'}{' '}
                      {st.daysLeft !== null && st.daysLeft < 0 && `${Math.abs(st.daysLeft)}d overdue`}
                      {st.daysLeft !== null && st.daysLeft >= 0 && `${st.daysLeft}d left`}
                    </span>
                  </div>

                  {/* Owner + due + recommitments */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ opacity: 0.7 }}>👤</span> {item.ownerName}
                    </span>
                    {activeDue && (
                      <span style={{ fontSize: '0.68rem', color: st.overdue ? '#fca5a5' : 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ opacity: 0.7 }}>📅</span> {new Date(activeDue + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                    {recommitCount > 0 && (
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#60a5fa', background: 'rgba(96,165,250,0.12)', padding: '1px 7px', borderRadius: 9999 }}>
                        🔄 {recommitCount}×
                      </span>
                    )}
                  </div>

                  {/* Notes — first line only */}
                  {item.notes && (
                    <p style={{ margin: 0, fontSize: '0.67rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                      {item.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer stats bar ── */}
      <div style={{ background: '#0f2044', borderTop: '1px solid #1e3a6e', padding: '7px 24px', display: 'flex', gap: 24, alignItems: 'center', flexShrink: 0 }}>
        {[
          { label: 'Total Open', value: enriched.length, color: 'white' },
          { label: 'Past Due 🔴', value: counts.Red, color: '#f87171' },
          { label: 'Due Soon 🟡', value: counts.Yellow, color: '#fbbf24' },
          { label: 'On Track 🟢', value: counts.Green, color: '#4ade80' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
          {userProfile?.companyName} · Team Action Tracker · Auto-refresh every {REFRESH_INTERVAL}s
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
