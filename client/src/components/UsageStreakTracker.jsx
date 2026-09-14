// Weekly usage "streak tracker" — a 4-week Monday-to-Sunday grid showing how
// much time the user actually spent in the app each day, built from
// toolSessions (the same source scoring's breadth/frequency/depth and the
// weekly report already read — see Layout.jsx's session tracking and
// CLAUDE.md's "Tool-usage tracking" note). Cell shading: strong blue = 5+
// minutes that day, light blue = some usage under 5 minutes, blank = none.

const DAY_LABELS = ['M', 'T', 'W', 'Th', 'F', 'S', 'Su'];
const STRONG_BLUE = '#3b82f6';
const LIGHT_BLUE = '#bfdbfe';
const BLANK = '#f8fafc';

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function UsageStreakTracker({ toolSessions = [] }) {
  const minutesByDate = {};
  toolSessions.forEach(s => {
    if (!s.date) return;
    minutesByDate[s.date] = (minutesByDate[s.date] || 0) + (s.durationSeconds || 0) / 60;
  });

  const thisMonday = mondayOf(new Date());
  // Oldest week first (Week 1) through the current week (Week 4), like the
  // reference sketch — always exactly the last 4 Monday-Sunday weeks.
  const weeks = [3, 2, 1, 0].map(weeksAgo => {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(weekStart.getDate() - weeksAgo * 7);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const mins = minutesByDate[dateKey(d)] || 0;
      return { date: d, minutes: mins };
    });
    const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0);
    return { days, totalMinutes };
  });

  const avgWeeklyMinutes = weeks.reduce((sum, w) => sum + w.totalMinutes, 0) / weeks.length;
  const today = dateKey(new Date());

  function cellColor(mins) {
    if (mins > 5) return STRONG_BLUE;
    if (mins > 0) return LIGHT_BLUE;
    return BLANK;
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, padding: '0 8px 6px 0' }}></th>
              {DAY_LABELS.map(l => (
                <th key={l} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, padding: '0 4px 6px', width: 34 }}>{l}</th>
              ))}
              <th style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, padding: '0 0 6px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Total min./week</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, wi) => (
              <tr key={wi}>
                <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, paddingRight: 8, whiteSpace: 'nowrap' }}>Week {wi + 1}</td>
                {w.days.map((d, di) => {
                  const isToday = dateKey(d.date) === today;
                  return (
                    <td key={di} style={{ padding: 3 }}>
                      <div title={`${d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${Math.round(d.minutes)} min`}
                        style={{
                          width: 30, height: 30, borderRadius: 6, background: cellColor(d.minutes),
                          border: isToday ? '2px solid #0f2044' : '1px solid #e2e8f0',
                          margin: '0 auto',
                        }} />
                    </td>
                  );
                })}
                <td style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', paddingLeft: 10, whiteSpace: 'nowrap' }}>
                  {Math.round(w.totalMinutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: STRONG_BLUE, display: 'inline-block' }} /> 5+ min
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: LIGHT_BLUE, display: 'inline-block' }} /> Under 5 min
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: BLANK, border: '1px solid #e2e8f0', display: 'inline-block' }} /> No usage
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Avg. minutes/week (last 4 weeks): <span style={{ color: '#0d9488' }}>{avgWeeklyMinutes.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
