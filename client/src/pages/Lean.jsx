import { useState } from 'react';
import toast from 'react-hot-toast';

const fiveSItems = [
  { category: 'Sort (Seiri)', items: ['Remove all unnecessary items from the work area', 'Red-tag items not needed in the next 30 days', 'Dispose of or relocate red-tagged items', 'Document what was removed and why'] },
  { category: 'Set in Order (Seiton)', items: ['Designate a specific place for every item', 'Label all locations clearly', 'Arrange items for ergonomic ease of use', 'Implement visual controls (shadow boards, floor tape)'] },
  { category: 'Shine (Seiso)', items: ['Clean all equipment and work surfaces', 'Identify and fix sources of contamination', 'Assign cleaning responsibilities', 'Create daily cleaning schedule'] },
  { category: 'Standardize (Seiketsu)', items: ['Create standard operating procedures for first 3S', 'Post visual standards in the area', 'Implement color-coding system', 'Train all team members on standards'] },
  { category: 'Sustain (Shitsuke)', items: ['Conduct weekly 5S audits', 'Review audit scores with team', 'Recognize top performers', 'Track 5S score trends over time'] },
];

const wasteTypes = [
  { type: 'Transportation', icon: '🚚', desc: 'Unnecessary movement of materials or products', example: 'Moving parts between distant workstations' },
  { type: 'Inventory', icon: '📦', desc: 'Excess materials, WIP, or finished goods', example: 'Large batch sizes sitting idle' },
  { type: 'Motion', icon: '🏃', desc: 'Unnecessary movement of people', example: 'Searching for tools or walking for supplies' },
  { type: 'Waiting', icon: '⏳', desc: 'Idle time when value is not being added', example: 'Machine downtime, waiting for approvals' },
  { type: 'Overproduction', icon: '⚙️', desc: 'Producing more than customer demand', example: 'Making parts before they are needed' },
  { type: 'Over-processing', icon: '🔄', desc: 'More work or quality than required', example: 'Extra steps not adding customer value' },
  { type: 'Defects', icon: '❌', desc: 'Work requiring rework or scrap', example: 'Parts failing inspection, customer returns' },
  { type: 'Skills (8th Waste)', icon: '💡', desc: 'Underutilizing people\'s knowledge and creativity', example: 'Not involving operators in improvement' },
];

const sampleKaizen = [
  { id: 1, title: 'Reduce setup time on Line 3', area: 'Production', status: 'In Progress', owner: 'T. Nguyen', date: '2024-07-15', benefit: 'Save 45 min/day' },
  { id: 2, title: 'Implement shadow board at Tool Crib', area: '5S', status: 'Complete', owner: 'A. Reyes', date: '2024-07-08', benefit: 'Eliminate tool search time' },
  { id: 3, title: 'Reduce defects in welding station', area: 'Quality', status: 'Open', owner: 'M. Torres', date: '2024-07-20', benefit: 'Reduce scrap by 20%' },
];

export default function Lean() {
  const [activeTab, setActiveTab] = useState('5s');
  const [checks, setChecks] = useState({});
  const [kaizen, setKaizen] = useState(sampleKaizen);
  const [showKaizenForm, setShowKaizenForm] = useState(false);
  const [kForm, setKForm] = useState({ title: '', area: '', owner: '', benefit: '' });

  function toggle(cat, idx) {
    const key = `${cat}-${idx}`;
    setChecks(c => ({ ...c, [key]: !c[key] }));
  }

  const totalItems = fiveSItems.reduce((a, c) => a + c.items.length, 0);
  const checkedItems = Object.values(checks).filter(Boolean).length;
  const pct = Math.round((checkedItems / totalItems) * 100);

  function addKaizen(e) {
    e.preventDefault();
    setKaizen(k => [...k, { ...kForm, id: Date.now(), status: 'Open', date: new Date().toISOString().split('T')[0] }]);
    setKForm({ title: '', area: '', owner: '', benefit: '' });
    setShowKaizenForm(false);
    toast.success('Kaizen logged');
  }

  const tabs = [{ id: '5s', label: '5S Checklist' }, { id: 'waste', label: 'Waste Identification' }, { id: 'kaizen', label: 'Kaizen Log' }];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Lean Manufacturing Toolkit</h1>
        <p className="text-slate-500 text-sm">5S checklist, waste identification, and Kaizen log</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${activeTab === t.id ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            style={activeTab === t.id ? { background: '#0f2044' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === '5s' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-700">5S Audit Score</span>
              <span className="text-2xl font-bold" style={{ color: pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626' }}>{pct}%</span>
            </div>
            <div className="bg-slate-100 rounded-full h-3">
              <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 80 ? '#0d9488' : pct >= 60 ? '#f59e0b' : '#ef4444' }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">{checkedItems} of {totalItems} items completed</p>
          </div>
          {fiveSItems.map(cat => (
            <div key={cat.category} className="card overflow-hidden">
              <div className="px-4 py-3 font-bold text-sm text-white" style={{ background: '#0f2044' }}>{cat.category}</div>
              <div className="divide-y divide-slate-100">
                {cat.items.map((item, i) => {
                  const key = `${cat.category}-${i}`;
                  return (
                    <button key={i} onClick={() => toggle(cat.category, i)} className="flex items-start gap-3 px-4 py-3 w-full text-left hover:bg-slate-50">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${checks[key] ? 'text-white border-transparent' : 'border-slate-300'}`} style={checks[key] ? { background: '#0d9488' } : {}}>
                        {checks[key] && '✓'}
                      </div>
                      <span className={`text-sm ${checks[key] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'waste' && (
        <div className="grid md:grid-cols-2 gap-4">
          {wasteTypes.map(w => (
            <div key={w.type} className="card p-4 flex gap-3">
              <span className="text-3xl flex-shrink-0">{w.icon}</span>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{w.type}</h4>
                <p className="text-xs text-slate-600 mt-0.5">{w.desc}</p>
                <p className="text-xs mt-1 italic" style={{ color: '#0d9488' }}>Example: {w.example}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'kaizen' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setShowKaizenForm(s => !s)}>+ Log Kaizen</button>
          </div>
          {showKaizenForm && (
            <div className="card p-5">
              <form onSubmit={addKaizen} className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Improvement Idea / Title</label>
                  <input className="input" required value={kForm.title} onChange={e => setKForm(f => ({ ...f, title: e.target.value }))} placeholder="Describe the improvement..." />
                </div>
                <div>
                  <label className="label">Area / Department</label>
                  <input className="input" value={kForm.area} onChange={e => setKForm(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Production, Quality" />
                </div>
                <div>
                  <label className="label">Owner</label>
                  <input className="input" value={kForm.owner} onChange={e => setKForm(f => ({ ...f, owner: e.target.value }))} placeholder="Responsible person" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Expected Benefit</label>
                  <input className="input" value={kForm.benefit} onChange={e => setKForm(f => ({ ...f, benefit: e.target.value }))} placeholder="e.g. Reduce cycle time by 15%" />
                </div>
                <div className="sm:col-span-2 flex gap-3">
                  <button className="btn-primary" type="submit">Log Kaizen</button>
                  <button className="btn-secondary" type="button" onClick={() => setShowKaizenForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
          <div className="space-y-3">
            {kaizen.map(k => (
              <div key={k.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="font-bold text-slate-800">{k.title}</h4>
                    <div className="flex gap-4 text-xs text-slate-400 mt-1">
                      <span>📂 {k.area}</span>
                      <span>👤 {k.owner}</span>
                      <span>📅 {k.date}</span>
                      {k.benefit && <span style={{ color: '#0d9488' }}>💡 {k.benefit}</span>}
                    </div>
                  </div>
                  <span className={k.status === 'Complete' ? 'badge-green' : k.status === 'In Progress' ? 'badge-yellow' : 'badge-red'}>{k.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
