import { useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const STATUSES = ['Green', 'Yellow', 'Red'];
const statusColors = {
  Green:  { bg: '#dcfce7', text: '#15803d', dot: '#22c55e', light: '#f0fdf4' },
  Yellow: { bg: '#fef9c3', text: '#b45309', dot: '#eab308', light: '#fefce8' },
  Red:    { bg: '#fee2e2', text: '#dc2626', dot: '#ef4444', light: '#fff1f2' },
};

const sample = [
  { id: 1, title: 'Q3 Production Target',           status: 'Green',  owner: 'Jane Smith',  dueDate: '2024-09-30', escalated: false, notes: 'On track — 102% of plan' },
  { id: 2, title: 'Safety Audit Corrective Actions', status: 'Yellow', owner: 'Mike Torres', dueDate: '2024-08-15', escalated: true,  notes: '3 of 7 items closed' },
  { id: 3, title: 'Team Training Completion',        status: 'Red',    owner: 'Sara Lee',    dueDate: '2024-07-31', escalated: true,  notes: 'Only 40% complete — at risk' },
  { id: 4, title: 'Supplier Scorecard Review',       status: 'Green',  owner: 'David Kim',   dueDate: '2024-10-01', escalated: false, notes: 'All vendors above 90%' },
  { id: 5, title: 'Lean Event Follow-up',            status: 'Yellow', owner: 'Ana Reyes',   dueDate: '2024-08-20', escalated: false, notes: 'Kaizen items 60% done' },
];

export default function VisualBoard() {
  const [items, setItems] = useState(sample);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('All');
  const [form, setForm] = useState({ title: '', status: 'Green', owner: '', dueDate: '', notes: '' });

  function handleAdd(e) {
    e.preventDefault();
    setItems(i => [...i, { ...form, id: Date.now(), escalated: form.status === 'Red' }]);
    setForm({ title: '', status: 'Green', owner: '', dueDate: '', notes: '' });
    setShowForm(false);
    toast.success('Item added to board');
  }

  function cycleStatus(id) {
    setItems(items => items.map(item => {
      if (item.id !== id) return item;
      const next = STATUSES[(STATUSES.indexOf(item.status) + 1) % STATUSES.length];
      return { ...item, status: next, escalated: next === 'Red' };
    }));
  }

  function deleteItem(id) { setItems(i => i.filter(x => x.id !== id)); toast.success('Item removed'); }

  const filtered = filter === 'All' ? items : items.filter(i => i.status === filter);
  const counts = { Green: items.filter(i => i.status === 'Green').length, Yellow: items.filter(i => i.status === 'Yellow').length, Red: items.filter(i => i.status === 'Red').length };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon="🔴" title="Visual Management Board" subtitle="Escalation tracker with real-time status visibility"
        action={<button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Item</button>} />

      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {STATUSES.map(s => (
          <div key={s} onClick={() => setFilter(f => f === s ? 'All' : s)}
            style={{ background: filter === s ? statusColors[s].light : '#fff', border: `1.5px solid ${filter === s ? statusColors[s].dot : 'var(--border)'}`, borderRadius: 14, padding: '1rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.18s', boxShadow: '0 2px 8px rgba(15,32,68,0.05)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColors[s].dot, margin: '0 auto 8px' }} />
            <p style={{ fontSize: '2rem', fontWeight: 900, color: statusColors[s].dot, margin: 0, lineHeight: 1 }}>{counts[s]}</p>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: statusColors[s].text, margin: '4px 0 0' }}>{s}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>New Escalation Item</h3>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label className="label">Title / Issue</label><input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Describe the issue..." /></div>
            <div><label className="label">Owner</label><input className="input" required value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Responsible person" /></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Due Date</label><input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1' }}><label className="label">Notes</label><textarea className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional details..." /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">Add to Board</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['All', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '0.375rem 1rem', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: filter === s ? (s === 'All' ? '#0f2044' : statusColors[s].dot) : '#f1f5f9',
              color: filter === s ? '#fff' : '#475569' }}>
            {s} ({s === 'All' ? items.length : counts[s]})
          </button>
        ))}
      </div>

      {/* Board items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(item => {
          const c = statusColors[item.status];
          return (
            <div key={item.id} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: 14, borderLeft: `4px solid ${c.dot}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.9375rem' }}>{item.title}</h4>
                  {item.escalated && <span className="badge-red">Escalated</span>}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8375rem', margin: '0 0 6px', lineHeight: 1.5 }}>{item.notes}</p>
                <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>👤 {item.owner}</span>
                  {item.dueDate && <span>📅 Due: {item.dueDate}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button onClick={() => cycleStatus(item.id)}
                  style={{ background: c.bg, color: c.text, border: 'none', borderRadius: 9999, padding: '0.3rem 0.875rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                  {item.status}
                </button>
                <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No items for this filter</div>}
      </div>
    </div>
  );
}
