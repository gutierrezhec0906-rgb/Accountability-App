import { useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

const sampleTasks = [
  { id: 1, name: 'Material Prep',      owner: 'Team A', weeks: { W1:100,W2:100,W3:85, W4:90, W5:0, W6:0, W7:0, W8:0 } },
  { id: 2, name: 'Frame Assembly',     owner: 'Team B', weeks: { W1:100,W2:100,W3:100,W4:75, W5:50,W6:0, W7:0, W8:0 } },
  { id: 3, name: 'Electrical Install', owner: 'Team C', weeks: { W1:0,  W2:100,W3:100,W4:100,W5:80,W6:60,W7:0, W8:0 } },
  { id: 4, name: 'Quality Inspection', owner: 'Team D', weeks: { W1:0,  W2:0,  W3:100,W4:100,W5:100,W6:100,W7:50,W8:0 } },
  { id: 5, name: 'Final Delivery',     owner: 'Team E', weeks: { W1:0,  W2:0,  W3:0,  W4:0,  W5:100,W6:100,W7:100,W8:80} },
];

function cellColor(val) {
  if (val === 0) return { bg: '#f1f5f9', text: '#94a3b8' };
  if (val >= 90) return { bg: '#dcfce7', text: '#15803d' };
  if (val >= 60) return { bg: '#fef9c3', text: '#b45309' };
  return { bg: '#fee2e2', text: '#dc2626' };
}

export default function LOB() {
  const [tasks, setTasks] = useState(sampleTasks);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', owner: '' });
  const [editing, setEditing] = useState(null);

  function addTask(e) {
    e.preventDefault();
    const weeks = Object.fromEntries(WEEKS.map(w => [w, 0]));
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
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader icon="📈" title="Line of Balance" subtitle="Visual production planning and schedule tracking"
        action={<button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Task Row</button>} />

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {[['≥90% On Track','#dcfce7','#15803d'],['60–89% At Risk','#fef9c3','#b45309'],['<60% Behind','#fee2e2','#dc2626'],['Not Started','#f1f5f9','#94a3b8']].map(([label,bg,text]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: bg, border: `1px solid ${text}30` }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <form onSubmit={addTask} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="label">Task Name</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Painting" />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="label">Owner / Team</label>
              <input className="input" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="e.g. Team F" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" type="submit">Add</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(90deg,#0f2044,#1e3a6e)' }}>
                <th style={{ textAlign: 'left', padding: '0.875rem 1.25rem', color: 'white', fontWeight: 700, fontSize: '0.8rem', minWidth: 180 }}>Task / Activity</th>
                <th style={{ textAlign: 'left', padding: '0.875rem 1rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.75rem', minWidth: 110 }}>Owner</th>
                {WEEKS.map(w => <th key={w} style={{ padding: '0.875rem 0.5rem', textAlign: 'center', color: 'white', fontWeight: 700, fontSize: '0.8rem', minWidth: 72 }}>{w}</th>)}
                <th style={{ padding: '0.875rem 0.75rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.75rem', minWidth: 56 }}>Avg</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, ti) => {
                const vals = WEEKS.map(w => task.weeks[w]);
                const active = vals.filter(v => v > 0);
                const avg = active.length ? Math.round(active.reduce((a, b) => a + b, 0) / active.length) : 0;
                const avgC = cellColor(avg);
                return (
                  <tr key={task.id} style={{ borderBottom: '1px solid var(--border)', background: ti % 2 === 0 ? '#fff' : '#fafbfd' }}>
                    <td style={{ padding: '0.75rem 1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{task.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{task.owner}</td>
                    {WEEKS.map(w => {
                      const c = cellColor(task.weeks[w]);
                      return (
                        <td key={w} style={{ padding: '0.5rem', textAlign: 'center' }}>
                          {editing === `${task.id}-${w}` ? (
                            <input autoFocus type="number" min={0} max={100} defaultValue={task.weeks[w]}
                              style={{ width: 54, textAlign: 'center', border: '2px solid #0d9488', borderRadius: 7, padding: '4px', fontSize: '0.8rem', outline: 'none' }}
                              onBlur={e => { updateCell(task.id, w, e.target.value); setEditing(null); }}
                              onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
                          ) : (
                            <button onClick={() => setEditing(`${task.id}-${w}`)}
                              style={{ width: 54, height: 30, borderRadius: 8, border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', background: c.bg, color: c.text, transition: 'all 0.15s' }}>
                              {task.weeks[w] > 0 ? `${task.weeks[w]}%` : '—'}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 800, fontSize: '0.82rem', color: avgC.text }}>{avg > 0 ? `${avg}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>Click any cell to edit the completion percentage (0–100%)</p>
    </div>
  );
}
