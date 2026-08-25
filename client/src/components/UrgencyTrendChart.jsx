// Line chart of the average score (1-5) from the last 8 Sense of Urgency
// assessments (individual + team surveys combined, chronological). Shared
// between the Urgency module (full history context) and the Dashboard
// (compact "last 8" glance), so both stay visually consistent.
export default function UrgencyTrendChart({ records }) {
  const last8 = [...records]
    .filter(r => r.avg != null)
    .sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt))
    .slice(-8);

  const W = 480, H = 160, PAD_L = 30, PAD_R = 16, PAD_T = 18, PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  if (last8.length === 0) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', textAlign: 'center', padding: '0 1rem' }}>
        No assessments saved yet — rate the tips above and save a survey to start your trend.
      </div>
    );
  }

  function px(i) { return last8.length === 1 ? PAD_L + chartW / 2 : PAD_L + (i / (last8.length - 1)) * chartW; }
  function py(v) { return PAD_T + chartH - (v / 5) * chartH; }

  const pts = last8.map((r, i) => [px(i), py(r.avg)]);
  const linePts = pts.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {[0, 1, 2, 3, 4, 5].map(tick => {
        const y = py(tick);
        return (
          <g key={tick}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{tick}</text>
          </g>
        );
      })}

      <polyline points={linePts} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {pts.map(([x, y], i) => {
        const r = last8[i];
        const color = r.type === 'team' ? '#1d4ed8' : '#7c3aed';
        return <circle key={r.id} cx={x} cy={y} r="4" fill="white" stroke={color} strokeWidth="2.5" />;
      })}

      {last8.map((r, i) => (
        <text key={r.id} x={px(i)} y={H - 6} textAnchor="middle" fontSize="9.5" fill="#94a3b8">
          {new Date(r.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      ))}

      <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}
