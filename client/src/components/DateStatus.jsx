// Returns status info for a YYYY-MM-DD date string relative to today.
export function getDateStatus(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((due - today) / 86400000);

  // App-wide accountability convention:
  //   red   = past due, yellow = coming due within 2 weeks, green = on track (>2 weeks out)
  if (diffDays < 0)   return { level: 'overdue', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', icon: '🚨', label: 'Past Due' };
  if (diffDays <= 14) return { level: 'warning', color: '#b45309', bg: '#fef9c3', border: '#fde68a', icon: '⚠️', label: 'Due Soon' };
  return                     { level: 'ontrack', color: '#15803d', bg: '#dcfce7', border: '#86efac', icon: '✅', label: 'On Track' };
}

// Tiered color for a recommitment counter — the more times an item has slipped
// and been rescheduled, the hotter the color, so repeat offenders stand out:
//   1st recommitment → yellow, 2nd → orange, 3rd+ → red.
export function recommitColor(count) {
  if (count >= 3) return { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' };
  if (count === 2) return { color: '#c2410c', bg: '#ffedd5', border: '#fdba74' };
  return { color: '#b45309', bg: '#fef9c3', border: '#fde68a' }; // 1st
}

// Same tiering, styled for dark backgrounds (e.g. the TeamBoard TV display),
// where a light bg/border reads better as a low-opacity tint of the color.
export function recommitColorDark(count) {
  if (count >= 3) return { color: '#f87171', bg: 'rgba(248,113,113,0.14)' };
  if (count === 2) return { color: '#fb923c', bg: 'rgba(251,146,60,0.14)' };
  return { color: '#facc15', bg: 'rgba(250,204,21,0.14)' }; // 1st
}

// Inline "🔄 N recommitment(s)" badge, colored by recommitColor. Renders nothing
// when count is 0/undefined — safe to drop in unconditionally.
export function RecommitBadge({ count, dark = false, style = {} }) {
  if (!count || count < 1) return null;
  const c = dark ? recommitColorDark(count) : recommitColor(count);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      padding: '1px 8px', borderRadius: 9999, fontSize: '0.7rem', fontWeight: 700,
      background: c.bg, color: c.color, border: dark ? 'none' : `1px solid ${c.border}`,
      ...style,
    }}>
      🔄 {count} recommitment{count > 1 ? 's' : ''}
    </span>
  );
}

// Inline badge: shows icon + label + date
export default function DateStatus({ date, prefix = '' }) {
  const s = getDateStatus(date);
  if (!s) return null;
  const display = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.icon} {s.label} {prefix && `· ${prefix}`}{display}
    </span>
  );
}
