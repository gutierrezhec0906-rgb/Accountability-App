import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { SQDIP_META, SQDIP_ORDER, letterCells, letterGridSize, daysInMonth, FILLER_CELLS, EMPTY_LABEL_CELLS } from '../utils/sqdipLetters';
import { SQDIP_COLORS, SQDIP_STATUS_LABEL, ACTION_STATUS, weeklyStatusCounts, WeeklyBarChart, WeeklyTrendChart, LetterIcon, monthSummary, buildMonthlyTrend } from '../components/SqdipCharts';

const REFRESH_INTERVAL = 60;
const SQUARE = 40;
const GAP = 4;

// Full-screen, TV-scaled walkthrough of the SQDIP Board — one letter fills
// the whole screen at a time (grid, both charts, action plan), with Next/
// Prev to step S → Q → D → I → P for floor meetings. Mirrors the dark,
// large-font styling TeamBoard.jsx uses for its own TV display, and reuses
// the exact grid/chart rendering the editable board uses so what's projected
// always matches what's saved (client/src/components/SqdipCharts.jsx).
export default function SqdipBoard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [teammates, setTeammates] = useState([]); // [{uid, name, hasBoard}] — same team, for the board-owner picker
  const [ownerUid, setOwnerUid] = useState(null);
  const [ownerName, setOwnerName] = useState('');

  // Find teammates (same teamId) so a team member can pick which teammate's
  // board to view — SQDIP boards are per-person (usually the leader's), so
  // without this a member could only ever see their own, empty board.
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const meSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const me = meSnap.exists() ? meSnap.data() : {};
        const teamId = me.teamId || null;
        let mates = [{ uid: currentUser.uid, name: me.displayName || me.email || 'Me', role: me.role, hasBoard: !!me.sqdipBoard }];
        if (teamId) {
          const snap = await getDocs(query(collection(db, 'users'), where('teamId', '==', teamId)));
          mates = snap.docs.map(d => ({ uid: d.id, name: d.data().displayName || d.data().email || 'Teammate', role: d.data().role, hasBoard: !!d.data().sqdipBoard }));
        }
        setTeammates(mates);

        const requested = searchParams.get('uid');
        const requestedValid = requested && mates.some(m => m.uid === requested);
        if (requestedValid) {
          setOwnerUid(requested);
        } else if (me.sqdipBoard) {
          setOwnerUid(currentUser.uid);
        } else {
          // My own board is empty — default to a teammate's (prefer a Leader) if one exists.
          const withBoard = mates.filter(m => m.hasBoard && m.uid !== currentUser.uid);
          const best = withBoard.find(m => m.role === 'Leader') || withBoard[0];
          setOwnerUid(best ? best.uid : currentUser.uid);
        }
      } catch (e) { console.error('Could not load teammates', e); setOwnerUid(currentUser.uid); }
    })();
  }, [currentUser]);

  function chooseOwner(uid) {
    setOwnerUid(uid);
    setBoard(null);
    setLoading(true);
    setSearchParams(uid === currentUser.uid ? {} : { uid });
  }

  const fetchBoard = useCallback(async () => {
    if (!ownerUid) return;
    try {
      const snap = await getDoc(doc(db, 'users', ownerUid));
      const data = snap.exists() ? snap.data() : {};
      const raw = data.sqdipBoard || null;
      // Mirror the entry screen's month rollover: once the calendar flips to
      // a new month, the day grid/logged values reset (folding the finished
      // month's totals into monthlyHistory for the trend chart) while
      // ongoing config — action plans, labels, goals, metric names — carries
      // over untouched so open actions stay visible until closed. This is a
      // display-only fold (not persisted here) — the entry screen persists
      // the real rollover the next time its owner logs a day.
      const currentMonthKey = new Date().toISOString().slice(0, 7);
      if (raw && raw.month && raw.month !== currentMonthKey) {
        const [py, pm] = raw.month.split('-').map(Number);
        const prevDays = daysInMonth(py, pm - 1);
        const prevHistory = raw.monthlyHistory || {};
        const nextHistory = { ...prevHistory };
        SQDIP_ORDER.forEach(k => {
          if ((prevHistory[k] || []).some(m => m.month === raw.month)) return;
          const summary = monthSummary(raw.cells?.[k] || {}, raw.values?.[k] || {}, prevDays);
          nextHistory[k] = [...(prevHistory[k] || []), { month: raw.month, ...summary }].slice(-12);
        });
        setBoard({ ...raw, month: currentMonthKey, cells: {}, values: {}, monthlyHistory: nextHistory });
      } else {
        setBoard(raw);
      }
      setOwnerName(data.displayName || data.email || 'Teammate');
      setCountdown(REFRESH_INTERVAL);
    } catch (e) {
      console.error('SQDIP board fetch error', e);
    }
    setLoading(false);
  }, [ownerUid]);

  useEffect(() => {
    if (!ownerUid) return;
    fetchBoard();
    const interval = setInterval(fetchBoard, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchBoard, ownerUid]);

  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  const enabled = board?.enabled || { S: true, Q: true, D: true, I: true, P: true };
  const letters = SQDIP_ORDER.filter(k => enabled[k]);

  useEffect(() => {
    if (index >= letters.length) setIndex(0);
  }, [letters.length, index]);

  const goPrev = useCallback(() => setIndex(i => (i - 1 + letters.length) % letters.length), [letters.length]);
  const goNext = useCallback(() => setIndex(i => (i + 1) % letters.length), [letters.length]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') navigate(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, navigate]);

  const today = new Date();
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayDay = today.getDate();
  const days = daysInMonth(today.getFullYear(), today.getMonth());

  if (loading) {
    return (
      <div style={{ height: '100vh', background: '#0b1120', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        Loading SQDIP Board…
      </div>
    );
  }

  if (!letters.length) {
    return (
      <div style={{ height: '100vh', background: '#0b1120', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>No active SQDIP letters to display.</div>
        <button onClick={() => navigate(-1)} style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>← Back</button>
      </div>
    );
  }

  const key = letters[index];
  const meta = SQDIP_META[key];
  const label = board?.labels?.[key] || meta.defaultLabel;
  const cellStatus = board?.cells?.[key] || {};
  const cellValues = board?.values?.[key] || {};
  const metricName = board?.metricNames?.[key] || meta.defaultLabel;
  const goal = board?.goals?.[key] || {};
  const actionItems = board?.actionPlans?.[key] || [];
  const weeks = weeklyStatusCounts(cellStatus, cellValues, days);
  const currentMonthKey = today.toISOString().slice(0, 7);
  const months = buildMonthlyTrend(board?.monthlyHistory?.[key], currentMonthKey, monthSummary(cellStatus, cellValues, days));

  const { rows, cols } = letterGridSize(key);
  // Cap each square at SQUARE px, but shrink to whatever actually fits the
  // panel's available height (~230px of chrome above/below it: header,
  // slide title row, legend, card padding) and its ~33vw-wide column —
  // whichever constraint is tighter — so a tall letter's grid always fits
  // on one screen instead of scrolling off the bottom.
  const squareSize = `min(${SQUARE}px, calc((100vh - 230px) / ${rows} - ${GAP}px), calc(30vw / ${cols} - ${GAP}px))`;
  const cells = letterCells(key, days);
  const cellByPos = {};
  cells.forEach(c => { cellByPos[`${c.row}-${c.col}`] = c; });
  const fillerSet = new Set((FILLER_CELLS[key] || []).map(([r, c]) => `${r}-${c}`));
  const emptyLabelSet = new Set((EMPTY_LABEL_CELLS[key] || []).map(([r, c]) => `${r}-${c}`));

  const greenCount = Object.values(cellStatus).filter(v => v === 'green').length;
  const amberCount = Object.values(cellStatus).filter(v => v === 'amber').length;
  const redCount = Object.values(cellStatus).filter(v => v === 'red').length;
  const filled = greenCount + amberCount + redCount;

  const counts = { open: 0, pending: 0, atrisk: 0 };
  actionItems.forEach(it => { if (counts[it.status] !== undefined) counts[it.status]++; });

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#0b1120', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#0f2044', borderBottom: '1px solid #1e3a6e', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} title="Exit (Esc)"
          style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
          ← Exit
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, color: 'white', fontSize: '1.15rem', fontWeight: 900, letterSpacing: '-0.02em' }}>SQDIP Board</h1>
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', fontWeight: 500 }}>{monthLabel}</p>
        </div>
        {teammates.length > 1 && (
          <select value={ownerUid || ''} onChange={e => chooseOwner(e.target.value)}
            title="Choose whose SQDIP board to view"
            style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
            {teammates.map(m => (
              <option key={m.uid} value={m.uid} style={{ color: '#0f2044' }}>
                {m.uid === currentUser.uid ? `${m.name} (me)` : m.name}{!m.hasBoard ? ' — no board' : ''}
              </option>
            ))}
          </select>
        )}
        {/* Letter dots */}
        <div style={{ display: 'flex', gap: 8 }}>
          {letters.map((k, i) => (
            <button key={k} onClick={() => setIndex(i)}
              title={SQDIP_META[k].defaultLabel}
              style={{
                width: 34, height: 34, borderRadius: 9999, border: i === index ? `2px solid white` : '1.5px solid rgba(255,255,255,0.15)',
                background: i === index ? SQDIP_META[k].color : 'rgba(255,255,255,0.06)', color: 'white', fontWeight: 900, fontSize: '0.85rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}>
              {k}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s infinite' }} />
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>Live · {countdown}s</span>
        </div>
      </div>

      {/* Slide — everything below fits within one viewport, no page scroll */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '14px 24px 18px', gap: 10 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <LetterIcon letterKey={key} icon={meta.icon} size="1.3rem" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, color: 'white', fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.02em' }}>{label}</h2>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 600 }}>{metricName} · {filled}/{days} logged</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ margin: 0, color: 'white', fontSize: '0.95rem', fontWeight: 800 }}>{monthLabel}</p>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', fontWeight: 700 }}>Today · Day {todayDay}</p>
          </div>
          <button onClick={goPrev} disabled={letters.length < 2}
            style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontWeight: 800, fontSize: '0.8rem', cursor: letters.length < 2 ? 'default' : 'pointer', opacity: letters.length < 2 ? 0.4 : 1 }}>
            ← Prev
          </button>
          <button onClick={goNext} disabled={letters.length < 2}
            style={{ padding: '7px 14px', borderRadius: 8, background: meta.color, border: 'none', color: 'white', fontWeight: 800, fontSize: '0.8rem', cursor: letters.length < 2 ? 'default' : 'pointer', opacity: letters.length < 2 ? 0.4 : 1 }}>
            Next →
          </button>
        </div>

        {/* Main area: letter grid (left) + charts/action plan (right) */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14 }}>

          {/* Letter grid — fixed at ~1/3 of the screen width so it reads clearly on a TV,
              regardless of how narrow that letter's own shape is. Square size scales down
              to whatever fits the panel's actual height/width (via CSS min()) instead of a
              fixed px, so a tall letter (more rows) never gets clipped/scrolled off-screen. */}
          <div style={{ flex: '0 0 33%', minWidth: 0, overflow: 'hidden', background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`, borderRadius: 14, padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${squareSize})`, gridAutoRows: squareSize, gap: GAP }}>
              {Array.from({ length: rows }).flatMap((_, row) =>
                Array.from({ length: cols }).map((_, col) => {
                  const cell = cellByPos[`${row}-${col}`];
                  if (!cell) {
                    const posKey = `${row}-${col}`;
                    const isBlank = fillerSet.has(posKey) || emptyLabelSet.has(posKey);
                    return <div key={posKey} style={isBlank
                      ? { width: squareSize, height: squareSize, borderRadius: 4, background: 'rgba(255,255,255,0.92)' }
                      : { width: squareSize, height: squareSize }} />;
                  }
                  if (cell.day === null) {
                    return <div key={`${row}-${col}`} style={{ width: squareSize, height: squareSize, borderRadius: 4, background: 'rgba(255,255,255,0.92)' }} />;
                  }
                  const status = cellStatus[cell.day];
                  const bg = status ? SQDIP_COLORS[status] : 'rgba(255,255,255,0.92)';
                  const isToday = cell.day === todayDay;
                  return (
                    <div key={`${row}-${col}`} title={`Day ${cell.day}${status ? ` — ${SQDIP_STATUS_LABEL[status]}` : ''}${isToday ? ' — Today' : ''}`}
                      style={{
                        width: squareSize, height: squareSize, borderRadius: 5, background: bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 'clamp(0.45rem, 1.6vh, 0.85rem)', fontWeight: 700, color: status ? 'rgba(255,255,255,0.9)' : meta.color,
                        boxShadow: isToday ? '0 0 0 3px white, 0 0 10px 2px rgba(255,255,255,0.8)' : 'none',
                        position: 'relative',
                      }}>
                      {cell.day}
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.95rem', color: 'white', fontWeight: 800, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
              <span>🟢 {greenCount} meet</span>
              <span>🟡 {amberCount} behind</span>
              <span>🔴 {redCount} at risk</span>
            </div>
          </div>

          {/* Charts + action plan */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ flex: '0 0 30%', minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#111d3d', borderRadius: 12, padding: '0.6rem 0.9rem', border: '1px solid #1e3a6e', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h4 style={{ margin: '0 0 4px', color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>Weekly Trend</h4>
                <div style={{ flex: 1, minHeight: 0 }}><WeeklyBarChart weeks={weeks} metricName={metricName} goal={goal} /></div>
              </div>
              <div style={{ background: '#111d3d', borderRadius: 12, padding: '0.6rem 0.9rem', border: '1px solid #1e3a6e', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h4 style={{ margin: '0 0 4px', color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>Monthly Trending</h4>
                <div style={{ flex: 1, minHeight: 0 }}><WeeklyTrendChart weeks={months} goal={goal} /></div>
              </div>
            </div>

            {/* Action plan */}
            <div style={{ flex: 1, minHeight: 0, background: '#111d3d', borderRadius: 12, padding: '0.75rem 1rem', border: '1px solid #1e3a6e', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
                <h4 style={{ margin: 0, color: 'white', fontSize: '0.85rem', fontWeight: 800 }}>Action Plan</h4>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.entries(ACTION_STATUS).map(([k, s]) => (
                    <span key={k} title={s.label} style={{ background: s.bg, color: s.color, fontWeight: 800, fontSize: '0.7rem', borderRadius: 7, padding: '2px 8px' }}>
                      {String(counts[k]).padStart(2, '0')} {s.label}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {actionItems.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', margin: 0 }}>No action items logged.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {actionItems.map(it => (
                      <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.6rem', borderRadius: 7, background: 'rgba(255,255,255,0.04)' }}>
                        <span style={{ flex: 1, minWidth: 0, color: 'white', fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                        {it.dueDate && <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{it.dueDate}</span>}
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: ACTION_STATUS[it.status]?.color, background: ACTION_STATUS[it.status]?.bg, borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>
                          {ACTION_STATUS[it.status]?.label || it.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
