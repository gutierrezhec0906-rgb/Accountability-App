import { useState, useRef, useEffect } from 'react';

// A plain text input with a "remembered names" dropdown underneath — suggests
// names the current account has previously saved in any module (owner,
// coachee, mentor, etc.), filtered as the user types. Purely additive: typing
// a brand-new name works exactly like a normal input.
export default function NameField({ value, onChange, names = [], placeholder, className = 'input', required, style, inputStyle, ...rest }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const query = (value || '').trim().toLowerCase();
  const matches = (query
    ? names.filter(n => n.toLowerCase().includes(query) && n.toLowerCase() !== query)
    : names
  ).slice(0, 8);

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <input
        className={className}
        required={required}
        value={value}
        onChange={onChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        style={inputStyle}
        {...rest}
      />
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 40,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,32,68,0.12)', maxHeight: 220, overflowY: 'auto',
        }}>
          {matches.map(n => (
            <button
              key={n}
              type="button"
              onMouseDown={e => { e.preventDefault(); onChange({ target: { value: n } }); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#334155',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              👤 {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
