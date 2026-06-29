import { useState, useEffect } from 'react';
import {
  collection, addDoc, getDocs, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const TOOLS = ['5 Whys', 'Fishbone Diagram', 'A3 Template'];
const TYPE_MAP = { '5 Whys': '5whys', 'Fishbone Diagram': 'fishbone', 'A3 Template': 'a3' };

// ─── Saved entries list ───────────────────────────────────────────────────────
function SavedList({ entries, onLoad }) {
  if (!entries.length) return null;
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Saved Entries</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map(e => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0.875rem' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{e.title}</span>
              {e.createdAt && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 10 }}>{new Date(e.createdAt.seconds * 1000).toLocaleDateString()}</span>}
            </div>
            <button onClick={() => onLoad(e)} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0d9488', background: 'none', border: '1px solid #0d9488', borderRadius: 7, padding: '2px 10px', cursor: 'pointer' }}>Load</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 5 Whys ──────────────────────────────────────────────────────────────────
function FiveWhys({ onSave, loadEntry }) {
  const [problem,   setProblem]   = useState('');
  const [whys,      setWhys]      = useState(['', '', '', '', '']);
  const [rootCause, setRootCause] = useState('');
  const stepColors = ['#0d9488', '#0d9488', '#f59e0b', '#f59e0b', '#ef4444'];

  useEffect(() => {
    if (!loadEntry) return;
    setProblem(loadEntry.data.problem     || '');
    setWhys(loadEntry.data.whys           || ['', '', '', '', '']);
    setRootCause(loadEntry.data.rootCause || '');
  }, [loadEntry]);

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

function Fishbone({ onSave, loadEntry }) {
  const [problem, setProblem] = useState('');
  const [causes,  setCauses]  = useState(emptyCauses);

  useEffect(() => {
    if (!loadEntry) return;
    setProblem(loadEntry.data.problem || '');
    setCauses(loadEntry.data.causes   || emptyCauses());
  }, [loadEntry]);

  function updateCause(catId, idx, val) {
    setCauses(c => ({ ...c, [catId]: c[catId].map((v, i) => i === idx ? val : v) }));
  }

  function CatCard({ cat, position }) {
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
                onChange={e => updateCause(cat.id, i, e.target.value)}
                placeholder={`Cause ${i + 1}...`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className="label">Effect / Problem (Fish Head)</label>
        <input className="input" value={problem} onChange={e => setProblem(e.target.value)} placeholder="e.g. High defect rate in Assembly Line 2" />
      </div>

      {/* ── Fishbone diagram ── */}
      <div style={{ background: '#f8fafc', borderRadius: 16, padding: '12px', border: '1px solid #e8edf5' }}>

        {/* Top cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {TOP_CATS.map(cat => <CatCard key={cat.id} cat={cat} position="top" />)}
        </div>

        {/* Spine + diagonal bones */}
        <div style={{ position: 'relative', height: 64, margin: '2px 0' }}>
          <svg width="100%" height="64" style={{ display: 'block' }}>
            <defs>
              <marker id="fb-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#0f2044" />
              </marker>
            </defs>
            {/* Spine with arrowhead */}
            <line x1="0" y1="32" x2="88%" y2="32" stroke="#0f2044" strokeWidth="4" strokeLinecap="round" markerEnd="url(#fb-arrow)" />
            {/* Top diagonal bones */}
            <line x1="16.5%" y1="0"   x2="24%"  y2="32" stroke="#94a3b8" strokeWidth="2" />
            <line x1="49.5%" y1="0"   x2="50%"  y2="32" stroke="#94a3b8" strokeWidth="2" />
            <line x1="82.5%" y1="0"   x2="73%"  y2="32" stroke="#94a3b8" strokeWidth="2" />
            {/* Bottom diagonal bones */}
            <line x1="24%"  y1="32" x2="16.5%" y2="64" stroke="#94a3b8" strokeWidth="2" />
            <line x1="50%"  y1="32" x2="49.5%" y2="64" stroke="#94a3b8" strokeWidth="2" />
            <line x1="73%"  y1="32" x2="82.5%" y2="64" stroke="#94a3b8" strokeWidth="2" />
          </svg>

          {/* Fish head / problem label */}
          <div style={{
            position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
            background: '#ef4444', color: 'white', padding: '5px 10px',
            borderRadius: '0 10px 10px 0',
            fontWeight: 700, fontSize: '0.72rem', maxWidth: '11%', textAlign: 'center',
            wordBreak: 'break-word', lineHeight: 1.3,
          }}>
            {problem || 'Effect'}
          </div>
        </div>

        {/* Bottom cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {BOTTOM_CATS.map(cat => <CatCard key={cat.id} cat={cat} position="bottom" />)}
        </div>
      </div>

      <button className="btn-primary" onClick={() => onSave({ type: 'fishbone', title: problem || 'Untitled Fishbone', data: { problem, causes } })}>Save Diagram</button>
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

function A3Template({ onSave, loadEntry }) {
  const [form, setForm] = useState(EMPTY_A3);

  useEffect(() => {
    if (!loadEntry) return;
    setForm({ ...EMPTY_A3, ...loadEntry.data });
  }, [loadEntry]);

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
  const [activeTool,  setActiveTool]  = useState('5 Whys');
  const [saved,       setSaved]       = useState({});
  const [loadEntries, setLoadEntries] = useState({ '5 Whys': null, 'Fishbone Diagram': null, 'A3 Template': null });

  async function fetchSaved() {
    if (!currentUser) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'problemSolving'),
        where('uid', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
      ));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const typeToTool = { '5whys': '5 Whys', fishbone: 'Fishbone Diagram', a3: 'A3 Template' };
      const grouped = { '5 Whys': [], 'Fishbone Diagram': [], 'A3 Template': [] };
      all.forEach(e => { if (typeToTool[e.type]) grouped[typeToTool[e.type]].push(e); });
      setSaved(grouped);
    } catch {}
  }

  useEffect(() => { fetchSaved(); }, [currentUser]);

  async function handleSave({ type, title, data }) {
    if (!currentUser) return toast.error('Not signed in');
    try {
      await addDoc(collection(db, 'problemSolving'), {
        uid: currentUser.uid, type, title, data, createdAt: serverTimestamp(),
      });
      toast.success('Saved!');
      fetchSaved();
    } catch { toast.error('Save failed'); }
  }

  function handleLoad(tool, entry) {
    setLoadEntries(l => ({ ...l, [tool]: { ...entry, _ts: Date.now() } }));
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

        <SavedList entries={saved[activeTool] || []} onLoad={e => handleLoad(activeTool, e)} />

        {activeTool === '5 Whys'          && <FiveWhys   onSave={handleSave} loadEntry={loadEntries['5 Whys']}          />}
        {activeTool === 'Fishbone Diagram' && <Fishbone   onSave={handleSave} loadEntry={loadEntries['Fishbone Diagram']} />}
        {activeTool === 'A3 Template'      && <A3Template onSave={handleSave} loadEntry={loadEntries['A3 Template']}      />}
      </div>
    </div>
  );
}
