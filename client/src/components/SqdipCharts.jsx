// Shared pieces of the SQDIP Board's weekly charts, used both by the
// editable board (EQOpEx.jsx) and the read-only TV presentation view
// (SqdipBoard.jsx) so the two stay visually consistent.
export const SQDIP_COLORS = { green: '#16a34a', amber: '#f59e0b', red: '#dc2626' };
export const SQDIP_STATUS_LABEL = { green: 'Meet Goal', amber: 'Behind Goal', red: 'At Risk' };
export const ACTION_STATUS = {
  open:    { label: 'Open',    color: '#2563eb', bg: '#eff6ff' },
  pending: { label: 'Pending', color: '#b45309', bg: '#fef9c3' },
  atrisk:  { label: 'At Risk', color: '#dc2626', bg: '#fee2e2' },
};

// Bucket a letter's day statuses into ISO-ish weeks (WK1 = days 1-7, etc.)
// for the two charts below each letter card. Weekly buckets combine both
// data sources: the day-square status counts (always available) and, when
// the user has logged actual numbers, the sum of those values for the
// week. Charts prefer real values once a goal is set or any values exist —
// falling back to status counts keeps older boards (logged before numeric
// capture existed) still rendering something meaningful.
export function weeklyStatusCounts(cellStatus, cellValues, days) {
  const weeks = Math.ceil(days / 7);
  return Array.from({ length: weeks }, (_, w) => {
    const start = w * 7 + 1, end = Math.min((w + 1) * 7, days);
    const counts = { green: 0, amber: 0, red: 0 };
    let value = 0, hasValue = false;
    for (let d = start; d <= end; d++) {
      const s = cellStatus[d];
      if (s) counts[s]++;
      const v = cellValues?.[d];
      if (v !== undefined && v !== null && v !== '') { value += Number(v) || 0; hasValue = true; }
    }
    return { label: `WK${w + 1}`, ...counts, value, hasValue };
  });
}

// The 🦺 emoji renders in its own fixed colors (can't be tinted via CSS) and
// is hard to see against Safety's red header — swap in a yellow SVG vest so
// it actually stands out, keep every other letter's emoji as-is.
export function LetterIcon({ letterKey, icon, size = '1.2rem' }) {
  if (letterKey !== 'S') return <span style={{ fontSize: size }}>{icon}</span>;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'inline-block', verticalAlign: '-0.15em' }}>
      <path d="M9 2h6l1.5 3H16v15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5H7.5L9 2z" fill="#facc15" stroke="#78350f" strokeWidth="0.6" strokeLinejoin="round" />
      <path d="M8 9h8M8 13h8" stroke="#78350f" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function weekWorstColor(wk) {
  const total = wk.green + wk.amber + wk.red;
  return wk.red > 0 ? SQDIP_COLORS.red : wk.amber > 0 ? SQDIP_COLORS.amber : total > 0 ? SQDIP_COLORS.green : '#e2e8f0';
}

// Small self-contained SVG bar chart — no charting library, matches the
// house style already used for Dashboard's Sparkline and Lean's Pareto chart.
// Draws a dashed goal line when a target has been set for this letter.
export function WeeklyBarChart({ weeks, metricName, goal }) {
  const w = 320, h = 150, padL = 26, padB = 22, padT = 10, padR = 8;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const target = goal?.target;
  const goalSet = target !== undefined && target !== null && target !== '';
  const useValues = goalSet || weeks.some(wk => wk.hasValue);
  const barVals = weeks.map(wk => useValues ? wk.value : wk.green + wk.amber + wk.red);
  const hasGoal = useValues && goalSet;
  const yTicks = 5;
  const rawMax = Math.max(1, ...barVals, goalSet ? Number(target) : 0);
  const maxVal = Math.ceil(rawMax / yTicks) * yTicks;
  const barW = plotW / weeks.length * 0.55;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = padT + plotH - (i / yTicks) * plotH;
        const val = Math.round((maxVal / yTicks) * i);
        return (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#eef2f7" strokeWidth="1" />
            <text x={padL - 6} y={y + 3} fontSize="7" fill="#94a3b8" textAnchor="end">{val}</text>
          </g>
        );
      })}
      {weeks.map((wk, i) => {
        const x = padL + (i + 0.5) * (plotW / weeks.length) - barW / 2;
        const val = barVals[i];
        const color = useValues
          ? (hasGoal
              ? (goal.direction === 'min' ? (val < target ? SQDIP_COLORS.red : val === target ? SQDIP_COLORS.amber : SQDIP_COLORS.green)
                                           : (val > target ? SQDIP_COLORS.red : val === target ? SQDIP_COLORS.amber : SQDIP_COLORS.green))
              : (val > 0 ? '#2563eb' : '#e2e8f0'))
          : weekWorstColor(wk);
        const barH = (val / maxVal) * plotH;
        return (
          <g key={wk.label}>
            <rect x={x} y={padT + plotH - barH} width={barW} height={Math.max(barH, val > 0 ? 2 : 0)} fill={color} rx="2" />
            {useValues && val > 0 && <text x={x + barW / 2} y={padT + plotH - barH - 3} fontSize="7" fill="#475569" textAnchor="middle">{val}</text>}
            <text x={x + barW / 2} y={h - 6} fontSize="7.5" fill="#64748b" textAnchor="middle">{wk.label}</text>
          </g>
        );
      })}
      {goalSet && (
        <>
          <line x1={padL} x2={w - padR} y1={padT + plotH - (Number(target) / maxVal) * plotH} y2={padT + plotH - (Number(target) / maxVal) * plotH} stroke="#0ea5e9" strokeWidth="1.25" strokeDasharray="4,2" />
          <text x={w - padR} y={padT + plotH - (Number(target) / maxVal) * plotH - 3} fontSize="7" fill="#0ea5e9" textAnchor="end">Goal {target}</text>
        </>
      )}
      <text x={padL} y={10} fontSize="7.5" fill="#94a3b8">{metricName}</text>
    </svg>
  );
}

// Second chart — same weekly buckets as a trend line (dots colored by that
// week's dominant status, plus a 2-point moving-average trend line).
export function WeeklyTrendChart({ weeks, goal }) {
  const w = 320, h = 150, padL = 26, padB = 22, padT = 10, padR = 8;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const target = goal?.target;
  const goalSet = target !== undefined && target !== null && target !== '';
  const useValues = goalSet || weeks.some(wk => wk.hasValue);
  const totals = weeks.map(wk => useValues ? wk.value : wk.green + wk.amber + wk.red);
  const hasGoal = useValues && goalSet;
  const rawMax = Math.max(1, ...totals, goalSet ? Number(target) : 0);
  const maxVal = Math.ceil(rawMax / 5) * 5;
  const stepX = weeks.length > 1 ? plotW / (weeks.length - 1) : 0;
  const pts = totals.map((v, i) => [padL + i * stepX, padT + plotH - (v / maxVal) * plotH]);
  const trend = totals.map((_, i) => {
    const lo = Math.max(0, i - 1), hi = Math.min(totals.length - 1, i + 1);
    const slice = totals.slice(lo, hi + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const trendPts = trend.map((v, i) => [padL + i * stepX, padT + plotH - (v / maxVal) * plotH]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const trendLine = trendPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {Array.from({ length: 5 + 1 }).map((_, i) => {
        const y = padT + plotH - (i / 5) * plotH;
        return <line key={i} x1={padL} x2={w - padR} y1={y} y2={y} stroke="#eef2f7" strokeWidth="1" />;
      })}
      {goalSet && (
        <line x1={padL} x2={w - padR} y1={padT + plotH - (Number(target) / maxVal) * plotH} y2={padT + plotH - (Number(target) / maxVal) * plotH} stroke="#0ea5e9" strokeWidth="1.25" strokeDasharray="4,2" />
      )}
      <path d={trendLine} fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3,2" />
      <path d={line} fill="none" stroke="#1e293b" strokeWidth="1.5" />
      {weeks.map((wk, i) => {
        const [x, y] = pts[i];
        const color = useValues
          ? (hasGoal ? (goal.direction === 'min' ? (totals[i] < target ? SQDIP_COLORS.red : totals[i] === target ? SQDIP_COLORS.amber : SQDIP_COLORS.green)
                                                  : (totals[i] > target ? SQDIP_COLORS.red : totals[i] === target ? SQDIP_COLORS.amber : SQDIP_COLORS.green))
                     : (totals[i] > 0 ? '#2563eb' : '#cbd5e1'))
          : weekWorstColor(wk);
        return (
          <g key={wk.label}>
            <circle cx={x} cy={y} r="3.5" fill={color} />
            <text x={x} y={h - 6} fontSize="7.5" fill="#64748b" textAnchor="middle">{wk.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
