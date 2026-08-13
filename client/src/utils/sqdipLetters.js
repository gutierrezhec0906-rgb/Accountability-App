export const SQDIP_META = {
  S: { key: 'S', defaultLabel: 'Safety',    icon: '🦺', color: '#ef4444' },
  Q: { key: 'Q', defaultLabel: 'Quality',   icon: '✅', color: '#0d9488' },
  D: { key: 'D', defaultLabel: 'Delivery',  icon: '🚚', color: '#2563eb' },
  I: { key: 'I', defaultLabel: 'Inventory', icon: '📦', color: '#f59e0b', altLabel: 'Cost' },
  P: { key: 'P', defaultLabel: 'People',    icon: '🤝', color: '#7c3aed', altLabel: 'Productivity' },
};

export const SQDIP_ORDER = ['S', 'Q', 'D', 'I', 'P'];

export function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}
