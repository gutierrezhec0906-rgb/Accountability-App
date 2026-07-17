import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const REFRESH_INTERVAL = 60; // seconds

function computeStatus(dueDate, recommitmentDate) {
  const active = recommitmentDate || dueDate;
  if (!active) return { label: 'Green', color: '#22c55e', bg: '#dcfce7', text: '#15803d', overdue: false, daysLeft: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(active + 'T00:00:00');
  const days  = Math.round((due - today) / 86400000);
  if (days < 0)  return { label: 'Red',    color: '#ef4444', bg: '#fee2e2', text: '#dc2626', overdue: true,  daysLeft: days };
  if (days <= 5) return { label: 'Yellow', color: '#eab308', bg: '#fef9c3', text: '#b45309', overdue: false, daysLeft: days };
  return           { label: 'Green',  color: '#22c55e', bg: '#dcfce7', text: '#15803d', overdue: false, daysLeft: days };
}

export default function TeamBoard() {
  const { userProfile } = useAuth();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [filterStatus, setFilterStatus] = useState('All');

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

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1)), 1000);
    return () => clearInterval(tick);
  }, [lastRefresh]);

  const enriched = actions.map(a => ({ ...a, st: computeStatus(a.dueDate, a.recommitmentDate) }));
  const counts = { Green: 0, Yellow: 0, Red: 0 };
  enriched.forEach(a => { if (counts[a.st.label] !== undefined) counts[a.st.label]++; });
  const filtered = filterStatus === 'All' ? enriched : enriched.filter(a => a.st.label === filterStatus);

  const statusBar = [
    { label: 'All',    count: enriched.length, color: '#93c5fd', bg: 'rgba(147,197,253,0.15)' },
    { label: 'Red',    count: counts.Red,       color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
    { label: 'Yellow', count: counts.Yellow,    color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  },
    { label: 'Green',  count: counts.Green,     color: '#4ade80', bg: 'rgba(74,222,128,0.15)'  },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0b1120', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ background: '#0f2044', borderBottom: '2px solid #1e3a6e', padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0, boxShadow: '0 0 16px #ef444466' }}>📋</div>
          <div>
            <h1 style={{ margin: 0, color: 'white', fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
              Team Action Tracker
            </h1>
            {userProfile?.companyName && (
              <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', fontWeight: 500 }}>
                {userProfile.companyName}
              </p>
            )}
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8 }}>
          {statusBar.map(s => (
            <button key={s.label} onClick={() => setFilterStatus(s.label)} style={{
              padding: '6px 18px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 800,
              border: `1.5px solid ${filterStatus === s.label ? s.color : 'rgba(255,255,255,0.1)'}`,
              background: filterStatus === s.label ? s.bg : 'transparent',
              color: filterStatus === s.label ? s.color : 'rgba(255,255,255,0.5)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {s.label}&nbsp;<span style={{ fontWeight: 900 }}>{s.count}</span>
            </button>
          ))}
        </div>

        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>
              Live · {countdown}s
            </span>
          </div>
          <button onClick={fetchAll} style={{
            padding: '5px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)',
            fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700,
          }}>
            ↻ Refresh
          </button>
          {lastRefresh && (
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem' }}>
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* ── Row list ── */}
      <div style={{ flex: 1, padding: '16px 24px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }}>Loading team actions…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }}>No open actions for this filter.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((item, idx) => {
              const { st } = item;
              const activeDue = item.recommitmentDate || item.dueDate;
              const recommitCount = item.recommitmentCount || 0;
              const dueLabel = activeDue
                ? new Date(activeDue + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
              const daysLabel = st.daysLeft === null ? '' : st.daysLeft < 0
                ? `${Math.abs(st.daysLeft)}d overdue`
                : `${st.daysLeft}d left`;

              return (
                <div key={item.id + item.ownerName + idx} style={{
                  background: '#1a2640',
                  border: `1px solid ${st.color}30`,
                  borderLeft: `5px solid ${st.color}`,
                  borderRadius: 12,
                  padding: '14px 20px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '8px 20px',
                  alignItems: 'start',
                }}>
                  {/* Left: title + meta */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    {/* Action title */}
                    <p style={{
                      margin: 0, fontWeight: 800, fontSize: '1rem', color: 'white',
                      lineHeight: 1.35,
                      wordBreak: 'break-word',
                    }}>
                      {item.title}
                    </p>

                    {/* Owner + due + recommitments row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'center' }}>
                      {/* Owner */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', fontWeight: 900, color: 'white', flexShrink: 0,
                        }}>
                          {item.ownerName.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#93c5fd' }}>
                          {item.ownerName}
                        </span>
                      </div>

                      {/* Due date */}
                      {activeDue && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: '0.78rem' }}>📅</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: st.overdue ? '#fca5a5' : 'rgba(255,255,255,0.55)' }}>
                            {dueLabel}
                          </span>
                        </div>
                      )}

                      {/* Recommitments */}
                      {recommitCount > 0 && (
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa',
                          background: 'rgba(96,165,250,0.12)', padding: '2px 10px', borderRadius: 9999,
                        }}>
                          🔄 {recommitCount} recommit{recommitCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {item.notes && (
                      <p style={{
                        margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)',
                        lineHeight: 1.5, wordBreak: 'break-word',
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Right: status badge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 14px', borderRadius: 9999,
                      fontSize: '0.8rem', fontWeight: 900,
                      background: st.bg, color: st.text,
                      whiteSpace: 'nowrap',
                    }}>
                      {st.label === 'Red' ? '🔴' : st.label === 'Yellow' ? '🟡' : '🟢'}
                      {daysLabel && <span>{daysLabel}</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ background: '#0f2044', borderTop: '2px solid #1e3a6e', padding: '10px 32px', display: 'flex', gap: 32, alignItems: 'center', flexShrink: 0 }}>
        {[
          { label: 'Total Open', value: enriched.length, color: 'white' },
          { label: 'Past Due', value: counts.Red,    color: '#f87171', icon: '🔴' },
          { label: 'Due Soon',  value: counts.Yellow, color: '#fbbf24', icon: '🟡' },
          { label: 'On Track',  value: counts.Green,  color: '#4ade80', icon: '🟢' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {s.icon && <span style={{ fontSize: '0.9rem' }}>{s.icon}</span>}
            <span style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.04em' }}>
          {userProfile?.companyName} · Auto-refresh every {REFRESH_INTERVAL}s
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>
    </div>
  );
}
