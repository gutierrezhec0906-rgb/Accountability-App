import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { SQDIP_META, SQDIP_ORDER, letterCells, letterGridSize, daysInMonth, FILLER_CELLS, EMPTY_LABEL_CELLS } from '../utils/sqdipLetters';
import { SQDIP_COLORS, SQDIP_STATUS_LABEL, ACTION_STATUS, weeklyStatusCounts, WeeklyBarChart, WeeklyTrendChart, LetterIcon } from '../components/SqdipCharts';

const REFRESH_INTERVAL = 60;
const SQDIP_MAX_ROWS = Math.max(...SQDIP_ORDER.map(k => letterGridSize(k).rows));
const SQUARE = 30;
const GAP = 3;

// Full-screen, TV-scaled walkthrough of the SQDIP Board — one letter fills
// the whole screen at a time (grid, both charts, action plan), with Next/
// Prev to step S → Q → D → I → P for floor meetings. Mirrors the dark,
// large-font styling TeamBoard.jsx uses for its own TV display, and reuses
// the exact grid/chart rendering the editable board uses so what's projected
// always matches what's saved (client/src/components/SqdipCharts.jsx).
export default function SqdipBoard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  const fetchBoard = useCallback(async () => {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      setBoard(snap.exists() ? (snap.data().sqdipBoard || null) : null);
      setCountdown(REFRESH_INTERVAL);
    } catch (e) {
      console.error('SQDIP board fetch error', e);
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    fetchBoard();
    const interval = setInterval(fetchBoard, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchBoard]);

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

  const { rows, cols } = letterGridSize(key);
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

      {/* Slide */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 1400, padding: '24px 32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LetterIcon letterKey={key} icon={meta.icon} size="1.8rem" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>{label}</h2>
              <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', fontWeight: 600 }}>{metricName} · {filled}/{days} logged</p>
            </div>
            <button onClick={goPrev} disabled={letters.length < 2}
              style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontWeight: 800, fontSize: '0.9rem', cursor: letters.length < 2 ? 'default' : 'pointer', opacity: letters.length < 2 ? 0.4 : 1 }}>
              ← Prev
            </button>
            <button onClick={goNext} disabled={letters.length < 2}
              style={{ padding: '10px 18px', borderRadius: 10, background: meta.color, border: 'none', color: 'white', fontWeight: 800, fontSize: '0.9rem', cursor: letters.length < 2 ? 'default' : 'pointer', opacity: letters.length < 2 ? 0.4 : 1 }}>
              Next →
            </button>
          </div>

          {/* Letter grid */}
          <div style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`, borderRadius: 16, padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ height: SQDIP_MAX_ROWS * (SQUARE + GAP) }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${SQUARE}px)`, gridAutoRows: `${SQUARE}px`, gap: GAP }}>
                  {Array.from({ length: rows }).flatMap((_, row) =>
                    Array.from({ length: cols }).map((_, col) => {
                      const cell = cellByPos[`${row}-${col}`];
                      if (!cell) {
                        const posKey = `${row}-${col}`;
                        const isBlank = fillerSet.has(posKey) || emptyLabelSet.has(posKey);
                        return <div key={posKey} style={isBlank
                          ? { width: SQUARE, height: SQUARE, borderRadius: 4, background: 'rgba(255,255,255,0.92)' }
                          : { width: SQUARE, height: SQUARE }} />;
                      }
                      if (cell.day === null) {
                        return <div key={`${row}-${col}`} style={{ width: SQUARE, height: SQUARE, borderRadius: 4, background: 'rgba(255,255,255,0.92)' }} />;
                      }
                      const status = cellStatus[cell.day];
                      const bg = status ? SQDIP_COLORS[status] : 'rgba(255,255,255,0.92)';
                      return (
                        <div key={`${row}-${col}`} title={`Day ${cell.day}${status ? ` — ${SQDIP_STATUS_LABEL[status]}` : ''}`}
                          style={{
                            width: SQUARE, height: SQUARE, borderRadius: 5, background: bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', fontWeight: 700, color: status ? 'rgba(255,255,255,0.9)' : meta.color,
                          }}>
                          {cell.day}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
            <span>🟢 {greenCount} meet</span>
            <span>🟡 {amberCount} behind</span>
            <span>🔴 {redCount} at risk</span>
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
            <div style={{ background: '#111d3d', borderRadius: 14, padding: '1rem 1.25rem', border: '1px solid #1e3a6e' }}>
              <h4 style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 800 }}>Weekly Trend</h4>
              <WeeklyBarChart weeks={weeks} metricName={metricName} goal={goal} />
            </div>
            <div style={{ background: '#111d3d', borderRadius: 14, padding: '1rem 1.25rem', border: '1px solid #1e3a6e' }}>
              <h4 style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 800 }}>One Minute Manager</h4>
              <WeeklyTrendChart weeks={weeks} goal={goal} />
            </div>
          </div>

          {/* Action plan */}
          <div style={{ background: '#111d3d', borderRadius: 14, padding: '1.25rem', border: '1px solid #1e3a6e' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <h4 style={{ margin: 0, color: 'white', fontSize: '1rem', fontWeight: 800 }}>Action Plan</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.entries(ACTION_STATUS).map(([k, s]) => (
                  <span key={k} title={s.label} style={{ background: s.bg, color: s.color, fontWeight: 800, fontSize: '0.8rem', borderRadius: 8, padding: '3px 10px' }}>
                    {String(counts[k]).padStart(2, '0')} {s.label}
                  </span>
                ))}
              </div>
            </div>
            {actionItems.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', margin: 0 }}>No action items logged.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {actionItems.map(it => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                    <span style={{ flex: 1, minWidth: 0, color: 'white', fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                    {it.dueDate && <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{it.dueDate}</span>}
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: ACTION_STATUS[it.status]?.color, background: ACTION_STATUS[it.status]?.bg, borderRadius: 999, padding: '3px 10px', flexShrink: 0 }}>
                      {ACTION_STATUS[it.status]?.label || it.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
