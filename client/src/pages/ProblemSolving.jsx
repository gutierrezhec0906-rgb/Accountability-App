import { useState } from 'react';
import toast from 'react-hot-toast';

const TOOLS = ['5 Whys', 'Fishbone Diagram', 'A3 Template'];

function FiveWhys() {
  const [problem, setProblem] = useState('');
  const [whys, setWhys] = useState(['', '', '', '', '']);
  const [rootCause, setRootCause] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Problem Statement</label>
        <textarea className="input" rows={2} value={problem} onChange={e => setProblem(e.target.value)} placeholder="Describe the problem clearly and specifically..." />
      </div>
      {whys.map((w, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 mt-1" style={{ background: i < 2 ? '#0d9488' : i < 4 ? '#f59e0b' : '#ef4444', fontSize: '0.875rem' }}>
            {i + 1}
          </div>
          <div className="flex-1">
            <label className="label">Why #{i + 1}</label>
            <textarea className="input" rows={2} value={w} onChange={e => setWhys(ws => ws.map((x, j) => j === i ? e.target.value : x))} placeholder={`Why does ${i === 0 ? 'this problem occur?' : 'that happen?'}`} />
          </div>
        </div>
      ))}
      <div className="card p-4" style={{ background: '#f0fdfa', borderColor: '#0d9488' }}>
        <label className="label" style={{ color: '#0f766e' }}>Root Cause Identified</label>
        <textarea className="input" rows={2} value={rootCause} onChange={e => setRootCause(e.target.value)} placeholder="State the root cause and proposed countermeasure..." />
      </div>
      <button className="btn-primary" onClick={() => toast.success('5 Whys analysis saved!')}>Save Analysis</button>
    </div>
  );
}

function Fishbone() {
  const categories = ['People', 'Process', 'Materials', 'Machine', 'Environment', 'Measurement'];
  const [problem, setProblem] = useState('');
  const [causes, setCauses] = useState(() => Object.fromEntries(categories.map(c => [c, ''])));

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Effect / Problem (Fish Head)</label>
        <input className="input" value={problem} onChange={e => setProblem(e.target.value)} placeholder="e.g. High defect rate in Assembly Line 2" />
      </div>
      {/* Visual fishbone */}
      <div className="card p-4" style={{ background: '#f8fafc' }}>
        <div className="text-center mb-4">
          <div className="inline-block px-4 py-2 rounded-lg text-white font-bold text-sm" style={{ background: '#ef4444' }}>
            {problem || 'Effect / Problem'}
          </div>
        </div>
        <div className="w-full h-2 rounded-full mb-4" style={{ background: '#0f2044' }} />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div key={cat} className="card p-3">
              <p className="text-xs font-bold mb-2" style={{ color: '#0d9488' }}>{cat}</p>
              <textarea className="input text-xs" rows={3} value={causes[cat]} onChange={e => setCauses(c => ({ ...c, [cat]: e.target.value }))} placeholder="Potential causes..." />
            </div>
          ))}
        </div>
      </div>
      <button className="btn-primary" onClick={() => toast.success('Fishbone diagram saved!')}>Save Diagram</button>
    </div>
  );
}

function A3Template() {
  const [form, setForm] = useState({
    title: '', date: '', owner: '',
    background: '', currentState: '', targetState: '', rootCause: '',
    countermeasures: '', implementationPlan: '', followUp: '',
  });

  const fields = [
    { key: 'title', label: 'A3 Title / Project', rows: 1 },
    { key: 'background', label: '1. Background & Context', rows: 3 },
    { key: 'currentState', label: '2. Current State (What is happening now?)', rows: 3 },
    { key: 'targetState', label: '3. Target State (What should happen?)', rows: 3 },
    { key: 'rootCause', label: '4. Root Cause Analysis', rows: 3 },
    { key: 'countermeasures', label: '5. Countermeasures / Solutions', rows: 3 },
    { key: 'implementationPlan', label: '6. Implementation Plan (Who, What, When)', rows: 3 },
    { key: 'followUp', label: '7. Follow-up & Results Verification', rows: 3 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Owner</label>
          <input className="input" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Name" />
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
      </div>
      {fields.map(field => (
        <div key={field.key}>
          <label className="label">{field.label}</label>
          {field.rows === 1
            ? <input className="input" value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />
            : <textarea className="input" rows={field.rows} value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />
          }
        </div>
      ))}
      <button className="btn-primary" onClick={() => toast.success('A3 template saved!')}>Save A3</button>
    </div>
  );
}

export default function ProblemSolving() {
  const [activeTool, setActiveTool] = useState('5 Whys');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Problem-Solving Tools</h1>
        <p className="text-slate-500 text-sm">5 Whys, Fishbone Diagram, and A3 Template</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TOOLS.map(t => (
          <button key={t} onClick={() => setActiveTool(t)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${activeTool === t ? 'text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            style={activeTool === t ? { background: '#0f2044' } : {}}>
            {t}
          </button>
        ))}
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-slate-700 text-lg mb-5">{activeTool}</h3>
        {activeTool === '5 Whys' && <FiveWhys />}
        {activeTool === 'Fishbone Diagram' && <Fishbone />}
        {activeTool === 'A3 Template' && <A3Template />}
      </div>
    </div>
  );
}
