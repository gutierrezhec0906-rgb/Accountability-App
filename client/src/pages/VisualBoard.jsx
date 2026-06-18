import { useState } from 'react';
import toast from 'react-hot-toast';

const STATUSES = ['Green', 'Yellow', 'Red'];
const statusColors = {
  Green: { bg: '#dcfce7', text: '#16a34a', dot: '#22c55e' },
  Yellow: { bg: '#fef9c3', text: '#ca8a04', dot: '#eab308' },
  Red: { bg: '#fee2e2', text: '#dc2626', dot: '#ef4444' },
};

const sample = [
  { id: 1, title: 'Q3 Production Target', status: 'Green', owner: 'Jane Smith', dueDate: '2024-09-30', escalated: false, notes: 'On track — 102% of plan' },
  { id: 2, title: 'Safety Audit Corrective Actions', status: 'Yellow', owner: 'Mike Torres', dueDate: '2024-08-15', escalated: true, notes: '3 of 7 items closed' },
  { id: 3, title: 'Team Training Completion', status: 'Red', owner: 'Sara Lee', dueDate: '2024-07-31', escalated: true, notes: 'Only 40% complete — at risk' },
  { id: 4, title: 'Supplier Scorecard Review', status: 'Green', owner: 'David Kim', dueDate: '2024-10-01', escalated: false, notes: 'All vendors above 90%' },
  { id: 5, title: 'Lean Event Follow-up', status: 'Yellow', owner: 'Ana Reyes', dueDate: '2024-08-20', escalated: false, notes: 'Kaizen items 60% done' },
];

export default function VisualBoard() {
  const [items, setItems] = useState(sample);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('All');
  const [form, setForm] = useState({ title: '', status: 'Green', owner: '', dueDate: '', notes: '' });

  function handleAdd(e) {
    e.preventDefault();
    const newItem = { ...form, id: Date.now(), escalated: form.status === 'Red' };
    setItems(i => [...i, newItem]);
    setForm({ title: '', status: 'Green', owner: '', dueDate: '', notes: '' });
    setShowForm(false);
    toast.success('Item added to board');
  }

  function cycleStatus(id) {
    setItems(items => items.map(item => {
      if (item.id !== id) return item;
      const idx = STATUSES.indexOf(item.status);
      const next = STATUSES[(idx + 1) % STATUSES.length];
      return { ...item, status: next, escalated: next === 'Red' };
    }));
  }

  function deleteItem(id) {
    setItems(i => i.filter(x => x.id !== id));
    toast.success('Item removed');
  }

  const filtered = filter === 'All' ? items : items.filter(i => i.status === filter);
  const counts = { Green: items.filter(i => i.status === 'Green').length, Yellow: items.filter(i => i.status === 'Yellow').length, Red: items.filter(i => i.status === 'Red').length };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Visual Management Board</h1>
          <p className="text-slate-500 text-sm">Escalation tracker with real-time status visibility</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Item</button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-3 gap-4">
        {STATUSES.map(s => (
          <div key={s} className="card p-4 text-center cursor-pointer hover:shadow-md transition-shadow" style={{ borderLeft: `4px solid ${statusColors[s].dot}` }} onClick={() => setFilter(f => f === s ? 'All' : s)}>
            <div className="text-3xl font-bold" style={{ color: statusColors[s].dot }}>{counts[s]}</div>
            <div className="text-sm font-semibold text-slate-600">{s}</div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-700 mb-4">New Escalation Item</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Title / Issue</label>
              <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Describe the issue..." />
            </div>
            <div>
              <label className="label">Owner</label>
              <input className="input" required value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Responsible person" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional details..." />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button className="btn-primary" type="submit">Add to Board</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['All', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === s ? 'text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            style={filter === s ? { background: s === 'All' ? '#0f2044' : statusColors[s].dot } : {}}>
            {s} {s !== 'All' ? `(${counts[s]})` : `(${items.length})`}
          </button>
        ))}
      </div>

      {/* Board */}
      <div className="space-y-3">
        {filtered.map(item => {
          const c = statusColors[item.status];
          return (
            <div key={item.id} className="card p-4 flex items-start gap-4" style={{ borderLeft: `4px solid ${c.dot}` }}>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-800">{item.title}</h4>
                  {item.escalated && <span className="badge-red">Escalated</span>}
                </div>
                <p className="text-sm text-slate-500 mt-1">{item.notes}</p>
                <div className="flex gap-4 mt-2 text-xs text-slate-400">
                  <span>👤 {item.owner}</span>
                  {item.dueDate && <span>📅 Due: {item.dueDate}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => cycleStatus(item.id)} className="px-3 py-1 rounded-full text-xs font-semibold cursor-pointer" style={{ background: c.bg, color: c.text }}>
                  {item.status}
                </button>
                <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-400 text-lg leading-none">×</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="card p-8 text-center text-slate-400">No items for this filter</div>}
      </div>
    </div>
  );
}
