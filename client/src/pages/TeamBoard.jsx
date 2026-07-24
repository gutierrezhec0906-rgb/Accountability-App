import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const REFRESH_INTERVAL = 60;

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

const SELECT_STYLE = {
  padding: '5px 10px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
  border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.75)', cursor: 'pointer', outline: 'none',
};

export default function TeamBoard() {
  const { userProfile } = useAuth();
  const [actions, setActions]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown]   = useState(REFRESH_INTERVAL);

  // Filters
  const [filterStatus,  setFilterStatus]  = useState('All');
  const [sortBy,        setSortBy]        = useState('status');   // status | date-asc | date-desc | alpha | creator | responsible
  const [creatorFilter, setCreatorFilter] = useState('All');
  const [respFilter,    setRespFilter]    = useState('All');

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
          if (!item.closed) all.push({ ...item, ownerName: name, ownerUid: docSnap.id });
        });
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

  // Leaders/managers/admins can remove any team action from the monitor. Actions
  // live in their CREATOR's user doc, so we delete from the owner's document —
  // this fixes the case where an action created by another teammate lingers here.
  const canManage = userProfile?.isAdmin || userProfile?.role === 'Leader' || userProfile?.role === 'Manager';
  async function deleteAction(item) {
    if (!window.confirm(`Delete "${item.title}" from ${item.ownerName}'s board? This removes it for everyone and cannot be undone.`)) return;
    try {
      const ref = doc(db, 'users', item.ownerUid);
      const snap = await getDoc(ref);
      const board = snap.exists() ? (snap.data().visualBoard || []) : [];
      await setDoc(ref, { visualBoard: board.filter(i => i.id !== item.id) }, { merge: true });
      setActions(prev => prev.filter(a => !(a.ownerUid === item.ownerUid && a.id === item.id)));
    } catch (e) {
      console.error('Delete failed', e);
      alert('Could not delete this action (check permissions): ' + (e?.message || e));
    }
  }

  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1)), 1000);
    return () => clearInterval(tick);
  }, [lastRefresh]);

  const enriched = actions.map(a => ({ ...a, st: computeStatus(a.dueDate, a.recommitmentDate) }));

  const counts = { Green: 0, Yellow: 0, Red: 0 };
  enriched.forEach(a => { if (counts[a.st.label] !== undefined) counts[a.st.label]++; });

  // Build dropdown options
  const creators     = ['All', ...Array.from(new Set(enriched.map(a => a.ownerName).filter(Boolean))).sort()];
  const responsibles = ['All', ...Array.from(new Set(enriched.map(a => (a.owner || '').trim()).filter(Boolean))).sort()];

  // Apply filters
  const statusOrder = { Red: 0, Yellow: 1, Green: 2 };
  const filtered = enriched
    .filter(a => filterStatus === 'All' || a.st.label === filterStatus)
    .filter(a => creatorFilter === 'All' || a.ownerName === creatorFilter)
    .filter(a => respFilter === 'All' || (a.owner || '').trim() === respFilter)
    .sort((a, b) => {
      if (sortBy === 'status')    return statusOrder[a.st.label] - statusOrder[b.st.label] || ((a.dueDate || '') < (b.dueDate || '') ? -1 : 1);
      if (sortBy === 'date-asc')  return (a.dueDate || '') < (b.dueDate || '') ? -1 : 1;
      if (sortBy === 'date-desc') return (a.dueDate || '') > (b.dueDate || '') ? -1 : 1;
      if (sortBy === 'alpha')     return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'creator')   return (a.ownerName || '').localeCompare(b.ownerName || '');
      if (sortBy === 'responsible') return (a.owner || '').localeCompare(b.owner || '');
      return 0;
    });

  const statusBar = [
    { label: 'All',    count: enriched.length, color: '#93c5fd', bg: 'rgba(147,197,253,0.15)' },
    { label: 'Red',    count: counts.Red,       color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
    { label: 'Yellow', count: counts.Yellow,    color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  },
    { label: 'Green',  count: counts.Green,     color: '#4ade80', bg: 'rgba(74,222,128,0.15)'  },
  ];

  const hasActiveFilter = filterStatus !== 'All' || creatorFilter !== 'All' || respFilter !== 'All' || sortBy !== 'status';

  function clearFilters() {
    setFilterStatus('All');
    setCreatorFilter('All');
    setRespFilter('All');
    setSortBy('status');
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#0b1120', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ background: '#0f2044', borderBottom: '1px solid #1e3a6e', padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>📋</div>
          <div>
            <h1 style={{ margin: 0, color: 'white', fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>Team Action Tracker</h1>
            {userProfile?.companyName && <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', fontWeight: 500 }}>{userProfile.companyName}</p>}
          </div>
        </div>

        {/* Status filter pills */}
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
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>Live · {countdown}s</span>
          </div>
          <button onClick={fetchAll} style={{ padding: '5px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}>
            ↻ Refresh
          </button>
          {lastRefresh && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem' }}>{lastRefresh.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* ── Filter / Sort toolbar ── */}
      <div style={{ background: '#0d1829', borderBottom: '1px solid #1e3a6e', padding: '8px 32px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>

        {/* Sort label */}
        <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.35)', marginRight: 2 }}>Sort</span>

        {/* Sort pills */}
        {[
          { key: 'status',      label: '🚦 Status' },
          { key: 'date-asc',    label: '📅 Date ↑' },
          { key: 'date-desc',   label: '📅 Date ↓' },
          { key: 'alpha',       label: '🔤 A → Z' },
          { key: 'creator',     label: '👤 Creator' },
          { key: 'responsible', label: '🎯 Responsible' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setSortBy(key)} style={{
            padding: '4px 12px', borderRadius: 9999, fontSize: '0.74rem', fontWeight: 700,
            border: `1.5px solid ${sortBy === key ? '#93c5fd' : 'rgba(255,255,255,0.1)'}`,
            background: sortBy === key ? 'rgba(147,197,253,0.15)' : 'transparent',
            color: sortBy === key ? '#93c5fd' : 'rgba(255,255,255,0.45)',
            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}>
            {label}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Creator dropdown */}
        <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.35)' }}>Creator</span>
        <select value={creatorFilter} onChange={e => setCreatorFilter(e.target.value)} style={{
          ...SELECT_STYLE,
          borderColor: creatorFilter !== 'All' ? '#a5b4fc' : 'rgba(255,255,255,0.12)',
          color: creatorFilter !== 'All' ? '#a5b4fc' : 'rgba(255,255,255,0.75)',
        }}>
          {creators.map(c => <option key={c} value={c} style={{ background: '#1a2640' }}>{c === 'All' ? 'All Creators' : c}</option>)}
        </select>

        {/* Responsible dropdown */}
        <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.35)' }}>Responsible</span>
        <select value={respFilter} onChange={e => setRespFilter(e.target.value)} style={{
          ...SELECT_STYLE,
          borderColor: respFilter !== 'All' ? '#67e8f9' : 'rgba(255,255,255,0.12)',
          color: respFilter !== 'All' ? '#67e8f9' : 'rgba(255,255,255,0.75)',
        }}>
          {responsibles.map(r => <option key={r} value={r} style={{ background: '#1a2640' }}>{r === 'All' ? 'All Responsible' : r}</option>)}
        </select>

        {/* Clear filters */}
        {hasActiveFilter && (
          <button onClick={clearFilters} style={{
            padding: '4px 12px', borderRadius: 9999, fontSize: '0.74rem', fontWeight: 700,
            border: '1.5px solid #fca5a5', background: 'rgba(239,68,68,0.1)',
            color: '#f87171', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 4,
          }}>
            ✕ Clear · {filtered.length} shown
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)' }}>
          {filtered.length} of {enriched.length} actions
        </span>
      </div>

      {/* ── Row list — the only scrolling region; header and footer stay pinned ── */}
      <style>{`
        .tb-scroll::-webkit-scrollbar { width: 10px; -webkit-appearance: none; }
        .tb-scroll::-webkit-scrollbar-track { background: #0f2044; border-radius: 8px; }
        .tb-scroll::-webkit-scrollbar-thumb { background: #3b5b9a; border-radius: 8px; border: 1px solid #0f2044; }
      `}</style>
      <div className="tb-scroll" style={{ flex: 1, minHeight: 0, padding: '16px 24px', overflowY: 'scroll', scrollbarWidth: 'thin', scrollbarColor: '#3b5b9a #0f2044' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }}>Loading team actions…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }}>No actions match this filter.</p>
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
                  {/* Left */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: 'white', lineHeight: 1.35, wordBreak: 'break-word' }}>
                      {item.title}
                    </p>

                    {/* Meta — fixed columns */}
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 220px 160px auto', alignItems: 'center' }}>
                      {/* Creator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', width: 72, flexShrink: 0 }}>Creator</span>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: 'white', flexShrink: 0 }}>
                          {item.ownerName.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#a5b4fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.ownerName}</span>
                      </div>

                      {/* Responsible */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', width: 80, flexShrink: 0 }}>Responsible</span>
                        {item.owner ? (
                          <>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#0891b2,#0e7490)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: 'white', flexShrink: 0 }}>
                              {item.owner.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#67e8f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.owner}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)' }}>—</span>
                        )}
                      </div>

                      {/* Due date */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', width: 28, flexShrink: 0 }}>Due</span>
                        {activeDue ? (
                          <span style={{ fontSize: '0.83rem', fontWeight: 600, color: st.overdue ? '#fca5a5' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>📅 {dueLabel}</span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)' }}>—</span>
                        )}
                      </div>

                      {/* Recommitments */}
                      {recommitCount > 0 && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa', background: 'rgba(96,165,250,0.12)', padding: '2px 10px', borderRadius: 9999, whiteSpace: 'nowrap', justifySelf: 'start' }}>
                          🔄 {recommitCount} recommit{recommitCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {item.notes && (
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, wordBreak: 'break-word', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Right: status badge + (admin) delete */}
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 9999, fontSize: '0.8rem', fontWeight: 900, background: st.bg, color: st.text, whiteSpace: 'nowrap' }}>
                      {st.label === 'Red' ? '🔴' : st.label === 'Yellow' ? '🟡' : '🟢'}
                      {daysLabel && <span>{daysLabel}</span>}
                    </span>
                    {canManage && (
                      <button onClick={() => deleteAction(item)} title={`Delete this action (from ${item.ownerName}'s board)`}
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1, flexShrink: 0 }}>
                        ✕
                      </button>
                    )}
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
          { label: 'Past Due',   value: counts.Red,     color: '#f87171', icon: '🔴' },
          { label: 'Due Soon',   value: counts.Yellow,  color: '#fbbf24', icon: '🟡' },
          { label: 'On Track',   value: counts.Green,   color: '#4ade80', icon: '🟢' },
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

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }`}</style>
    </div>
  );
}
