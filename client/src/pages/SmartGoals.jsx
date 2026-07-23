import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logPointEvent, calculateScore, localDateStr } from '../utils/scoring';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import DateStatus from '../components/DateStatus';
import { generateSmartGoalsPDF } from '../utils/moduleReports';

const STATUS_STYLES = {
  draft:              { bg: '#f1f5f9', text: '#64748b',  label: 'Draft' },
  active:             { bg: '#eff6ff', text: '#1d4ed8',  label: 'Active' },
  pending_approval:   { bg: '#fefce8', text: '#b45309',  label: 'Pending Approval' },
  completed:          { bg: '#f0fdf4', text: '#15803d',  label: 'Completed' },
  paused:             { bg: '#fff7ed', text: '#c2410c',  label: 'Paused' },
};

const SMART_FIELDS = ['specific', 'measurable', 'achievable', 'relevant', 'timeBound'];
const SMART_180_DAYS = 180 * 24 * 60 * 60 * 1000;

const SMART = [
  {
    key: 'specific',
    letter: 'S',
    label: 'Specific',
    placeholder: 'What exactly will you accomplish? Who is involved? Where will it happen? Be precise and clear.',
    color: '#0f2044',
  },
  {
    key: 'measurable',
    letter: 'M',
    label: 'Measurable',
    placeholder: 'How will you measure progress? What numbers, metrics, or milestones will confirm success?',
    color: '#0d9488',
  },
  {
    key: 'achievable',
    letter: 'A',
    label: 'Achievable',
    placeholder: 'What resources, skills, or steps are needed? Is this realistic given your current situation?',
    color: '#7c3aed',
  },
  {
    key: 'relevant',
    letter: 'R',
    label: 'Relevant',
    placeholder: 'Why does this goal matter? How does it align with your team\'s priorities and your leadership purpose?',
    color: '#be185d',
  },
  {
    key: 'timeBound',
    letter: 'T',
    label: 'Time-Bound',
    placeholder: 'What is your target deadline? What are the key milestones along the way?',
    color: '#b45309',
  },
];

function wordCount(text = '') {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function fieldQualityPct(text = '') {
  const w = wordCount(text);
  if (w === 0)  return 0;
  if (w < 5)    return 20;
  if (w < 15)   return 50;
  if (w < 30)   return 80;
  return 100;
}

function goalQualityPct(goal) {
  const fields = SMART.map(s => fieldQualityPct(goal[s.key] || ''));
  return Math.round(fields.reduce((a, b) => a + b, 0) / fields.length);
}

function QualityBadge({ pct }) {
  const color = pct >= 80 ? '#0d9488' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const label = pct >= 80 ? 'High Quality' : pct >= 50 ? 'Developing' : 'Incomplete';
  return (
    <span style={{ background: color + '18', color, border: `1px solid ${color}40`, padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>
      {label} {pct}%
    </span>
  );
}

const emptyForm = { title: '', specific: '', measurable: '', achievable: '', relevant: '', timeBound: '', dueDate: '', status: 'draft' };

export default function SmartGoals() {
  const { currentUser, userProfile } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [pendingTeamGoals, setPendingTeamGoals] = useState([]); // for leaders/admins

  const isLeader = userProfile?.isAdmin || userProfile?.role === 'Leader' || userProfile?.role === 'Manager';

  async function fetchGoals() {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      const data = snap.exists() ? (snap.data().smartGoals || []) : [];
      setGoals(data);
    } catch { toast.error('Could not load goals'); }
    setLoading(false);
  }

  // Leaders fetch all team members' pending_approval goals
  async function fetchPendingTeamGoals() {
    const companyId = userProfile?.companyId;
    if (!companyId || !isLeader) return;
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('companyId', '==', companyId)));
      const pending = [];
      snap.forEach(d => {
        if (d.id === currentUser.uid) return;
        const u = d.data();
        (u.smartGoals || [])
          .filter(g => g.status === 'pending_approval')
          .forEach(g => pending.push({ ...g, ownerUid: d.id, ownerName: u.displayName || u.email || 'Unknown' }));
      });
      setPendingTeamGoals(pending);
    } catch (e) { console.error(e); }
  }

  async function persist(updated) {
    await setDoc(doc(db, 'users', currentUser.uid), { smartGoals: updated }, { merge: true });
    setGoals(updated);
  }

  useEffect(() => { fetchGoals(); }, [currentUser]);
  useEffect(() => { fetchPendingTeamGoals(); }, [userProfile?.companyId, isLeader]);

  function openCreate() { setForm(emptyForm); setEditing(null); setShowForm(true); }
  function openEdit(goal) {
    setForm({ title: goal.title, specific: goal.specific || '', measurable: goal.measurable || '', achievable: goal.achievable || '', relevant: goal.relevant || '', timeBound: goal.timeBound || '', dueDate: goal.dueDate || '', status: goal.status });
    setEditing(goal.id);
    setShowForm(true);
  }

  // All 5 SMART fields must have 5+ words AND due date must be a future date
  function isFullyFilled(g) {
    if (!SMART_FIELDS.every(k => fieldQualityPct(g[k] || '') >= 20)) return false;
    if (!g.dueDate) return false;
    return new Date(g.dueDate) > new Date();
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Goal title is required');
    if (form.dueDate && new Date(form.dueDate) <= new Date()) {
      return toast.error('Due date must be a future date to qualify for points.');
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = goals.map(g => g.id === editing ? { ...g, ...form, updatedAt: new Date().toISOString() } : g);
        await persist(updated);
        toast.success('Goal updated');
      } else {
        const newGoal = { ...form, id: Date.now().toString(), createdAt: new Date().toISOString() };
        const updatedGoals = [newGoal, ...goals];
        await persist(updatedGoals);

        // Award +1 pt if all 5 fields are fully filled and < 5 pts earned in last 180 days
        if (isFullyFilled(newGoal)) {
          const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
          const allEvents = userSnap.exists() ? (userSnap.data().pointEvents || []) : [];
          const cutoff = localDateStr(new Date(Date.now() - SMART_180_DAYS));
          const recentCreations = allEvents.filter(e => e.toolLabel === 'SMART Goal Created' && e.date >= cutoff).length;
          if (recentCreations < 5) {
            const { awarded } = await logPointEvent(currentUser.uid, {
              points: 1,
              toolLabel: 'SMART Goal Created',
              reason: `Fully-filled SMART goal: "${newGoal.title}"`,
            });
            if (awarded) {
              await calculateScore(currentUser.uid);
              toast.success('Goal created! +1 pt for completing all SMART fields.', { duration: 4000 });
            } else {
              toast.success('Goal created!');
            }
          } else {
            toast.success('Goal created! (5-goal point limit reached for this 6-month window)');
          }
        } else {
          toast.success('Goal created — fill all 5 fields (5+ words each) and set a future due date to earn +1 pt.');
        }
      }
      setShowForm(false);
    } catch { toast.error('Save failed'); }
    setSaving(false);
  }

  async function changeStatus(id, status) {
    await persist(goals.map(g => g.id === id ? { ...g, status } : g));
  }

  async function handleDelete(id) {
    if (!confirm('Delete this goal?')) return;
    await persist(goals.filter(g => g.id !== id));
    toast.success('Goal deleted');
  }

  async function handleRequestApproval(id) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    await persist(goals.map(g => g.id === id ? { ...g, status: 'pending_approval', approvalRequestedAt: new Date().toISOString() } : g));
    toast.success('Completion approval requested — your leader will review it.');
  }

  async function handleApproveGoal(ownerUid, goalId) {
    try {
      const ownerSnap = await getDoc(doc(db, 'users', ownerUid));
      if (!ownerSnap.exists()) return toast.error('User not found');
      const ownerGoals = ownerSnap.data().smartGoals || [];
      const updatedGoals = ownerGoals.map(g =>
        g.id === goalId ? { ...g, status: 'completed', completedAt: new Date().toISOString(), approvedBy: currentUser.uid } : g
      );
      await setDoc(doc(db, 'users', ownerUid), { smartGoals: updatedGoals }, { merge: true });

      // Award +2 pts to the goal owner
      const { awarded } = await logPointEvent(ownerUid, {
        points: 2,
        toolLabel: 'SMART Goal Completed',
        reason: `Goal completion approved by leader`,
      });
      if (awarded) await calculateScore(ownerUid);

      setPendingTeamGoals(prev => prev.filter(g => !(g.ownerUid === ownerUid && g.id === goalId)));
      toast.success('+2 pts awarded to the goal owner.');
    } catch (e) {
      console.error(e);
      toast.error('Approval failed — try again.');
    }
  }

  async function handleRejectGoal(ownerUid, goalId) {
    try {
      const ownerSnap = await getDoc(doc(db, 'users', ownerUid));
      if (!ownerSnap.exists()) return;
      const ownerGoals = ownerSnap.data().smartGoals || [];
      const updatedGoals = ownerGoals.map(g =>
        g.id === goalId ? { ...g, status: 'active', approvalRequestedAt: null } : g
      );
      await setDoc(doc(db, 'users', ownerUid), { smartGoals: updatedGoals }, { merge: true });
      setPendingTeamGoals(prev => prev.filter(g => !(g.ownerUid === ownerUid && g.id === goalId)));
      toast.success('Goal returned to Active — owner will be notified.');
    } catch (e) {
      toast.error('Could not reject — try again.');
    }
  }

  const counts = { draft: 0, active: 0, pending_approval: 0, completed: 0, paused: 0 };
  goals.forEach(g => { if (counts[g.status] !== undefined) counts[g.status]++; });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }} className="space-y-6">
      <PageHeader icon="🎯" title="SMART Goals — Are we winning?" subtitle="Set purposeful goals that drive accountability. Each goal contributes to your Accountability Score."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => generateSmartGoalsPDF(goals, { userName: currentUser?.displayName || '' })}>🖨️ PDF</button>
            <button className="btn-primary" onClick={openCreate}>+ New SMART Goal</button>
          </div>
        } />

      {/* Leader: Pending Approvals */}
      {isLeader && pendingTeamGoals.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.25rem', background: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>⏳ Pending Goal Approvals</span>
            <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: 9999, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{pendingTeamGoals.length}</span>
          </div>
          {pendingTeamGoals.map(g => (
            <div key={`${g.ownerUid}-${g.id}`} style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>{g.title}</p>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                  👤 {g.ownerName} · Requested {g.approvalRequestedAt ? new Date(g.approvalRequestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </p>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {SMART_FIELDS.map(k => (
                    <span key={k} style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: 9999, background: fieldQualityPct(g[k] || '') >= 80 ? '#f0fdf4' : '#fef2f2', color: fieldQualityPct(g[k] || '') >= 80 ? '#0d9488' : '#ef4444', fontWeight: 700 }}>
                      {k.charAt(0).toUpperCase()}{k === 'timeBound' ? 'T' : ''} {fieldQualityPct(g[k] || '') >= 80 ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => handleApproveGoal(g.ownerUid, g.id)}
                  style={{ padding: '0.4rem 0.875rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, border: 'none', background: '#0d9488', color: 'white', cursor: 'pointer' }}>
                  ✅ Approve (+2 pts)
                </button>
                <button onClick={() => handleRejectGoal(g.ownerUid, g.id)}
                  style={{ padding: '0.4rem 0.875rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, border: '1.5px solid #fca5a5', background: 'white', color: '#ef4444', cursor: 'pointer' }}>
                  ↩ Return
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {Object.entries(STATUS_STYLES).map(([key, s]) => (
          <div key={key} className="stat-tile" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: s.text }}>{counts[key] || 0}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Goals list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading goals...</div>
      ) : goals.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎯</div>
          <p style={{ color: '#64748b', fontWeight: 600, marginBottom: 8 }}>No SMART goals yet</p>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 20 }}>Create your first goal to start building your Accountability Score.</p>
          <button className="btn-primary" onClick={openCreate}>Create First Goal</button>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => {
            const st = STATUS_STYLES[goal.status] || STATUS_STYLES.draft;
            const qpct = goalQualityPct(goal);
            const isOpen = expanded === goal.id;
            return (
              <div key={goal.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Goal header row */}
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : goal.id)}>
                  <span style={{ fontSize: '1.25rem' }}>🎯</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, color: '#1e293b', margin: 0, fontSize: '0.95rem' }}>{goal.title}</p>
                    {goal.dueDate && <div style={{ marginTop: 4 }}><DateStatus date={goal.dueDate} /></div>}
                  </div>
                  <QualityBadge pct={qpct} />
                  <span style={{ background: st.bg, color: st.text, padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>{st.label}</span>
                  <span style={{ color: '#94a3b8', fontSize: '1rem' }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Expanded SMART fields */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '1.25rem' }}>
                    <div className="space-y-4">
                      {SMART.map(s => (
                        <div key={s.key}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ width: 24, height: 24, borderRadius: '50%', background: s.color, color: 'white', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.letter}</span>
                            <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.875rem' }}>{s.label}</span>
                            <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.72rem' }}>{wordCount(goal[s.key])} words</span>
                          </div>
                          <p style={{ color: goal[s.key] ? '#475569' : '#cbd5e1', fontSize: '0.875rem', margin: 0, paddingLeft: 32, fontStyle: goal[s.key] ? 'normal' : 'italic' }}>
                            {goal[s.key] || 'Not filled in yet.'}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Points indicator */}
                    {(() => {
                      const filled = isFullyFilled(goal);
                      const completed = goal.status === 'completed';
                      return (
                        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 9999, fontWeight: 700, background: filled ? '#f0fdf4' : '#f8fafc', color: filled ? '#0d9488' : '#94a3b8', border: `1px solid ${filled ? '#0d948840' : '#e2e8f0'}` }}>
                            {filled ? '✓ +1 pt earned (created)' : '○ Fill all 5 fields + set a future due date → +1 pt'}
                          </span>
                          <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 9999, fontWeight: 700, background: completed ? '#f0fdf4' : '#f8fafc', color: completed ? '#0d9488' : '#94a3b8', border: `1px solid ${completed ? '#0d948840' : '#e2e8f0'}` }}>
                            {completed ? '✓ +2 pts earned (approved)' : '○ Get leader approval → +2 pts'}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Actions */}
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {goal.status !== 'completed' && goal.status !== 'pending_approval' && (
                        <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }} onClick={() => openEdit(goal)}>✏️ Edit</button>
                      )}
                      {goal.status === 'draft' && (
                        <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }} onClick={() => changeStatus(goal.id, 'active')}>▶ Set Active</button>
                      )}
                      {goal.status === 'paused' && (
                        <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }} onClick={() => changeStatus(goal.id, 'active')}>▶ Resume</button>
                      )}
                      {(goal.status === 'active' || goal.status === 'draft') && (
                        <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }} onClick={() => changeStatus(goal.id, 'paused')}>⏸ Pause</button>
                      )}
                      {goal.status === 'active' && (
                        <button
                          onClick={() => handleRequestApproval(goal.id)}
                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem', borderRadius: 8, fontWeight: 700, border: 'none', background: '#0f2044', color: 'white', cursor: 'pointer' }}>
                          📤 Request Completion Approval
                        </button>
                      )}
                      {goal.status === 'pending_approval' && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b45309', padding: '0.4rem 0.875rem', background: '#fefce8', borderRadius: 8, border: '1px solid #fde68a' }}>
                          ⏳ Awaiting leader approval…
                        </span>
                      )}
                      {goal.status === 'completed' && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d', padding: '0.4rem 0.875rem', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                          🏆 Completed & Approved
                        </span>
                      )}
                      <button style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '0.4rem 0.875rem', background: 'none', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: 8, cursor: 'pointer' }} onClick={() => handleDelete(goal.id)}>🗑 Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 680, padding: '2rem', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{editing ? 'Edit SMART Goal' : 'New SMART Goal'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Title + Due Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <div>
                  <label className="label">Goal Title *</label>
                  <input className="input" placeholder="e.g. Improve team coaching frequency by Q3" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>

              {/* SMART fields */}
              {SMART.map(s => (
                <div key={s.key}>
                  <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: s.color, color: 'white', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.letter}</span>
                    {s.label}
                    <span style={{ marginLeft: 'auto', fontWeight: 400, color: '#94a3b8', fontSize: '0.72rem' }}>{wordCount(form[s.key])} words</span>
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder={s.placeholder}
                    value={form[s.key]}
                    onChange={e => setForm(f => ({ ...f, [s.key]: e.target.value }))}
                    style={{ resize: 'vertical' }}
                  />
                  {/* Quality bar */}
                  <div style={{ marginTop: 4, height: 3, background: '#e2e8f0', borderRadius: 9999 }}>
                    <div style={{ height: 3, borderRadius: 9999, background: s.color, width: `${fieldQualityPct(form[s.key])}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}

              {/* Status */}
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(STATUS_STYLES).filter(([k]) => k !== 'pending_approval').map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </div>

              {/* Overall quality preview */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Entry Quality:</span>
                <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 9999, height: 8 }}>
                  <div style={{ height: 8, borderRadius: 9999, background: '#0d9488', width: `${goalQualityPct(form)}%`, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0d9488' }}>{goalQualityPct(form)}%</span>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Goal' : 'Create Goal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
