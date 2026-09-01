import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { calculateScore } from '../utils/scoring';
import { compressImage } from '../utils/image';
import { SQDIP_META, SQDIP_ORDER, letterCells, letterGridSize, daysInMonth, localMonthKey, FILLER_CELLS, EMPTY_LABEL_CELLS } from '../utils/sqdipLetters';
import { SQDIP_COLORS, SQDIP_STATUS_LABEL, ACTION_STATUS, weeklyStatusCounts, weekWorstColor, WeeklyBarChart, WeeklyTrendChart, LetterIcon, monthSummary, buildMonthlyTrend } from '../components/SqdipCharts';
import { useNavigate } from 'react-router-dom';

const opexChecklist = [
  { category: 'Process Excellence',     items: ['Standard work documented and followed','KPIs are visible and reviewed daily','Process variation is measured and reduced','Value stream mapping completed and updated'] },
  { category: 'Continuous Improvement', items: ['Kaizen events conducted quarterly','Employee ideas captured and implemented','Lessons learned are shared across teams','PDCA cycle is actively used for problems'] },
  { category: 'Leadership Behaviors',   items: ['Daily gemba walks completed','Coaching conversations held weekly','Recognition given frequently and specifically','Accountability conversations handled promptly'] },
  { category: 'Customer Focus',         items: ['Voice of customer captured monthly','Customer complaint root causes addressed','First-time quality metrics tracked','On-time delivery performance monitored'] },
];


// Fixed square size/gap so day-squares are pixel-identical across every
// letter regardless of card width, and a fixed grid height (sized for the
// tallest letter, P) so the "meet/behind/at risk" legend lands at the same
// vertical position under every card, whichever letters are active.
const SQDIP_SQUARE = 32;
const SQDIP_GAP = 3;
const SQDIP_MAX_ROWS = Math.max(...SQDIP_ORDER.map(k => letterGridSize(k).rows));

// Compact action-plan list under each letter — title / due date / status,
// with add and remove. Mirrors the lightweight row-editor pattern used
// elsewhere in the app (Coaching action items, Lean follow-ups).
function ActionPlanSection({ items, onChange }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const counts = { open: 0, pending: 0, atrisk: 0 };
  items.forEach(it => { if (counts[it.status] !== undefined) counts[it.status]++; });

  function addItem() {
    if (!title.trim()) return;
    onChange([...items, { id: Date.now().toString(), title: title.trim(), dueDate, status: 'open' }]);
    setTitle(''); setDueDate('');
  }
  function updateStatus(id, status) {
    onChange(items.map(it => it.id === id ? { ...it, status } : it));
  }
  function removeItem(id) {
    if (editingId === id) setEditingId(null);
    onChange(items.filter(it => it.id !== id));
  }
  function startEdit(it) {
    setEditingId(it.id);
    setEditTitle(it.title);
    setEditDueDate(it.dueDate || '');
  }
  function saveEdit(id) {
    if (!editTitle.trim()) return;
    onChange(items.map(it => it.id === id ? { ...it, title: editTitle.trim(), dueDate: editDueDate } : it));
    setEditingId(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.85rem' }}>Action Plan</h4>
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.entries(ACTION_STATUS).map(([key, s]) => (
            <span key={key} title={s.label} style={{ background: s.bg, color: s.color, fontWeight: 800, fontSize: '0.72rem', borderRadius: 8, padding: '2px 8px', minWidth: 22, textAlign: 'center' }}>
              {String(counts[key]).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {items.map(it => (
            editingId === it.id ? (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.5rem', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit(it.id)}
                  autoFocus
                  style={{ flex: 1, minWidth: 0, fontSize: '0.78rem', padding: '0.3rem 0.45rem', borderRadius: 6, border: '1px solid #bfdbfe' }} />
                <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                  style={{ fontSize: '0.68rem', padding: '0.3rem 0.35rem', borderRadius: 6, border: '1px solid #bfdbfe', width: 122, flexShrink: 0 }} />
                <button onClick={() => saveEdit(it.id)} title="Save"
                  style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Save</button>
                <button onClick={() => setEditingId(null)} title="Cancel"
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}>✕</button>
              </div>
            ) : (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.5rem', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span onClick={() => startEdit(it)} title="Click to edit"
                  style={{ flex: 1, minWidth: 0, fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{it.title}</span>
                {it.dueDate && <span style={{ fontSize: '0.68rem', color: '#94a3b8', flexShrink: 0 }}>{it.dueDate}</span>}
                <select value={it.status} onChange={e => updateStatus(it.id, e.target.value)}
                  style={{ fontSize: '0.68rem', fontWeight: 700, color: ACTION_STATUS[it.status].color, background: ACTION_STATUS[it.status].bg, border: 'none', borderRadius: 999, padding: '2px 6px', flexShrink: 0, cursor: 'pointer' }}>
                  {Object.entries(ACTION_STATUS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
                </select>
                <button onClick={() => startEdit(it)} title="Edit" style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}>✏️</button>
                <button onClick={() => removeItem(it.id)} title="Delete" style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}>🗑</button>
              </div>
            )
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Action title…"
          style={{ flex: 1, minWidth: 0, fontSize: '0.78rem', padding: '0.35rem 0.5rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          style={{ fontSize: '0.72rem', padding: '0.35rem 0.4rem', borderRadius: 8, border: '1px solid #e2e8f0', width: 128, flexShrink: 0 }} />
        <button onClick={addItem} style={{ background: '#0f2044', color: 'white', border: 'none', borderRadius: 8, padding: '0.35rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>+ Add</button>
      </div>
    </div>
  );
}

// One letter card — a pixel-grid glyph made of clickable day-squares, plus a
// weekly chart, a trend chart, and a per-letter action plan underneath.
// Clicking a square opens a small popover with explicit Meet Goal / Behind
// Goal / At Risk / Clear options, so picking a status is a direct choice.
function SqdipLetterCard({ letterKey, label, days, cellStatus, onSetDay, cellValues, onSetValue, goal, onGoalChange, metricName, onMetricNameChange, actionItems, onActionItemsChange, monthlyHistory }) {
  const meta = SQDIP_META[letterKey];
  const { rows, cols } = letterGridSize(letterKey);
  const cells = letterCells(letterKey, days);
  const cellByPos = {};
  cells.forEach(c => { cellByPos[`${c.row}-${c.col}`] = c; });
  const fillerSet = new Set((FILLER_CELLS[letterKey] || []).map(([r, c]) => `${r}-${c}`));
  const emptyLabelSet = new Set((EMPTY_LABEL_CELLS[letterKey] || []).map(([r, c]) => `${r}-${c}`));

  const [openDay, setOpenDay] = useState(null);
  const [valueDraft, setValueDraft] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [editingMetric, setEditingMetric] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);

  const greenCount = Object.values(cellStatus).filter(v => v === 'green').length;
  const amberCount = Object.values(cellStatus).filter(v => v === 'amber').length;
  const redCount = Object.values(cellStatus).filter(v => v === 'red').length;
  const filled = greenCount + amberCount + redCount;
  const weeks = weeklyStatusCounts(cellStatus, cellValues, days);
  const currentMonthKey = localMonthKey();
  const months = buildMonthlyTrend(monthlyHistory, currentMonthKey, monthSummary(cellStatus, cellValues, days));

  function choose(day, status) {
    onSetDay(letterKey, day, status);
    setOpenDay(null);
  }

  function openPopover(day) {
    if (openDay === day) { setOpenDay(null); return; }
    setOpenDay(day);
    setValueDraft(cellValues?.[day] ?? '');
    setJustSaved(false);
  }

  function saveValue(day) {
    const trimmed = String(valueDraft).trim();
    if (trimmed !== '' && Number.isNaN(Number(trimmed))) return toast.error('Enter a valid number');
    const saved = trimmed === '' ? null : Number(trimmed);
    onSetValue(day, saved);
    setValueDraft(saved === null ? '' : saved);
    setJustSaved(true);
  }

  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Gradient header */}
      <div style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`, padding: '1rem 1.25rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LetterIcon letterKey={letterKey} icon={meta.icon} />
            <h3 style={{ fontWeight: 800, color: 'white', margin: 0, fontSize: '1.05rem' }}>{label}</h3>
          </div>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{filled}/{days} logged</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: SQDIP_MAX_ROWS * (SQDIP_SQUARE + SQDIP_GAP), margin: '0.9rem 0 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${SQDIP_SQUARE}px)`, gridAutoRows: `${SQDIP_SQUARE}px`, gap: SQDIP_GAP }}>
          {Array.from({ length: rows }).flatMap((_, row) =>
            Array.from({ length: cols }).map((_, col) => {
              const cell = cellByPos[`${row}-${col}`];
              if (!cell) {
                const posKey = `${row}-${col}`;
                const isBlankSquare = fillerSet.has(posKey) || emptyLabelSet.has(posKey);
                return <div key={posKey} style={isBlankSquare
                  ? { width: SQDIP_SQUARE, height: SQDIP_SQUARE, borderRadius: 3, background: 'rgba(255,255,255,0.92)' }
                  : { width: SQDIP_SQUARE, height: SQDIP_SQUARE }} />;
              }
              if (cell.day === null) {
                return <div key={`${row}-${col}`} style={{ width: SQDIP_SQUARE, height: SQDIP_SQUARE, borderRadius: 3, background: 'rgba(255,255,255,0.92)' }} />;
              }
              const status = cellStatus[cell.day];
              const loggedValue = cellValues?.[cell.day];
              const hasLoggedValue = loggedValue !== undefined && loggedValue !== null;
              const bg = status ? SQDIP_COLORS[status] : 'rgba(255,255,255,0.92)';
              const isOpen = openDay === cell.day;
              return (
                <div key={`${row}-${col}`} style={{ position: 'relative', width: SQDIP_SQUARE, height: SQDIP_SQUARE }}>
                  <button onClick={() => openPopover(cell.day)}
                    title={`Day ${cell.day}${status ? ` — ${SQDIP_STATUS_LABEL[status]}` : ' — click to log'}${hasLoggedValue ? ` — value ${loggedValue}` : ''}`}
                    style={{
                      width: '100%', height: '100%', borderRadius: 3, border: 'none',
                      background: bg, cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.55rem', fontWeight: 700, color: status ? 'rgba(255,255,255,0.9)' : meta.color,
                      transition: 'background 0.15s',
                    }}>
                    {cell.day}
                  </button>
                  {isOpen && (
                    <>
                      <div onClick={() => setOpenDay(null)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 200,
                        background: '#0f2044', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 6,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.25)', whiteSpace: 'nowrap',
                      }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => choose(cell.day, 'green')} title="Meet Goal"
                            style={{ background: SQDIP_COLORS.green, border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: '0.85rem' }}>✓</button>
                          <button onClick={() => choose(cell.day, 'amber')} title="Behind Goal"
                            style={{ background: SQDIP_COLORS.amber, border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: '0.85rem' }}>!</button>
                          <button onClick={() => choose(cell.day, 'red')} title="At Risk"
                            style={{ background: SQDIP_COLORS.red, border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                          {status && (
                            <button onClick={() => choose(cell.day, null)} title="Clear"
                              style={{ background: 'rgba(255,255,255,0.92)', color: 'white', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>⨯</button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 6 }}>
                          <input type="number" value={valueDraft}
                            onChange={e => { setValueDraft(e.target.value); setJustSaved(false); }}
                            onKeyDown={e => e.key === 'Enter' && saveValue(cell.day)}
                            placeholder={metricName} title={`Actual ${metricName} value for this day`}
                            style={{ width: 64, fontSize: '0.72rem', padding: '3px 5px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: 'white' }} />
                          <button onClick={() => saveValue(cell.day)} title="Save value"
                            style={{ background: justSaved ? '#16a34a' : '#0d9488', color: 'white', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                            {justSaved ? '✓ Saved' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
        </div>

        <div style={{ display: 'flex', gap: 10, fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700, marginTop: 10, flexWrap: 'wrap' }}>
          <span>🟢 {greenCount} meet</span>
          <span>🟡 {amberCount} behind</span>
          <span>🔴 {redCount} at risk</span>
        </div>
      </div>

      {/* Metric name + goal + weekly chart */}
      <div style={{ padding: '1rem 1.25rem 0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          {editingMetric ? (
            <input autoFocus value={metricName} onChange={e => onMetricNameChange(e.target.value)}
              onBlur={() => setEditingMetric(false)} onKeyDown={e => e.key === 'Enter' && setEditingMetric(false)}
              style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.3rem 0.5rem', borderRadius: 8, border: `1px solid ${meta.color}`, flex: 1, minWidth: 100 }} />
          ) : (
            <button onClick={() => setEditingMetric(true)} title="Click to rename this metric"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metricName}</span>
              <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>✎</span>
            </button>
          )}

          {editingGoal ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <select value={goal?.direction || 'max'} onChange={e => onGoalChange({ ...goal, direction: e.target.value })}
                style={{ fontSize: '0.68rem', padding: '3px 4px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <option value="max">≤ at most</option>
                <option value="min">≥ at least</option>
              </select>
              <input type="number" autoFocus value={goal?.target ?? ''} onChange={e => onGoalChange({ ...goal, target: e.target.value === '' ? null : Number(e.target.value) })}
                onBlur={() => setEditingGoal(false)} onKeyDown={e => e.key === 'Enter' && setEditingGoal(false)}
                placeholder="target" style={{ width: 56, fontSize: '0.72rem', padding: '3px 5px', borderRadius: 6, border: '1px solid #e2e8f0' }} />
            </div>
          ) : (
            <button onClick={() => setEditingGoal(true)} title="Click to set a numeric goal for this metric"
              style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 999, padding: '2px 9px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8' }}>
              🎯 {goal?.target !== undefined && goal?.target !== null ? `${goal.direction === 'min' ? '≥' : '≤'} ${goal.target}` : 'Set goal'}
            </button>
          )}
        </div>
        <WeeklyBarChart weeks={weeks} metricName={metricName} goal={goal} />
      </div>

      {/* Action Plan */}
      <div style={{ padding: '0.5rem 1.25rem 1rem', borderTop: '1px solid var(--border)', marginTop: 8 }}>
        <ActionPlanSection items={actionItems} onChange={onActionItemsChange} />
      </div>

      {/* One Minute Manager trend chart */}
      <div style={{ padding: '0.75rem 1.25rem 1.25rem', borderTop: '1px solid var(--border)' }}>
        <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', fontSize: '0.85rem' }}>Monthly Trending</h4>
        <WeeklyTrendChart weeks={months} goal={goal} />
      </div>
    </div>
  );
}

export default function EQOpEx() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('eqopex-active-tab') || 'opex');
  const [opexChecks, setOpexChecks] = useState({});
  const [opexFindings, setOpexFindings] = useState({});
  const [opexArea, setOpexArea] = useState('');
  const [opexExpandedItem, setOpexExpandedItem] = useState(null);
  const [opexHistory, setOpexHistory] = useState([]);
  const [opexExpandedAudit, setOpexExpandedAudit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState(null);

  // SQDIP Board state — which letters are active (max 5, all 5 by default),
  // label overrides for I/P (Inventory↔Cost, People↔Productivity), and the
  // current month's day-by-day green/red status per letter.
  const [sqdipEnabled, setSqdipEnabled] = useState({ S: true, Q: true, D: true, I: true, P: true });
  const [sqdipLabels, setSqdipLabels] = useState({});
  const [sqdipCells, setSqdipCells] = useState({ S: {}, Q: {}, D: {}, I: {}, P: {} });
  const [sqdipMetricNames, setSqdipMetricNames] = useState({ S: 'Accidents', Q: 'Defects', D: 'Late Shipments', I: 'Stock-outs', P: 'Turnover' });
  const [sqdipActionPlans, setSqdipActionPlans] = useState({ S: [], Q: [], D: [], I: [], P: [] });
  const [sqdipValues, setSqdipValues] = useState({ S: {}, Q: {}, D: {}, I: {}, P: {} });
  const [sqdipGoals, setSqdipGoals] = useState({});
  const [sqdipMonthlyHistory, setSqdipMonthlyHistory] = useState({});

  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    async function load() {
      try {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setOpexHistory(data.opexAudits || []);

          if (data.eqOpexActiveTab && data.eqOpexActiveTab !== 'eq') setActiveTab(data.eqOpexActiveTab);

          const board = data.sqdipBoard;
          const currentMonthKey = localMonthKey();
          if (board) {
            setSqdipEnabled(board.enabled || { S: true, Q: true, D: true, I: true, P: true });
            setSqdipLabels(board.labels || {});
            setSqdipMetricNames(m => ({ ...m, ...(board.metricNames || {}) }));
            setSqdipGoals(board.goals || {});
            // Action plans, metric names, and goals carry across months
            // (they're ongoing config, not a day-by-day log); only the day
            // grid and logged values reset.
            setSqdipActionPlans(a => ({ ...a, ...(board.actionPlans || {}) }));
            if (board.month === currentMonthKey) {
              setSqdipCells(board.cells || { S: {}, Q: {}, D: {}, I: {}, P: {} });
              setSqdipValues(board.values || { S: {}, Q: {}, D: {}, I: {}, P: {} });
              setSqdipMonthlyHistory(board.monthlyHistory || {});
            } else if (board.month) {
              // The stored board is from a previous month — fold that
              // month's totals into history (for the "One Minute Manager"
              // monthly trend) before the day grid/values reset for the
              // new month.
              const [py, pm] = board.month.split('-').map(Number);
              const prevDays = daysInMonth(py, pm - 1);
              const prevHistory = board.monthlyHistory || {};
              const nextHistory = { ...prevHistory };
              SQDIP_ORDER.forEach(k => {
                if ((prevHistory[k] || []).some(m => m.month === board.month)) return;
                const summary = monthSummary(board.cells?.[k] || {}, board.values?.[k] || {}, prevDays);
                nextHistory[k] = [...(prevHistory[k] || []), { month: board.month, ...summary }].slice(-12);
              });
              setSqdipMonthlyHistory(nextHistory);
              const rolledBoard = { ...board, month: currentMonthKey, cells: {}, values: {}, monthlyHistory: nextHistory };
              setDoc(doc(db, 'users', currentUser.uid), { sqdipBoard: rolledBoard }, { merge: true }).catch(() => {});
            } else {
              setSqdipMonthlyHistory(board.monthlyHistory || {});
            }
          }
        }
      } catch (e) { console.error(e); setLoadError(true); }
    }
    load();
  }, [currentUser]);

  async function persistSqdip(next) {
    if (!currentUser) return;
    const monthKey = localMonthKey();
    const board = {
      month: monthKey,
      enabled: next.enabled ?? sqdipEnabled,
      labels: next.labels ?? sqdipLabels,
      cells: next.cells ?? sqdipCells,
      metricNames: next.metricNames ?? sqdipMetricNames,
      actionPlans: next.actionPlans ?? sqdipActionPlans,
      values: next.values ?? sqdipValues,
      goals: next.goals ?? sqdipGoals,
      monthlyHistory: next.monthlyHistory ?? sqdipMonthlyHistory,
    };
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { sqdipBoard: board }, { merge: true });
    } catch { toast.error('Could not save SQDIP Board'); }
  }

  function toggleSqdipLetter(key) {
    const activeCount = Object.values(sqdipEnabled).filter(Boolean).length;
    const turningOn = !sqdipEnabled[key];
    if (turningOn && activeCount >= 5) return toast.error('Maximum of 5 letters on the board');
    if (!turningOn && activeCount <= 1) return toast.error('Keep at least one letter active');
    const next = { ...sqdipEnabled, [key]: turningOn };
    setSqdipEnabled(next);
    persistSqdip({ enabled: next });
  }

  function toggleSqdipLabel(key) {
    const meta = SQDIP_META[key];
    if (!meta.altLabel) return;
    const current = sqdipLabels[key] || meta.defaultLabel;
    const next = { ...sqdipLabels, [key]: current === meta.defaultLabel ? meta.altLabel : meta.defaultLabel };
    setSqdipLabels(next);
    persistSqdip({ labels: next });
  }

  function setSqdipDay(letterKey, day, status) {
    const nextLetterCells = { ...(sqdipCells[letterKey] || {}) };
    if (status) nextLetterCells[day] = status; else delete nextLetterCells[day];
    const next = { ...sqdipCells, [letterKey]: nextLetterCells };
    setSqdipCells(next);
    persistSqdip({ cells: next });
  }

  function setSqdipMetricName(letterKey, name) {
    const next = { ...sqdipMetricNames, [letterKey]: name };
    setSqdipMetricNames(next);
    persistSqdip({ metricNames: next });
  }

  async function setSqdipActionItems(letterKey, items) {
    const next = { ...sqdipActionPlans, [letterKey]: items };
    setSqdipActionPlans(next);
    await persistSqdip({ actionPlans: next });
    // The SQDIP score is computed live from the saved action items (not a
    // pointEvent), so it needs an explicit recalculation here — nothing else
    // triggers it when an item is added, edited, or its due date changes.
    if (currentUser) { try { await calculateScore(currentUser.uid); } catch {} }
  }

  function setSqdipValue(letterKey, day, value) {
    const nextLetterValues = { ...(sqdipValues[letterKey] || {}) };
    if (value === null || value === undefined) delete nextLetterValues[day]; else nextLetterValues[day] = value;
    const next = { ...sqdipValues, [letterKey]: nextLetterValues };
    setSqdipValues(next);
    persistSqdip({ values: next });
  }

  function setSqdipGoal(letterKey, goal) {
    const next = { ...sqdipGoals, [letterKey]: goal };
    setSqdipGoals(next);
    persistSqdip({ goals: next });
  }

  async function saveOpexAudit() {
    if (!currentUser) return toast.error('Not logged in');
    if (!opexArea.trim()) return toast.error('Please enter the area being audited');
    if (checkedOpex === 0) return toast.error('Complete at least one checklist item before saving');
    const dupName = opexArea.trim().toLowerCase();
    if (opexHistory.some(a => a.area.toLowerCase() === dupName)) {
      return toast.error(`An audit for "${opexArea.trim()}" already exists. Use a different name or delete the existing one first.`);
    }
    setSaving(true);
    try {
      const findingsNoImages = Object.fromEntries(
        Object.entries(opexFindings).filter(([, v]) => v.note).map(([k, v]) => [k, { note: v.note }])
      );
      const record = {
        id: Date.now().toString(),
        area: opexArea.trim(),
        score: opexPct,
        checked: checkedOpex,
        total: totalOpex,
        checks: { ...opexChecks },
        findings: findingsNoImages,
        date: new Date().toISOString(),
      };
      const updated = [record, ...opexHistory].slice(0, 50);
      await setDoc(doc(db, 'users', currentUser.uid), { opexAudits: updated }, { merge: true });
      setOpexHistory(updated);
      toast.success(`Audit saved — ${opexPct}% for "${opexArea}"`);
    } catch (e) { toast.error('Save failed: ' + e.message); }
    setSaving(false);
  }

  function loadOpexAudit(record) {
    setOpexChecks(record.checks || {});
    setOpexFindings(record.findings || {});
    setOpexArea(record.area || '');
    setOpexExpandedItem(null);
    toast.success(`Loaded audit: ${record.area}`);
  }

  async function deleteOpexAudit(id) {
    const updated = opexHistory.filter(a => a.id !== id);
    await setDoc(doc(db, 'users', currentUser.uid), { opexAudits: updated }, { merge: true });
    setOpexHistory(updated);
    toast.success('Audit deleted');
  }

  function resetOpexAudit() {
    setOpexChecks({});
    setOpexFindings({});
    setOpexArea('');
    setOpexExpandedItem(null);
  }

  function setOpexFinding(key, field, value) {
    setOpexFindings(f => ({ ...f, [key]: { ...(f[key] || {}), [field]: value } }));
  }

  async function handleOpexImageUpload(key, e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error('Image is too large (max 25 MB)'); return; }
    try {
      const { preview } = await compressImage(file);
      setOpexFinding(key, 'image', preview);
    } catch {
      if (file.size > 5 * 1024 * 1024) { toast.error("Couldn't process this photo. Try a smaller one."); return; }
      const reader = new FileReader();
      reader.onload = ev => setOpexFinding(key, 'image', ev.target.result);
      reader.readAsDataURL(file);
    }
  }

  function removeOpexImage(key) {
    setOpexFindings(f => ({ ...f, [key]: { ...(f[key] || {}), image: null } }));
  }

  function toggleOpex(cat, idx) { const k = `${cat}-${idx}`; setOpexChecks(c => ({ ...c, [k]: !c[k] })); }

  const totalOpex = opexChecklist.reduce((a, c) => a + c.items.length, 0);
  const checkedOpex = Object.values(opexChecks).filter(Boolean).length;
  const opexPct = Math.round((checkedOpex / totalOpex) * 100);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader icon="⚙️" title="OpEx Tools — Accountability in Action" subtitle="Operational Excellence checklist and SQDIP Board" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {[{ id: 'sqdip', label: '🗓️ SQDIP Board' }, { id: 'opex', label: '⚙️ OpEx Checklist' }].map(t => (
          <button key={t.id} onClick={() => {
            setActiveTab(t.id);
            localStorage.setItem('eqopex-active-tab', t.id);
            if (currentUser) setDoc(doc(db, 'users', currentUser.uid), { eqOpexActiveTab: t.id }, { merge: true }).catch(() => {});
          }}
            style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: activeTab === t.id ? '#0f2044' : '#f1f5f9', color: activeTab === t.id ? 'white' : '#475569' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'opex' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* ── Left: checklist ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Area input + score card */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: 12 }}>
                <label className="label">Area / Location Being Audited</label>
                <input className="input" value={opexArea} onChange={e => setOpexArea(e.target.value)}
                  placeholder="e.g. Production Floor, Warehouse, Office — Q3 2026…" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>OpEx Compliance Score</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 900, color: opexPct >= 80 ? '#0d9488' : opexPct >= 60 ? '#f59e0b' : '#ef4444' }}>{opexPct}%</span>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 10, marginBottom: 6 }}>
                <div style={{ height: 10, borderRadius: 9999, background: opexPct >= 80 ? '#0d9488' : opexPct >= 60 ? '#f59e0b' : '#ef4444', width: `${opexPct}%`, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{checkedOpex} of {totalOpex} behaviors practiced</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }} onClick={resetOpexAudit}>↺ Reset</button>
                  <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.875rem' }} onClick={saveOpexAudit} disabled={saving}>{saving ? 'Saving…' : '💾 Save Audit'}</button>
                  {(opexArea.trim() || checkedOpex > 0) && (
                    <button style={{ fontSize: '0.78rem', padding: '0.3rem 0.875rem', borderRadius: 9999, fontWeight: 700, border: '1.5px solid #0d9488', background: 'white', color: '#0d9488', cursor: 'pointer' }} onClick={resetOpexAudit}>＋ New Audit</button>
                  )}
                </div>
              </div>
            </div>

            {opexChecklist.map(cat => (
              <div key={cat.category} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1.25rem', background: '#0f2044' }}>
                  <span style={{ color: 'white', fontWeight: 800, fontSize: '0.875rem' }}>{cat.category}</span>
                </div>
                {cat.items.map((item, i) => {
                  const key = `${cat.category}-${i}`;
                  const isExpanded = opexExpandedItem === key;
                  const finding = opexFindings[key] || {};
                  const hasFinding = finding.note || finding.image;
                  return (
                    <div key={i} style={{ borderBottom: i < cat.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1.25rem' }}>
                        <button onClick={() => toggleOpex(cat.category, i)}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${opexChecks[key] ? '#0d9488' : '#e2e8f0'}`, background: opexChecks[key] ? '#0d9488' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s' }}>
                            {opexChecks[key] && '✓'}
                          </div>
                          <span style={{ fontSize: '0.875rem', color: opexChecks[key] ? '#94a3b8' : 'var(--text-secondary)', textDecoration: opexChecks[key] ? 'line-through' : 'none' }}>{item}</span>
                        </button>
                        {hasFinding && !isExpanded && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#fef9c3', color: '#b45309', border: '1px solid #fde68a', borderRadius: 9999, padding: '1px 7px', flexShrink: 0 }}>
                            {finding.image ? '📎 Photo' : '📝 Note'}
                          </span>
                        )}
                        <button onClick={() => setOpexExpandedItem(isExpanded ? null : key)}
                          title={isExpanded ? 'Collapse' : 'Add finding / photo'}
                          style={{ background: isExpanded ? '#f1f5f9' : 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '3px 9px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', cursor: 'pointer', flexShrink: 0 }}>
                          {isExpanded ? '▲' : '📎'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div style={{ margin: '0 1.25rem 0.875rem', background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Finding Details</p>
                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description / Finding</label>
                            <textarea className="input" rows={3} style={{ fontSize: '0.825rem', resize: 'vertical' }}
                              placeholder="Describe what was observed, the gap, or the non-conformance…"
                              value={finding.note || ''}
                              onChange={e => setOpexFinding(key, 'note', e.target.value)} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Photo Evidence (PNG, JPG, GIF — max 5 MB)</label>
                            {finding.image ? (
                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                <img src={finding.image} alt="Finding" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                                <button onClick={() => removeOpexImage(key)}
                                  style={{ position: 'absolute', top: 6, right: 6, background: '#ef4444', border: 'none', borderRadius: '50%', width: 24, height: 24, color: 'white', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              </div>
                            ) : (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderRadius: 8, border: '1.5px dashed #cbd5e1', cursor: 'pointer', background: 'white', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                                📷 Click to attach photo
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleOpexImageUpload(key, e)} />
                              </label>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ── Right: audit history ── */}
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: '1.125rem' }}>
              <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', fontSize: '0.9rem' }}>📋 Audit History</h4>
              {opexHistory.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', margin: '1.5rem 0' }}>No audits saved yet. Complete the checklist and click Save Audit.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {opexHistory.map(record => {
                    const scoreColor = record.score >= 80 ? '#0d9488' : record.score >= 60 ? '#f59e0b' : '#ef4444';
                    const scoreBg    = record.score >= 80 ? '#f0fdfa' : record.score >= 60 ? '#fffbeb' : '#fef2f2';
                    const isExp = opexExpandedAudit === record.id;
                    const dateStr = new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <div key={record.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.area}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{dateStr}</p>
                          </div>
                          <span style={{ background: scoreBg, color: scoreColor, fontWeight: 800, fontSize: '0.875rem', borderRadius: 8, padding: '2px 10px', border: `1px solid ${scoreColor}33`, flexShrink: 0 }}>{record.score}%</span>
                        </div>
                        <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                          <button onClick={() => loadOpexAudit(record)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#0d9488' }}>
                            📂 Load
                          </button>
                          <button onClick={() => setOpexExpandedAudit(isExp ? null : record.id)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#64748b' }}>
                            {isExp ? '▲' : '▼'} Details
                          </button>
                          <button onClick={() => deleteOpexAudit(record.id)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                            🗑
                          </button>
                        </div>
                        {isExp && (
                          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', background: '#f8fafc', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{record.checked} / {record.total} items completed</p>
                            {Object.keys(record.findings || {}).length > 0 && (
                              <p style={{ margin: 0, color: '#b45309' }}>📝 {Object.keys(record.findings).length} note(s) recorded</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sqdip' && (() => {
        const today = new Date();
        const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const days = daysInMonth(today.getFullYear(), today.getMonth());
        const activeCount = Object.values(sqdipEnabled).filter(Boolean).length;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Config bar */}
            <div className="card" style={{ padding: '1.125rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.95rem' }}>🗓️ {monthLabel} · {days} days</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Log each day, track the weekly trend, and manage the action plan for each letter.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{activeCount}/5 letters active</span>
                  <button className="btn-secondary" onClick={() => navigate('/sqdip-board')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    📺 SQDIP Board View
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SQDIP_ORDER.map(key => {
                  const meta = SQDIP_META[key];
                  const on = sqdipEnabled[key];
                  const label = sqdipLabels[key] || meta.defaultLabel;
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => toggleSqdipLetter(key)}
                        style={{ padding: '0.4rem 0.875rem', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                          background: on ? meta.color : '#f1f5f9', color: on ? 'white' : '#94a3b8' }}>
                        <LetterIcon letterKey={key} icon={meta.icon} size="1rem" /> {label}
                      </button>
                      {meta.altLabel && on && (
                        <button onClick={() => toggleSqdipLabel(key)} title={`Switch to ${label === meta.defaultLabel ? meta.altLabel : meta.defaultLabel}`}
                          style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 9999, padding: '2px 6px', fontSize: '0.65rem', cursor: 'pointer', color: '#94a3b8' }}>
                          ⇄
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Letter cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
              {SQDIP_ORDER.filter(key => sqdipEnabled[key]).map(key => (
                <SqdipLetterCard
                  key={key}
                  letterKey={key}
                  label={sqdipLabels[key] || SQDIP_META[key].defaultLabel}
                  days={days}
                  cellStatus={sqdipCells[key] || {}}
                  onSetDay={setSqdipDay}
                  metricName={sqdipMetricNames[key] || SQDIP_META[key].defaultLabel}
                  onMetricNameChange={name => setSqdipMetricName(key, name)}
                  actionItems={sqdipActionPlans[key] || []}
                  onActionItemsChange={items => setSqdipActionItems(key, items)}
                  cellValues={sqdipValues[key] || {}}
                  onSetValue={(day, val) => setSqdipValue(key, day, val)}
                  goal={sqdipGoals[key] || {}}
                  onGoalChange={g => setSqdipGoal(key, g)}
                  monthlyHistory={sqdipMonthlyHistory[key] || []}
                />
              ))}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
