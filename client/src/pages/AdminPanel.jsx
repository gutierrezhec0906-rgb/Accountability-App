import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const MASTER_ADMIN = 'hectorg@accountability-app.com';

// Tools that support a "How to use" walkthrough video (id must match the route/toolId).
const VIDEO_TOOLS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vision', label: 'Vision Builder' },
  { id: 'smart-goals', label: 'SMART Goals' },
  { id: 'visual-board', label: 'Visual Management Board' },
  { id: 'lob', label: 'Line of Balance' },
  { id: 'urgency', label: 'Sense of Urgency' },
  { id: 'eq-opex', label: 'EQ & OpEx Tools' },
  { id: 'mindfulness', label: 'Breathing & Mindfulness' },
  { id: 'lean', label: 'Lean Toolkit' },
  { id: 'problem-solving', label: 'Problem-Solving Tools' },
  { id: 'disc', label: 'DISC Assessment' },
  { id: 'skills', label: 'Skills Assessment' },
  { id: 'training', label: 'Training Center' },
  { id: 'mentoring', label: 'Mentoring Tracker' },
  { id: 'career', label: 'Career Development' },
  { id: 'feedback', label: 'Feedback Box' },
  { id: 'coaching', label: 'Coaching Log' },
  { id: 'quotes', label: 'Leadership Quotes' },
  { id: 'scores', label: 'Score Dashboard' },
];

const ROLE_COLORS = {
  Leader: { bg: '#eff6ff', text: '#1d4ed8' },
  Manager: { bg: '#f0fdf4', text: '#15803d' },
  Supervisor: { bg: '#fdf4ff', text: '#7e22ce' },
  'Individual Contributor': { bg: '#f8fafc', text: '#475569' },
};

function Avatar({ name }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const colors = ['#0d9488', '#0f2044', '#7c3aed', '#be185d', '#b45309', '#065f46'];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export default function AdminPanel() {
  const { currentUser, userProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCompany, setNewCompany] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedCompany, setExpandedCompany] = useState(null);
  const [toolVideos, setToolVideos] = useState({});
  const [uploadingTool, setUploadingTool] = useState(null);

  const isMasterAdmin = currentUser?.email === MASTER_ADMIN;

  useEffect(() => {
    if (!isMasterAdmin) return;
    Promise.all([fetchUsers(), fetchCompanies(), fetchToolVideos()]).finally(() => setLoading(false));
  }, [isMasterAdmin]);

  async function fetchToolVideos() {
    try {
      const snap = await getDoc(doc(db, 'appConfig', 'toolVideos'));
      if (snap.exists()) setToolVideos(snap.data());
    } catch {}
  }

  async function uploadToolVideo(toolId, file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) { toast.error('Please choose a video file'); return; }
    if (file.size > 200 * 1024 * 1024) { toast.error('Video must be under 200 MB'); return; }
    setUploadingTool(toolId);
    try {
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const storageRef = ref(storage, `toolVideos/${toolId}.${ext}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(db, 'appConfig', 'toolVideos'), { [toolId]: url }, { merge: true });
      setToolVideos(prev => ({ ...prev, [toolId]: url }));
      toast.success('Video uploaded — it will show as the "How to use" walkthrough.');
    } catch (e) {
      toast.error('Upload failed: ' + (e?.code || e?.message || 'check Storage rules'));
    } finally {
      setUploadingTool(null);
    }
  }

  async function removeToolVideo(toolId) {
    try {
      await setDoc(doc(db, 'appConfig', 'toolVideos'), { [toolId]: '' }, { merge: true });
      setToolVideos(prev => ({ ...prev, [toolId]: '' }));
      toast.success('Video removed');
    } catch (e) {
      toast.error('Could not remove: ' + (e?.message || e));
    }
  }

  async function fetchUsers() {
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  }

  async function fetchCompanies() {
    const snap = await getDocs(collection(db, 'companies'));
    setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function createCompany(e) {
    e.preventDefault();
    if (!newCompany.trim()) return;
    try {
      const ref = await addDoc(collection(db, 'companies'), {
        name: newCompany.trim(),
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
      });
      setCompanies(c => [...c, { id: ref.id, name: newCompany.trim() }]);
      setNewCompany('');
      toast.success(`Company "${newCompany.trim()}" created`);
    } catch (e) {
      toast.error('Failed to create company');
    }
  }

  async function updateStatus(uid, status) {
    try {
      await updateDoc(doc(db, 'users', uid), { status });
      setUsers(u => u.map(x => x.uid === uid ? { ...x, status } : x));
      toast.success(status === 'approved' ? '✅ User approved!' : '❌ User rejected');
    } catch (e) {
      toast.error('Failed to update status');
    }
  }

  async function deleteUser(uid, name) {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      const fns = getFunctions();
      const deleteFn = httpsCallable(fns, 'deleteUser');
      await deleteFn({ uid });
      setUsers(u => u.filter(x => x.uid !== uid));
      toast.success(`${name} deleted`);
    } catch (e) {
      toast.error('Failed to delete user');
    }
  }

  async function assignCompany(uid, companyId) {
    const company = companies.find(c => c.id === companyId);
    try {
      await updateDoc(doc(db, 'users', uid), { companyId, companyName: company?.name || '' });
      setUsers(u => u.map(x => x.uid === uid ? { ...x, companyId, companyName: company?.name || '' } : x));
      toast.success('Company assigned');
    } catch (e) {
      toast.error('Failed to assign company');
    }
  }

  if (!isMasterAdmin) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Master Admin Only</h2>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>This panel is restricted to the master administrator account.</p>
        </div>
      </div>
    );
  }

  const pendingUsers = users.filter(u => u.status === 'pending');
  const approvedUsers = users.filter(u => u.status === 'approved');

  // Group approved users by company → team
  const byCompany = {};
  approvedUsers.forEach(u => {
    const cName = u.companyName || 'Unassigned';
    const tName = u.teamName || 'No Team';
    if (!byCompany[cName]) byCompany[cName] = {};
    if (!byCompany[cName][tName]) byCompany[cName][tName] = [];
    byCompany[cName][tName].push(u);
  });

  const ROLE_ORDER = ['Leader', 'Manager', 'Supervisor', 'Individual Contributor'];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }} className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Master Admin Panel</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Full visibility across all companies and teams</p>
        </div>
        {pendingUsers.length > 0 && (
          <div style={{ background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 10, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <span style={{ fontWeight: 700, color: '#92400e', fontSize: 14 }}>{pendingUsers.length} pending approval{pendingUsers.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Companies', value: companies.length, icon: '🏢', color: '#0f2044' },
          { label: 'Total Users', value: users.length, icon: '👥', color: '#0d9488' },
          { label: 'Approved', value: approvedUsers.length, icon: '✅', color: '#16a34a' },
          { label: 'Pending', value: pendingUsers.length, icon: '⏳', color: '#d97706' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['overview', '🏢 Org View'], ['pending', `⏳ Pending (${pendingUsers.length})`], ['companies', '⚙️ Companies'], ['videos', '🎬 Tool Videos']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{
              padding: '8px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 700,
              background: activeTab === id ? '#0f2044' : '#f1f5f9',
              color: activeTab === id ? 'white' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer',
            }}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="card p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Loading...</div>}

      {/* ORG VIEW */}
      {!loading && activeTab === 'overview' && (
        <div className="space-y-4">
          {Object.keys(byCompany).length === 0 ? (
            <div className="card p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
              <p className="text-3xl mb-2">🏢</p>
              <p>No approved users yet. Approve pending users to see the org view.</p>
            </div>
          ) : (
            Object.entries(byCompany).map(([companyName, teams]) => {
              const totalInCompany = Object.values(teams).flat().length;
              const isExpanded = expandedCompany === companyName;
              return (
                <div key={companyName} className="card" style={{ overflow: 'hidden' }}>
                  {/* Company header */}
                  <button
                    onClick={() => setExpandedCompany(isExpanded ? null : companyName)}
                    style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, background: '#0f2044', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 22 }}>🏢</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>{companyName}</div>
                      <div style={{ color: '#93c5fd', fontSize: 12 }}>{Object.keys(teams).length} team{Object.keys(teams).length > 1 ? 's' : ''} · {totalInCompany} member{totalInCompany > 1 ? 's' : ''}</div>
                    </div>
                    <span style={{ color: '#93c5fd', fontSize: 18 }}>{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Teams */}
                  {isExpanded && (
                    <div style={{ padding: '12px 16px' }} className="space-y-3">
                      {Object.entries(teams).map(([teamName, members]) => {
                        const sorted = [...members].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
                        return (
                          <div key={teamName} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ background: '#f8fafc', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
                              <span>👥</span>
                              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{teamName}</span>
                              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>{members.length} member{members.length > 1 ? 's' : ''}</span>
                            </div>
                            <div style={{ padding: 12 }} className="space-y-2">
                              {sorted.map(u => {
                                const rc = ROLE_COLORS[u.role] || ROLE_COLORS['Individual Contributor'];
                                return (
                                  <div key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <Avatar name={u.displayName} />
                                    <div style={{ flex: 1, minWidth: 120 }}>
                                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{u.displayName}</div>
                                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
                                    </div>
                                    <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: rc.bg, color: rc.text }}>{u.role}</span>
                                    {!u.companyId && (
                                      <select
                                        defaultValue=""
                                        onChange={e => e.target.value && assignCompany(u.uid, e.target.value)}
                                        style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid #fbbf24', fontSize: 11, color: '#92400e', background: '#fef9c3', cursor: 'pointer' }}>
                                        <option value="">📌 Assign company</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                      </select>
                                    )}
                                    <button onClick={() => deleteUser(u.uid, u.displayName)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 14 }} title="Delete user">
                                      🗑
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* PENDING APPROVALS */}
      {!loading && activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingUsers.length === 0 ? (
            <div className="card p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
              <p className="text-3xl mb-2">✅</p>
              <p>No pending approvals — you're all caught up!</p>
            </div>
          ) : (
            pendingUsers.map(u => (
              <div key={u.uid} className="card p-4">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Avatar name={u.displayName} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{u.displayName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8' }}>{u.role}</span>
                      {u.companyName && <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#15803d' }}>🏢 {u.companyName}</span>}
                      {u.teamName && <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: '#fdf4ff', color: '#7e22ce' }}>👥 {u.teamName}</span>}
                    </div>
                  </div>
                  {/* Assign company if missing */}
                  {!u.companyId && (
                    <select
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-primary)', background: 'var(--surface)' }}
                      defaultValue=""
                      onChange={e => e.target.value && assignCompany(u.uid, e.target.value)}>
                      <option value="">Assign company...</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => updateStatus(u.uid, 'approved')}
                      style={{ padding: '8px 20px', borderRadius: 8, background: '#16a34a', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                      ✓ Approve
                    </button>
                    <button onClick={() => updateStatus(u.uid, 'rejected')}
                      style={{ padding: '8px 20px', borderRadius: 8, background: '#dc2626', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                      ✕ Reject
                    </button>
                    <button onClick={() => deleteUser(u.uid, u.displayName)}
                      style={{ padding: '8px 14px', borderRadius: 8, background: '#1e293b', color: '#f87171', fontWeight: 700, fontSize: 13, border: '1px solid #f87171', cursor: 'pointer' }}>
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* COMPANIES MANAGEMENT */}
      {!loading && activeTab === 'companies' && (
        <div className="space-y-4">
          <form onSubmit={createCompany} style={{ display: 'flex', gap: 10 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="New company name..."
              value={newCompany}
              onChange={e => setNewCompany(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary">
              + Add Company
            </button>
          </form>
          <div className="space-y-2">
            {companies.length === 0 ? (
              <div className="card p-6 text-center" style={{ color: 'var(--text-secondary)' }}>No companies yet. Add your first one above.</div>
            ) : (
              companies.map(c => {
                const memberCount = users.filter(u => u.companyId === c.id).length;
                const teamCount = new Set(users.filter(u => u.companyId === c.id).map(u => u.teamName)).size;
                return (
                  <div key={c.id} className="card p-4" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>🏢</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{memberCount} member{memberCount !== 1 ? 's' : ''} · {teamCount} team{teamCount !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TOOL VIDEOS */}
      {!loading && activeTab === 'videos' && (
        <div className="space-y-3">
          <div className="card p-4" style={{ background: '#f0fdfa', border: '1px solid #99f6e4' }}>
            <p style={{ fontWeight: 700, color: '#0f766e', margin: '0 0 4px', fontSize: 14 }}>🎬 "How to use" walkthrough videos</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Upload a short video for any tool. It plays automatically the first time a user opens that tool,
              and any time they click the <strong>▶ How to use</strong> button. Max 200 MB, MP4 recommended.
            </p>
          </div>
          <div className="space-y-2">
            {VIDEO_TOOLS.map(tool => {
              const url = toolVideos[tool.id];
              const busy = uploadingTool === tool.id;
              return (
                <div key={tool.id} className="card p-4" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20 }}>{url ? '✅' : '🎬'}</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tool.label}</div>
                    <div style={{ fontSize: 12, color: url ? '#0d9488' : 'var(--text-secondary)' }}>
                      {busy ? 'Uploading…' : url ? 'Video set' : 'No video yet'}
                    </div>
                  </div>
                  {url && !busy && (
                    <a href={url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, fontWeight: 700, color: '#0f2044', textDecoration: 'none' }}>Preview</a>
                  )}
                  <label className="btn-secondary" style={{ cursor: busy ? 'wait' : 'pointer', margin: 0, opacity: busy ? 0.6 : 1 }}>
                    {url ? 'Replace' : 'Upload'}
                    <input type="file" accept="video/*" disabled={busy} style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; uploadToolVideo(tool.id, f); }} />
                  </label>
                  {url && !busy && (
                    <button onClick={() => removeToolVideo(tool.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Remove</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
