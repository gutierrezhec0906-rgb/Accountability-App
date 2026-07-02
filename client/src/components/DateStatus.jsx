// Returns status info for a YYYY-MM-DD date string relative to today.
export function getDateStatus(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((due - today) / 86400000);

  if (diffDays < 0)  return { level: 'overdue',   color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', icon: '🚨', label: 'Past Due' };
  if (diffDays <= 15) return { level: 'warning',   color: '#b45309', bg: '#fef9c3', border: '#fde68a', icon: '⚠️', label: 'Almost There?' };
  return               { level: 'ontrack',   color: '#15803d', bg: '#dcfce7', border: '#86efac', icon: '✅', label: 'In Process' };
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
