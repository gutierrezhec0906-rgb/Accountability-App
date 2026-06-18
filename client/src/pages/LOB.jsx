import { useState } from 'react';
import toast from 'react-hot-toast';

const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

const sampleTasks = [
  { id: 1, name: 'Material Prep', owner: 'Team A', weeks: { W1: 100, W2: 100, W3: 85, W4: 90, W5: 0, W6: 0, W7: 0, W8: 0 } },
  { id: 2, name: 'Frame Assembly', owner: 'Team B', weeks: { W1: 100, W2: 100, W3: 100, W4: 75, W5: 50, W6: 0, W7: 0, W8: 0 } },
  { id: 3, name: 'Electrical Install', owner: 'Team C', weeks: { W1: 0, W2: 100, W3: 100, W4: 100, W5: 80, W6: 60, W7: 0, W8: 0 } },
  { id: 4, name: 'Quality Inspection', owner: 'Team D', weeks: { W1: 0, W2: 0, W3: 100, W4: 100, W5: 100, W6: 100, W7: 50, W8: 0 } },
  { id: 5, name: 'Final Delivery', owner: 'Team E', weeks: { W1: 0, W2: 0, W3: 0, W4: 0, W5: 100, W6: 100, W7: 100, W8: 80 } },
];

function getColor(val) {
  if (val === 0) return '#f1f5f9';
  if (val >= 90) return '#dcfce7';
  if (val >= 60) return '#fef9c3';
  return '#fee2e2';
}
function getTextColor(val) {
  if (val === 0) return '#94a3b8';
  if (val >= 90) return '#16a34a';
  if (val >= 60) return '#ca8a04';
  return '#dc2626';
}

export default function LOB() {
  const [tasks, setTasks] = useState(sampleTasks);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', owner: '' });
  const [editing, setEditing] = useState(null);

  function addTask(e) {
    e.preventDefault();
    const weeks = {};
    WEEKS.forEach(w => weeks[w] = 0);
    setTasks(t => [...t, { ...form, id: Date.now(), weeks }]);
    setForm({ name: '', owner: '' });
    setShowForm(false);
    toast.success('Task row added');
  }

  function updateCell(taskId, week, val) {
    const num = Math.min(100, Math.max(0, parseInt(val) || 0));
    setTasks(t => t.map(task => task.id !== taskId ? task : { ...task, weeks: { ...task.weeks, [week]: num } }));
  }

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Line of Balance (LOB)</h1>
          <p className="text-slate-500 text-sm">Visual production planning and schedule tracking</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Task Row</button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        {[['≥90% (On Track)', '#dcfce7', '#16a34a'], ['60–89% (At Risk)', '#fef9c3', '#ca8a04'], ['<60% (Behind)', '#fee2e2', '#dc2626'], ['Not Started', '#f1f5f9', '#94a3b8']].map(([label, bg, text]) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-5 h-5 rounded" style={{ background: bg }} />
            <span className="text-xs font-medium text-slate-600">{label}</span>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card p-5">
          <form onSubmit={addTask} className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-40">
              <label className="label">Task Name</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Painting" />
            </div>
            <div className="flex-1 min-w-40">
              <label className="label">Owner / Team</label>
              <input className="input" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="e.g. Team F" />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" type="submit">Add</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* LOB Grid */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#0f2044' }}>
              <th className="text-left px-4 py-3 text-white font-semibold text-sm w-48">Task / Activity</th>
              <th className="text-left px-4 py-3 text-slate-300 font-medium text-sm w-32">Owner</th>
              {WEEKS.map(w => <th key={w} className="px-3 py-3 text-center text-white font-semibold text-sm w-20">{w}</th>)}
              <th className="px-3 py-3 text-center text-slate-300 font-medium text-sm w-16">Avg</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => {
              const vals = WEEKS.map(w => task.weeks[w]);
              const active = vals.filter(v => v > 0);
              const avg = active.length ? Math.round(active.reduce((a, b) => a + b, 0) / active.length) : 0;
              return (
                <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-700">{task.name}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{task.owner}</td>
                  {WEEKS.map(w => (
                    <td key={w} className="px-2 py-2 text-center">
                      {editing === `${task.id}-${w}` ? (
                        <input
                          autoFocus
                          className="w-14 text-center border border-teal-400 rounded p-1 text-sm outline-none"
                          type="number" min={0} max={100}
                          defaultValue={task.weeks[w]}
                          onBlur={e => { updateCell(task.id, w, e.target.value); setEditing(null); }}
                          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                        />
                      ) : (
                        <button
                          onClick={() => setEditing(`${task.id}-${w}`)}
                          className="w-14 h-8 rounded font-semibold text-xs transition-all"
                          style={{ background: getColor(task.weeks[w]), color: getTextColor(task.weeks[w]) }}
                        >
                          {task.weeks[w] > 0 ? `${task.weeks[w]}%` : '—'}
                        </button>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold text-sm" style={{ color: getTextColor(avg) }}>{avg > 0 ? `${avg}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 text-center">Click any cell to edit the completion percentage (0–100%)</p>
    </div>
  );
}
