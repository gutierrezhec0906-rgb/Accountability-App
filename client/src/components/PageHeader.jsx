export default function PageHeader({ icon, title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 16, marginBottom: '1.75rem',
      paddingBottom: '1.25rem',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {icon && (
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, #0f2044, #1e3a6e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.375rem',
            boxShadow: '0 4px 16px rgba(15,32,68,0.2)',
          }}>
            {icon}
          </div>
        )}
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>{title}</h1>
          {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '3px 0 0', fontWeight: 400 }}>{subtitle}</p>}
        </div>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
