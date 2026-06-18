import { useState } from 'react';
import toast from 'react-hot-toast';

const sampleSessions = [
  {
    id: 1, date: '2024-07-15', coachee: 'Marcus Johnson', type: 'Performance', duration: '45 min',
    notes: 'Discussed Q2 performance gaps. Marcus needs support with prioritization and delegation.',
    actionItems: ['Complete time-management worksheet by 7/22', 'Shadow Sara in daily stand-ups', 'Read "The One Thing" chapter 3'],
    nextSession: '2024-07-29',
  },
  {
    id: 2, date: '2024-07-10', coachee: 'Elena Martinez', type: 'Development', duration: '30 min',
    notes: 'Career growth conversation. Elena is interested in transitioning to a project lead role.',
    actionItems: ['Complete PMP prep course', 'Lead next Kaizen event', 'Present at team meeting 7/18'],
    nextSession: '2024-07-24',
  },
];

const sessionTypes = ['Performance', 'Development', 'Disciplinary', 'Recognition', 'Career', 'General'];

export default function Coaching() {
  const [sessions, setSessions] = useState(sampleSessions);
  const [showForm, setShowForm] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [form, setForm] = useState({ date: '', coachee: '', type: 'Performance', duration: '', notes: '', actionItems: '', nextSession: '' });

  function addSession(e) {
    e.preventDefault();
    const newSession = {
      ...form,
      id: Date.now(),
      actionItems: form.actionItems.split('\n').filter(Boolean),
    };
    setSessions(s => [newSession, ...s]);
    setForm({ date: '', coachee: '', type: 'Performance', duration: '', notes: '', actionItems: '', nextSession: '' });
    setShowForm(false);
    toast.success('Session logged');
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Coaching Log</h1>
          <p className="text-slate-500 text-sm">Document sessions, notes, and action items</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Log Session</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Sessions', value: sessions.length, icon: '📝' },
          { label: 'Coachees', value: new Set(sessions.map(s => s.coachee)).size, icon: '👥' },
          { label: 'Pending Actions', value: sessions.reduce((a, s) => a + (s.actionItems?.length || 0), 0), icon: '✅' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl">{s.icon}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: '#0d9488' }}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-700 mb-4">New Coaching Session</h3>
          <form onSubmit={addSession} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Coachee Name</label>
              <input className="input" required value={form.coachee} onChange={e => setForm(f => ({ ...f, coachee: e.target.value }))} placeholder="Team member name" />
            </div>
            <div>
              <label className="label">Session Type</label>
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {sessionTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Duration</label>
              <input className="input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 45 min" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Session Notes</label>
              <textarea className="input" required rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Key discussion points, observations, commitments made..." />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Action Items (one per line)</label>
              <textarea className="input" rows={3} value={form.actionItems} onChange={e => setForm(f => ({ ...f, actionItems: e.target.value }))} placeholder="Complete worksheet by date&#10;Read chapter 3&#10;Shadow team lead" />
            </div>
            <div>
              <label className="label">Next Session Date</label>
              <input className="input" type="date" value={form.nextSession} onChange={e => setForm(f => ({ ...f, nextSession: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button className="btn-primary" type="submit">Save Session</button>
              <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions */}
      <div className="space-y-4">
        {sessions.map(s => (
          <div key={s.id} className="card p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-800">{s.coachee}</h4>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: '#0d9488' }}>{s.type}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">📅 {s.date} · ⏱ {s.duration}</p>
              </div>
              <button className="text-teal-600 text-xs font-semibold hover:underline" onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}>
                {selectedSession?.id === s.id ? 'Collapse' : 'View Details'}
              </button>
            </div>
            {selectedSession?.id === s.id && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Session Notes</p>
                  <p className="text-sm text-slate-700">{s.notes}</p>
                </div>
                {s.actionItems?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Action Items</p>
                    <ul className="space-y-1">
                      {s.actionItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="mt-0.5 text-teal-500">→</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.nextSession && <p className="text-xs text-slate-400">📅 Next session: <strong>{s.nextSession}</strong></p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
