import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const TOOLS = ['5 Whys', 'Fishbone Diagram', 'A3 Template'];


// ─── 5 Whys ──────────────────────────────────────────────────────────────────
function FiveWhys({ onSave }) {
  const [problem,   setProblem]   = useState('');
  const [whys,      setWhys]      = useState(['', '', '', '', '']);
  const [rootCause, setRootCause] = useState('');
  const stepColors = ['#0d9488', '#0d9488', '#f59e0b', '#f59e0b', '#ef4444'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className="label">Problem Statement</label>
        <textarea className="input" rows={2} value={problem} onChange={e => setProblem(e.target.value)} placeholder="Describe the problem clearly and specifically..." />
      </div>
      {whys.map((w, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: stepColors[i], color: 'white', fontWeight: 900, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 20 }}>{i + 1}</div>
          <div style={{ flex: 1 }}>
            <label className="label">Why #{i + 1}</label>
            <textarea className="input" rows={2} value={w} onChange={e => setWhys(ws => ws.map((x, j) => j === i ? e.target.value : x))} placeholder={i === 0 ? 'Why does this problem occur?' : 'Why does that happen?'} />
          </div>
        </div>
      ))}
      <div style={{ background: '#f0fdfa', border: '1.5px solid #0d9488', borderRadius: 12, padding: '1rem' }}>
        <label className="label" style={{ color: '#0f766e' }}>Root Cause Identified</label>
        <textarea className="input" rows={2} value={rootCause} onChange={e => setRootCause(e.target.value)} placeholder="State the root cause and proposed countermeasure..." />
      </div>
      <button className="btn-primary" onClick={() => onSave({ type: '5whys', title: problem || 'Untitled 5 Whys', data: { problem, whys, rootCause } })}>Save Analysis</button>
    </div>
  );
}

// ─── Fishbone ─────────────────────────────────────────────────────────────────
function CatCard({ cat, position, causes, onUpdate }) {
  const clip = position === 'top'
    ? 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)'
    : 'polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%)';
  return (
    <div style={{ background: 'white', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 6px rgba(15,32,68,0.08)', border: '1px solid #e8edf5' }}>
      <div style={{ padding: '5px 14px', background: cat.color, color: 'white', fontWeight: 700, fontSize: '0.78rem', clipPath: clip }}>
        {cat.label}
      </div>
      <div style={{ padding: '7px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {causes[cat.id].map((v, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: cat.color, fontSize: '0.68rem', fontWeight: 900, flexShrink: 0 }}>→</span>
            <input
              style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 7px', fontSize: '0.75rem', outline: 'none', color: '#475569', background: 'white' }}
              value={v}
              onChange={e => onUpdate(cat.id, i, e.target.value)}
              placeholder={`Cause ${i + 1}...`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const TOP_CATS    = [
  { id: 'people',      label: 'People',      color: '#0d9488' },
  { id: 'process',     label: 'Process',     color: '#1e3a6e' },
  { id: 'materials',   label: 'Materials',   color: '#f59e0b' },
];
const BOTTOM_CATS = [
  { id: 'machine',     label: 'Machine',     color: '#0d9488' },
  { id: 'environment', label: 'Environment', color: '#1e3a6e' },
  { id: 'measurement', label: 'Measurement', color: '#f59e0b' },
];
const ALL_CATS = [...TOP_CATS, ...BOTTOM_CATS];
const emptyCauses = () => Object.fromEntries(ALL_CATS.map(c => [c.id, ['', '', '']]));


function Fishbone({ onSave }) {
  const [name,    setName]    = useState('');
  const [problem, setProblem] = useState('');
  const [causes,  setCauses]  = useState(emptyCauses);
  const [saving,  setSaving]  = useState(false);
  const printRef = useRef();

  function updateCause(catId, idx, val) {
    setCauses(c => ({ ...c, [catId]: c[catId].map((v, i) => i === idx ? val : v) }));
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Please enter a diagram name before saving');
    setSaving(true);
    await onSave({ type: 'fishbone', title: name, data: { name, problem, causes } });
    setName(''); setProblem(''); setCauses(emptyCauses());
    setSaving(false);
  }

  function handlePrint() {
    const printContent = document.getElementById('fishbone-print').innerHTML;
    const win = window.open('', '_blank', 'width=1000,height=750');
    win.document.write(`
      <html><head><title>${name || 'Fishbone Diagram'}</title>
      <style>
        body { margin: 0; font-family: sans-serif; }
        @media print { @page { size: landscape; margin: 12mm; } }
      </style></head>
      <body>${printContent}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Name + Effect row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="label">Diagram Name *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q3 Defect Analysis" />
        </div>
        <div>
          <label className="label">Effect / Problem (Fish Head)</label>
          <input className="input" value={problem} onChange={e => setProblem(e.target.value)} placeholder="e.g. High defect rate in Assembly Line 2" />
        </div>
      </div>

      {/* ── Fishbone diagram ── */}
      <div ref={printRef} style={{ background: '#f8fafc', borderRadius: 16, padding: '12px', border: '1px solid #e8edf5' }}>
        <div id="fishbone-print" style={{ background: 'white', borderRadius: 12, padding: 10 }}>
          {/* Print header — hidden on screen */}
          <div className="print-only" style={{ display: 'none', marginBottom: 12, borderBottom: '2px solid #0f2044', paddingBottom: 10 }}>
            <h2 style={{ margin: '0 0 4px', color: '#0f2044', fontSize: '1.1rem', fontWeight: 900 }}>Fishbone (Ishikawa) Diagram</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}><strong>Name:</strong> {name || '—'} &nbsp;|&nbsp; <strong>Effect:</strong> {problem || '—'} &nbsp;|&nbsp; <strong>Date:</strong> {new Date().toLocaleDateString()}</p>
          </div>

          {/* Top cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {TOP_CATS.map(cat => <CatCard key={cat.id} cat={cat} position="top" causes={causes} onUpdate={updateCause} />)}
          </div>

          {/* Spine + diagonal bones */}
          <div style={{ position: 'relative', height: 64, margin: '2px 0' }}>
            <svg width="100%" height="64" style={{ display: 'block' }}>
              <defs>
                <marker id="fb-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#0f2044" />
                </marker>
              </defs>
              <line x1="0" y1="32" x2="88%" y2="32" stroke="#0f2044" strokeWidth="4" strokeLinecap="round" markerEnd="url(#fb-arrow)" />
              <line x1="16.5%" y1="0"   x2="24%"  y2="32" stroke="#94a3b8" strokeWidth="2" />
              <line x1="49.5%" y1="0"   x2="50%"  y2="32" stroke="#94a3b8" strokeWidth="2" />
              <line x1="82.5%" y1="0"   x2="73%"  y2="32" stroke="#94a3b8" strokeWidth="2" />
              <line x1="24%"  y1="32" x2="16.5%" y2="64" stroke="#94a3b8" strokeWidth="2" />
              <line x1="50%"  y1="32" x2="49.5%" y2="64" stroke="#94a3b8" strokeWidth="2" />
              <line x1="73%"  y1="32" x2="82.5%" y2="64" stroke="#94a3b8" strokeWidth="2" />
            </svg>
            <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: '#ef4444', color: 'white', padding: '5px 10px', borderRadius: '0 10px 10px 0', fontWeight: 700, fontSize: '0.72rem', maxWidth: '11%', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.3 }}>
              {problem || 'Effect'}
            </div>
          </div>

          {/* Bottom cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {BOTTOM_CATS.map(cat => <CatCard key={cat.id} cat={cat} position="bottom" causes={causes} onUpdate={updateCause} />)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Saving...' : '💾 Save Diagram'}
        </button>
        <button onClick={handlePrint} style={{ flex: 1, background: '#0f2044', color: 'white', border: 'none', borderRadius: 10, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
          🖨️ Print / Save PDF
        </button>
      </div>
    </div>
  );
}

// ─── A3 Template ─────────────────────────────────────────────────────────────
const EMPTY_A3 = { title: '', date: '', owner: '', background: '', currentState: '', targetState: '', rootCause: '', countermeasures: '', implementationPlan: '', followUp: '' };
const A3_FIELDS = [
  { key: 'title',              label: 'A3 Title / Project',                        rows: 1 },
  { key: 'background',         label: '1. Background & Context',                   rows: 3 },
  { key: 'currentState',       label: '2. Current State (What is happening now?)', rows: 3 },
  { key: 'targetState',        label: '3. Target State (What should happen?)',      rows: 3 },
  { key: 'rootCause',          label: '4. Root Cause Analysis',                    rows: 3 },
  { key: 'countermeasures',    label: '5. Countermeasures / Solutions',            rows: 3 },
  { key: 'implementationPlan', label: '6. Implementation Plan (Who, What, When)',  rows: 3 },
  { key: 'followUp',           label: '7. Follow-up & Results Verification',       rows: 3 },
];

function A3Template({ onSave }) {
  const [form, setForm] = useState(EMPTY_A3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><label className="label">Owner</label><input className="input" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Name" /></div>
        <div><label className="label">Date</label><input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
      </div>
      {A3_FIELDS.map(field => (
        <div key={field.key}>
          <label className="label">{field.label}</label>
          {field.rows === 1
            ? <input className="input" value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />
            : <textarea className="input" rows={field.rows} value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />}
        </div>
      ))}
      <button className="btn-primary" onClick={() => onSave({ type: 'a3', title: form.title || 'Untitled A3', data: { ...form } })}>Save A3</button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProblemSolving() {
  const { currentUser } = useAuth();
  const [activeTool, setActiveTool] = useState('5 Whys');

  async function handleSave({ type, title, data }) {
    if (!currentUser) return toast.error('Not signed in');
    try {
      await addDoc(collection(db, 'problemSolving'), {
        uid: currentUser.uid, type, title, data, createdAt: serverTimestamp(),
      });
      toast.success('Saved!');
    } catch (e) { toast.error('Save failed: ' + (e?.message || e)); }
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
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
        {activeTool === '5 Whys'          && <FiveWhys   onSave={handleSave} />}
        {activeTool === 'Fishbone Diagram' && <Fishbone   onSave={handleSave} />}
        {activeTool === 'A3 Template'      && <A3Template onSave={handleSave} />}
      </div>
    </div>
  );
}
