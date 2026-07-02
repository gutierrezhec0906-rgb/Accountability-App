import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const TOOLS = ['5 Whys', 'Fishbone Diagram', 'A3 Template'];

// ─── Shared: Saved panel ──────────────────────────────────────────────────────
function SavedPanel({ entries, onDelete, onLoad, printEntry }) {
  return (
    <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#0f2044', borderRadius: '12px 12px 0 0', padding: '0.75rem 1rem' }}>
        <p style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem', margin: 0 }}>📋 Saved Templates</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', margin: '2px 0 0' }}>{entries.length} template{entries.length !== 1 ? 's' : ''}</p>
      </div>
      <div style={{ flex: 1, border: '1px solid #e8edf5', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden', background: '#fafbfc' }}>
        {entries.length === 0 ? (
          <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0, fontStyle: 'italic' }}>No saved templates yet. Fill out the form and click Save.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {entries.map((e, i) => (
              <div key={e.id} style={{ borderBottom: i < entries.length - 1 ? '1px solid #e8edf5' : 'none', padding: '0.75rem 1rem', background: 'white' }}>
                <p style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', margin: '0 0 2px', lineHeight: 1.3 }}>{e.title}</p>
                {e.data?.problem && <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 4px', lineHeight: 1.3 }}>{e.data.problem}</p>}
                {e.createdAt && <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: '0 0 8px' }}>{new Date(e.createdAt.seconds * 1000).toLocaleDateString()}</p>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => onLoad(e)}
                    style={{ flex: 1, fontSize: '0.72rem', fontWeight: 700, color: '#0d9488', background: 'none', border: '1px solid #0d9488', borderRadius: 6, padding: '3px 0', cursor: 'pointer' }}>
                    ✏️ Edit
                  </button>
                  <button onClick={() => printEntry(e)}
                    style={{ flex: 1, fontSize: '0.72rem', fontWeight: 700, color: '#0f2044', background: 'none', border: '1px solid #0f2044', borderRadius: 6, padding: '3px 0', cursor: 'pointer' }}>
                    🖨️ Print
                  </button>
                  <button onClick={() => onDelete(e.id)}
                    style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 5 Whys ──────────────────────────────────────────────────────────────────
function fiveWhysPrintHTML(entry) {
  const { problem, whys, rootCause } = entry.data;
  const date = entry.createdAt ? new Date(entry.createdAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString();
  const stepColors = ['#0d9488', '#0d9488', '#f59e0b', '#f59e0b', '#ef4444'];
  const whyRows = (whys || []).map((w, i) => `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">
      <div style="width:28px;height:28px;border-radius:50%;background:${stepColors[i]};color:white;font-weight:900;font-size:0.85rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</div>
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:0.82rem;color:${w ? '#1e293b' : '#cbd5e1'};font-style:${w ? 'normal' : 'italic'};min-height:36px">${w || 'Not answered'}</div>
    </div>`).join('');
  return `<div style="font-family:sans-serif;padding:24px;background:white">
    <div style="margin-bottom:14px;border-bottom:2px solid #0f2044;padding-bottom:10px">
      <h2 style="margin:0 0 4px;color:#0f2044;font-size:1.1rem;font-weight:900">5 Whys Analysis</h2>
      <p style="margin:0;font-size:0.8rem;color:#64748b"><strong>Title:</strong> ${entry.title || '—'} &nbsp;|&nbsp; <strong>Date:</strong> ${date}</p>
    </div>
    <p style="font-weight:700;color:#0f2044;margin:0 0 6px;font-size:0.85rem">Problem Statement</p>
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:0.82rem;color:${problem ? '#1e293b' : '#cbd5e1'};margin-bottom:16px;min-height:40px">${problem || 'Not stated'}</div>
    <p style="font-weight:700;color:#0f2044;margin:0 0 10px;font-size:0.85rem">5 Whys</p>
    ${whyRows}
    <div style="background:#f0fdfa;border:1.5px solid #0d9488;border-radius:10px;padding:12px;margin-top:8px">
      <p style="font-weight:700;color:#0f766e;margin:0 0 6px;font-size:0.85rem">Root Cause Identified</p>
      <p style="margin:0;font-size:0.82rem;color:${rootCause ? '#1e293b' : '#cbd5e1'};font-style:${rootCause ? 'normal' : 'italic'}">${rootCause || 'Not identified'}</p>
    </div>
  </div>`;
}

function FiveWhys({ onSave, savedEntries, onDelete }) {
  const [title,     setTitle]     = useState('');
  const [problem,   setProblem]   = useState('');
  const [whys,      setWhys]      = useState(['', '', '', '', '']);
  const [rootCause, setRootCause] = useState('');
  const stepColors = ['#0d9488', '#0d9488', '#f59e0b', '#f59e0b', '#ef4444'];

  function loadEntry(e) {
    setTitle(e.title || '');
    setProblem(e.data.problem || '');
    setWhys(e.data.whys || ['', '', '', '', '']);
    setRootCause(e.data.rootCause || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function printEntry(e) {
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<html><head><title>${e.title}</title><style>body{margin:0}@media print{@page{margin:15mm}}</style></head><body>${fiveWhysPrintHTML(e)}</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  function handlePrintCurrent() {
    const fakeEntry = { id: 'cur', title: title || problem || 'Untitled', data: { problem, whys, rootCause }, createdAt: null };
    printEntry(fakeEntry);
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="label">Analysis Title *</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Line 2 Downtime — June 2026" />
        </div>
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
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" style={{ flex: 1 }}
            onClick={() => onSave({ type: '5whys', title: title || problem || 'Untitled 5 Whys', data: { problem, whys, rootCause }, onSaved: () => { setTitle(''); setProblem(''); setWhys(['','','','','']); setRootCause(''); } })}>
            💾 Save Analysis
          </button>
          <button onClick={handlePrintCurrent}
            style={{ flex: 1, background: '#0f2044', color: 'white', border: 'none', borderRadius: 10, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>
      <SavedPanel entries={savedEntries} onDelete={onDelete} onLoad={loadEntry} printEntry={printEntry} />
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

function fishbonePrintHTML(entry) {
  const { name, problem, causes } = entry.data;
  const date = entry.createdAt ? new Date(entry.createdAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString();
  function catHTML(cat) {
    const items = (causes[cat.id] || []).map(v =>
      `<p style="margin:3px 0;font-size:0.78rem;color:${v ? '#1e293b' : '#cbd5e1'};font-style:${v ? 'normal' : 'italic'}">${v || '—'}</p>`
    ).join('');
    return `<div style="border:2px solid ${cat.color};border-radius:8px;overflow:hidden">
      <div style="background:${cat.color};color:white;font-weight:700;font-size:0.8rem;padding:4px 10px">${cat.label}</div>
      <div style="padding:6px 10px">${items}</div>
    </div>`;
  }
  return `<div style="font-family:sans-serif;padding:24px;background:white">
    <div style="margin-bottom:14px;border-bottom:2px solid #0f2044;padding-bottom:10px">
      <h2 style="margin:0 0 4px;color:#0f2044;font-size:1.1rem;font-weight:900">Fishbone (Ishikawa) Diagram</h2>
      <p style="margin:0;font-size:0.8rem;color:#64748b"><strong>Name:</strong> ${name || entry.title || '—'} &nbsp;|&nbsp; <strong>Effect:</strong> ${problem || '—'} &nbsp;|&nbsp; <strong>Date:</strong> ${date}</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:4px">${TOP_CATS.map(catHTML).join('')}</div>
    <div style="position:relative;height:48px;margin:2px 0">
      <svg width="100%" height="48" style="display:block">
        <defs><marker id="a" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#0f2044"/></marker></defs>
        <line x1="0" y1="24" x2="88%" y2="24" stroke="#0f2044" stroke-width="3" marker-end="url(#a)"/>
        <line x1="16.5%" y1="0" x2="24%" y2="24" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="49.5%" y1="0" x2="50%" y2="24" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="82.5%" y1="0" x2="73%" y2="24" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="24%" y1="24" x2="16.5%" y2="48" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="50%" y1="24" x2="49.5%" y2="48" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="73%" y1="24" x2="82.5%" y2="48" stroke="#94a3b8" stroke-width="1.5"/>
      </svg>
      <div style="position:absolute;right:0;top:50%;transform:translateY(-50%);background:#ef4444;color:white;padding:4px 8px;border-radius:0 6px 6px 0;font-weight:700;font-size:0.68rem;max-width:11%;text-align:center;word-break:break-word;line-height:1.3">${problem || 'Effect'}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:4px">${BOTTOM_CATS.map(catHTML).join('')}</div>
  </div>`;
}

function Fishbone({ onSave, savedEntries, onDelete }) {
  const [name,    setName]    = useState('');
  const [problem, setProblem] = useState('');
  const [causes,  setCauses]  = useState(emptyCauses);
  const [saving,  setSaving]  = useState(false);

  function updateCause(catId, idx, val) {
    setCauses(c => ({ ...c, [catId]: c[catId].map((v, i) => i === idx ? val : v) }));
  }

  function loadEntry(e) {
    setName(e.data.name || e.title || '');
    setProblem(e.data.problem || '');
    setCauses(e.data.causes || emptyCauses());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function printEntry(e) {
    const win = window.open('', '_blank', 'width=1000,height=750');
    win.document.write(`<html><head><title>${e.title}</title><style>body{margin:0}@media print{@page{size:landscape;margin:12mm}}</style></head><body>${fishbonePrintHTML(e)}</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  function handlePrintCurrent() {
    printEntry({ id: 'cur', title: name, data: { name, problem, causes }, createdAt: null });
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Please enter a diagram name before saving');
    setSaving(true);
    await onSave({ type: 'fishbone', title: name, data: { name, problem, causes }, onSaved: () => { setName(''); setProblem(''); setCauses(emptyCauses()); } });
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
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

        <div style={{ background: '#f8fafc', borderRadius: 16, padding: '12px', border: '1px solid #e8edf5' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {TOP_CATS.map(cat => <CatCard key={cat.id} cat={cat} position="top" causes={causes} onUpdate={updateCause} />)}
            </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {BOTTOM_CATS.map(cat => <CatCard key={cat.id} cat={cat} position="bottom" causes={causes} onUpdate={updateCause} />)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving...' : '💾 Save Diagram'}
          </button>
          <button onClick={handlePrintCurrent}
            style={{ flex: 1, background: '#0f2044', color: 'white', border: 'none', borderRadius: 10, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>
      <SavedPanel entries={savedEntries} onDelete={onDelete} onLoad={loadEntry} printEntry={printEntry} />
    </div>
  );
}

// ─── A3 Template ─────────────────────────────────────────────────────────────
const EMPTY_A3 = { background: '', currentState: '', targetState: '', rootCause: '', countermeasures: '', implementationPlan: '', followUp: '' };
const A3_FIELDS = [
  { key: 'background',         label: '1. Background & Context',                   rows: 3 },
  { key: 'currentState',       label: '2. Current State (What is happening now?)', rows: 3 },
  { key: 'targetState',        label: '3. Target State (What should happen?)',      rows: 3 },
  { key: 'rootCause',          label: '4. Root Cause Analysis',                    rows: 3 },
  { key: 'countermeasures',    label: '5. Countermeasures / Solutions',            rows: 3 },
  { key: 'implementationPlan', label: '6. Implementation Plan (Who, What, When)',  rows: 3 },
  { key: 'followUp',           label: '7. Follow-up & Results Verification',       rows: 3 },
];

function a3PrintHTML(entry) {
  const d = entry.data;
  const date = entry.createdAt ? new Date(entry.createdAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString();
  const rows = A3_FIELDS.map(f => `
    <div style="margin-bottom:12px">
      <p style="font-weight:700;color:#0f2044;margin:0 0 4px;font-size:0.82rem">${f.label}</p>
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:0.8rem;color:${d[f.key] ? '#1e293b' : '#cbd5e1'};font-style:${d[f.key] ? 'normal' : 'italic'};min-height:40px">${d[f.key] || 'Not filled in'}</div>
    </div>`).join('');
  return `<div style="font-family:sans-serif;padding:24px;background:white">
    <div style="margin-bottom:14px;border-bottom:2px solid #0f2044;padding-bottom:10px">
      <h2 style="margin:0 0 4px;color:#0f2044;font-size:1.1rem;font-weight:900">A3 Problem-Solving Template</h2>
      <p style="margin:0;font-size:0.8rem;color:#64748b"><strong>Title:</strong> ${entry.title || '—'} &nbsp;|&nbsp; <strong>Owner:</strong> ${d.owner || '—'} &nbsp;|&nbsp; <strong>Date:</strong> ${d.date || date}</p>
    </div>
    ${rows}
  </div>`;
}

function A3Template({ onSave, savedEntries, onDelete }) {
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [date,  setDate]  = useState('');
  const [form,  setForm]  = useState(EMPTY_A3);

  function loadEntry(e) {
    setTitle(e.title || '');
    setOwner(e.data.owner || '');
    setDate(e.data.date || '');
    setForm({ ...EMPTY_A3, ...e.data });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function printEntry(e) {
    const win = window.open('', '_blank', 'width=900,height=800');
    win.document.write(`<html><head><title>${e.title}</title><style>body{margin:0}@media print{@page{margin:15mm}}</style></head><body>${a3PrintHTML(e)}</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  function handlePrintCurrent() {
    printEntry({ id: 'cur', title: title || 'Untitled A3', data: { ...form, owner, date }, createdAt: null });
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="label">A3 Title *</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Defect Reduction Project — Q3 2026" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label className="label">Owner</label><input className="input" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Name" /></div>
          <div><label className="label">Date</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        {A3_FIELDS.map(field => (
          <div key={field.key}>
            <label className="label">{field.label}</label>
            <textarea className="input" rows={field.rows} value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" style={{ flex: 1 }}
            onClick={() => onSave({ type: 'a3', title: title || 'Untitled A3', data: { ...form, owner, date }, onSaved: () => { setTitle(''); setOwner(''); setDate(''); setForm(EMPTY_A3); } })}>
            💾 Save A3
          </button>
          <button onClick={handlePrintCurrent}
            style={{ flex: 1, background: '#0f2044', color: 'white', border: 'none', borderRadius: 10, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>
      <SavedPanel entries={savedEntries} onDelete={onDelete} onLoad={loadEntry} printEntry={printEntry} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProblemSolving() {
  const { currentUser } = useAuth();
  const [activeTool, setActiveTool] = useState('5 Whys');
  const [saved, setSaved] = useState({ '5whys': [], fishbone: [], a3: [] });

  async function fetchSaved() {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      const all = snap.exists() ? (snap.data().problemSolving || []) : [];
      setSaved({
        '5whys':    all.filter(e => e.type === '5whys'),
        fishbone:   all.filter(e => e.type === 'fishbone'),
        a3:         all.filter(e => e.type === 'a3'),
      });
    } catch (e) { console.error('fetchSaved:', e); }
  }

  async function persist(updated) {
    await setDoc(doc(db, 'users', currentUser.uid), { problemSolving: updated }, { merge: true });
    setSaved({
      '5whys':    updated.filter(e => e.type === '5whys'),
      fishbone:   updated.filter(e => e.type === 'fishbone'),
      a3:         updated.filter(e => e.type === 'a3'),
    });
  }

  useEffect(() => { fetchSaved(); }, [currentUser]);

  async function handleSave({ type, title, data, onSaved }) {
    if (!currentUser) return toast.error('Not signed in');
    try {
      const all = [...saved['5whys'], ...saved.fishbone, ...saved.a3];
      const existing = saved[type]?.find(e => e.title.trim().toLowerCase() === title.trim().toLowerCase());
      let updated;
      if (existing) {
        updated = all.map(e => e.id === existing.id ? { ...e, title, data, updatedAt: { seconds: Math.floor(Date.now() / 1000) } } : e);
        toast.success('Template updated!');
      } else {
        const newEntry = {
          id: Date.now().toString(),
          uid: currentUser.uid,
          type,
          title,
          data,
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        };
        updated = [newEntry, ...all];
        toast.success('Template saved!');
      }
      await persist(updated);
      onSaved?.();
    } catch (e) { toast.error('Save failed: ' + (e?.message || e)); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this template?')) return;
    try {
      const all = [...saved['5whys'], ...saved.fishbone, ...saved.a3];
      await persist(all.filter(e => e.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
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
        {activeTool === '5 Whys'          && <FiveWhys   onSave={handleSave} savedEntries={saved['5whys']}  onDelete={handleDelete} />}
        {activeTool === 'Fishbone Diagram' && <Fishbone   onSave={handleSave} savedEntries={saved.fishbone} onDelete={handleDelete} />}
        {activeTool === 'A3 Template'      && <A3Template onSave={handleSave} savedEntries={saved.a3}       onDelete={handleDelete} />}
      </div>
    </div>
  );
}
