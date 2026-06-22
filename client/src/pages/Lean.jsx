import { useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const fiveSItems = [
  { category: 'Sort (Seiri)',          items: ['Remove all unnecessary items from the work area','Red-tag items not needed in the next 30 days','Dispose of or relocate red-tagged items','Document what was removed and why'] },
  { category: 'Set in Order (Seiton)', items: ['Designate a specific place for every item','Label all locations clearly','Arrange items for ergonomic ease of use','Implement visual controls (shadow boards, floor tape)'] },
  { category: 'Shine (Seiso)',         items: ['Clean all equipment and work surfaces','Identify and fix sources of contamination','Assign cleaning responsibilities','Create daily cleaning schedule'] },
  { category: 'Standardize (Seiketsu)',items: ['Create standard operating procedures for first 3S','Post visual standards in the area','Implement color-coding system','Train all team members on standards'] },
  { category: 'Sustain (Shitsuke)',    items: ['Conduct weekly 5S audits','Review audit scores with team','Recognize top performers','Track 5S score trends over time'] },
];

const wasteTypes = [
  { type: 'Transportation',  icon: '🚚', desc: 'Unnecessary movement of materials or products',     example: 'Moving parts between distant workstations' },
  { type: 'Inventory',       icon: '📦', desc: 'Excess materials, WIP, or finished goods',           example: 'Large batch sizes sitting idle' },
  { type: 'Motion',          icon: '🏃', desc: 'Unnecessary movement of people',                    example: 'Searching for tools or walking for supplies' },
  { type: 'Waiting',         icon: '⏳', desc: 'Idle time when value is not being added',            example: 'Machine downtime, waiting for approvals' },
  { type: 'Overproduction',  icon: '⚙️', desc: 'Producing more than customer demand',               example: 'Making parts before they are needed' },
  { type: 'Over-processing', icon: '🔄', desc: 'More work or quality than required',                example: 'Extra steps not adding customer value' },
  { type: 'Defects',         icon: '❌', desc: 'Work requiring rework or scrap',                    example: 'Parts failing inspection, customer returns' },
  { type: 'Skills (8th)',    icon: '💡', desc: "Underutilizing people's knowledge and creativity",  example: 'Not involving operators in improvement' },
];

const sampleKaizen = [
  { id: 1, title: 'Reduce setup time on Line 3',        area: 'Production', status: 'In Progress', owner: 'T. Nguyen', date: '2024-07-15', benefit: 'Save 45 min/day' },
  { id: 2, title: 'Implement shadow board at Tool Crib', area: '5S',         status: 'Complete',    owner: 'A. Reyes',  date: '2024-07-08', benefit: 'Eliminate tool search time' },
  { id: 3, title: 'Reduce defects in welding station',  area: 'Quality',    status: 'Open',        owner: 'M. Torres', date: '2024-07-20', benefit: 'Reduce scrap by 20%' },
];

const tabs = [{ id: '5s', label: '5S Checklist' },{ id: 'waste', label: 'Waste Types' },{ id: 'kaizen', label: 'Kaizen Log' }];

export default function Lean() {
  const [activeTab, setActiveTab] = useState('5s');
  const [checks, setChecks] = useState({});
  const [kaizen, setKaizen] = useState(sampleKaizen);
  const [showKaizenForm, setShowKaizenForm] = useState(false);
  const [kForm, setKForm] = useState({ title:'',area:'',owner:'',benefit:'' });

  function toggle(cat, idx) { const k = `${cat}-${idx}`; setChecks(c => ({ ...c, [k]: !c[k] })); }

  const totalItems = fiveSItems.reduce((a,c) => a + c.items.length, 0);
  const checkedItems = Object.values(checks).filter(Boolean).length;
  const pct = Math.round((checkedItems / totalItems) * 100);

  function addKaizen(e) {
    e.preventDefault();
    setKaizen(k => [...k, { ...kForm, id: Date.now(), status: 'Open', date: new Date().toISOString().split('T')[0] }]);
    setKForm({ title:'',area:'',owner:'',benefit:'' });
    setShowKaizenForm(false);
    toast.success('Kaizen logged');
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon="🏭" title="Lean Manufacturing Toolkit" subtitle="5S checklist, waste identification, and Kaizen log" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: activeTab === t.id ? '#0f2044' : '#f1f5f9', color: activeTab === t.id ? 'white' : '#475569' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === '5s' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>5S Audit Score</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 900, color: pct >= 80 ? '#0d9488' : pct >= 60 ? '#f59e0b' : '#ef4444' }}>{pct}%</span>
            </div>
            <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 10 }}>
              <div style={{ height: 10, borderRadius: 9999, transition: 'width 0.6s ease', width: `${pct}%`, background: pct >= 80 ? '#0d9488' : pct >= 60 ? '#f59e0b' : '#ef4444' }} />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>{checkedItems} of {totalItems} items completed</p>
          </div>
          {fiveSItems.map(cat => (
            <div key={cat.category} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.25rem', background: '#0f2044' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '0.875rem' }}>{cat.category}</span>
              </div>
              {cat.items.map((item, i) => {
                const key = `${cat.category}-${i}`;
                return (
                  <button key={i} onClick={() => toggle(cat.category, i)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1.25rem', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderBottom: i < cat.items.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${checks[key] ? '#0d9488' : '#e2e8f0'}`, background: checks[key] ? '#0d9488' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s' }}>
                      {checks[key] && '✓'}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: checks[key] ? '#94a3b8' : 'var(--text-secondary)', textDecoration: checks[key] ? 'line-through' : 'none' }}>{item}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'waste' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: '0.875rem' }}>
          {wasteTypes.map(w => (
            <div key={w.type} className="card" style={{ padding: '1.125rem', display: 'flex', gap: 12 }}>
              <span style={{ fontSize: '1.75rem', flexShrink: 0 }}>{w.icon}</span>
              <div>
                <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem', margin: '0 0 4px' }}>{w.type}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 6px', lineHeight: 1.5 }}>{w.desc}</p>
                <p style={{ fontSize: '0.78rem', color: '#0d9488', fontStyle: 'italic', margin: 0 }}>Example: {w.example}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'kaizen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={() => setShowKaizenForm(s => !s)}>+ Log Kaizen</button>
          </div>
          {showKaizenForm && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <form onSubmit={addKaizen} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}><label className="label">Improvement Idea</label><input className="input" required value={kForm.title} onChange={e => setKForm(f => ({ ...f, title: e.target.value }))} placeholder="Describe the improvement..." /></div>
                <div><label className="label">Area</label><input className="input" value={kForm.area} onChange={e => setKForm(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Production, Quality" /></div>
                <div><label className="label">Owner</label><input className="input" value={kForm.owner} onChange={e => setKForm(f => ({ ...f, owner: e.target.value }))} placeholder="Responsible person" /></div>
                <div style={{ gridColumn: '1/-1' }}><label className="label">Expected Benefit</label><input className="input" value={kForm.benefit} onChange={e => setKForm(f => ({ ...f, benefit: e.target.value }))} placeholder="e.g. Reduce cycle time by 15%" /></div>
                <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
                  <button className="btn-primary" type="submit">Log Kaizen</button>
                  <button className="btn-secondary" type="button" onClick={() => setShowKaizenForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
          {kaizen.map(k => (
            <div key={k.id} className="card" style={{ padding: '1.125rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.9375rem' }}>{k.title}</h4>
                <div style={{ display: 'flex', gap: 14, fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span>📂 {k.area}</span><span>👤 {k.owner}</span><span>📅 {k.date}</span>
                  {k.benefit && <span style={{ color: '#0d9488', fontWeight: 600 }}>💡 {k.benefit}</span>}
                </div>
              </div>
              <span className={k.status === 'Complete' ? 'badge-green' : k.status === 'In Progress' ? 'badge-yellow' : 'badge-red'}>{k.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
