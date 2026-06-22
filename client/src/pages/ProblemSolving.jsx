import { useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const TOOLS = ['5 Whys', 'Fishbone Diagram', 'A3 Template'];

function FiveWhys() {
  const [problem, setProblem] = useState('');
  const [whys, setWhys] = useState(['','','','','']);
  const [rootCause, setRootCause] = useState('');
  const stepColors = ['#0d9488','#0d9488','#f59e0b','#f59e0b','#ef4444'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div><label className="label">Problem Statement</label><textarea className="input" rows={2} value={problem} onChange={e => setProblem(e.target.value)} placeholder="Describe the problem clearly and specifically..." /></div>
      {whys.map((w, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: stepColors[i], color: 'white', fontWeight: 900, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 20 }}>{i+1}</div>
          <div style={{ flex: 1 }}>
            <label className="label">Why #{i+1}</label>
            <textarea className="input" rows={2} value={w} onChange={e => setWhys(ws => ws.map((x,j) => j===i ? e.target.value : x))} placeholder={i === 0 ? 'Why does this problem occur?' : 'Why does that happen?'} />
          </div>
        </div>
      ))}
      <div style={{ background: '#f0fdfa', border: '1.5px solid #0d9488', borderRadius: 12, padding: '1rem' }}>
        <label className="label" style={{ color: '#0f766e' }}>Root Cause Identified</label>
        <textarea className="input" rows={2} value={rootCause} onChange={e => setRootCause(e.target.value)} placeholder="State the root cause and proposed countermeasure..." />
      </div>
      <button className="btn-primary" onClick={() => toast.success('5 Whys analysis saved!')}>Save Analysis</button>
    </div>
  );
}

function Fishbone() {
  const categories = ['People','Process','Materials','Machine','Environment','Measurement'];
  const [problem, setProblem] = useState('');
  const [causes, setCauses] = useState(() => Object.fromEntries(categories.map(c => [c,''])));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div><label className="label">Effect / Problem (Fish Head)</label><input className="input" value={problem} onChange={e => setProblem(e.target.value)} placeholder="e.g. High defect rate in Assembly Line 2" /></div>
      <div className="card" style={{ padding: '1rem', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <span style={{ display: 'inline-block', padding: '0.375rem 1.25rem', borderRadius: 10, background: '#ef4444', color: 'white', fontWeight: 700, fontSize: '0.875rem' }}>{problem || 'Effect / Problem'}</span>
        </div>
        <div style={{ height: 6, borderRadius: 9999, background: '#0f2044', marginBottom: '1rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {categories.map(cat => (
            <div key={cat} className="card" style={{ padding: '0.875rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0d9488', margin: '0 0 6px' }}>{cat}</p>
              <textarea className="input" rows={3} style={{ fontSize: '0.8rem' }} value={causes[cat]} onChange={e => setCauses(c => ({ ...c, [cat]: e.target.value }))} placeholder="Potential causes..." />
            </div>
          ))}
        </div>
      </div>
      <button className="btn-primary" onClick={() => toast.success('Fishbone diagram saved!')}>Save Diagram</button>
    </div>
  );
}

function A3Template() {
  const [form, setForm] = useState({ title:'',date:'',owner:'',background:'',currentState:'',targetState:'',rootCause:'',countermeasures:'',implementationPlan:'',followUp:'' });
  const fields = [
    { key:'title',             label:'A3 Title / Project',                          rows:1 },
    { key:'background',        label:'1. Background & Context',                     rows:3 },
    { key:'currentState',      label:'2. Current State (What is happening now?)',    rows:3 },
    { key:'targetState',       label:'3. Target State (What should happen?)',        rows:3 },
    { key:'rootCause',         label:'4. Root Cause Analysis',                      rows:3 },
    { key:'countermeasures',   label:'5. Countermeasures / Solutions',              rows:3 },
    { key:'implementationPlan',label:'6. Implementation Plan (Who, What, When)',    rows:3 },
    { key:'followUp',          label:'7. Follow-up & Results Verification',         rows:3 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><label className="label">Owner</label><input className="input" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Name" /></div>
        <div><label className="label">Date</label><input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
      </div>
      {fields.map(field => (
        <div key={field.key}>
          <label className="label">{field.label}</label>
          {field.rows === 1
            ? <input className="input" value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />
            : <textarea className="input" rows={field.rows} value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />}
        </div>
      ))}
      <button className="btn-primary" onClick={() => toast.success('A3 template saved!')}>Save A3</button>
    </div>
  );
}

export default function ProblemSolving() {
  const [activeTool, setActiveTool] = useState('5 Whys');

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHeader icon="🔍" title="Problem-Solving Tools" subtitle="5 Whys, Fishbone Diagram, and A3 Template" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {TOOLS.map(t => (
          <button key={t} onClick={() => setActiveTool(t)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: activeTool === t ? '#0f2044' : '#f1f5f9', color: activeTool === t ? 'white' : '#475569' }}>
            {t}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem', margin: '0 0 1.25rem' }}>{activeTool}</h3>
        {activeTool === '5 Whys' && <FiveWhys />}
        {activeTool === 'Fishbone Diagram' && <Fishbone />}
        {activeTool === 'A3 Template' && <A3Template />}
      </div>
    </div>
  );
}
