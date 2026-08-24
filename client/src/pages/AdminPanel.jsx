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
  { id: 'visual-board', label: 'The Accountability Board' },
  { id: 'lob', label: 'Line of Balance' },
  { id: 'urgency', label: 'Sense of Urgency' },
  { id: 'eq-opex', label: 'OpEx Tools' },
  { id: 'eq', label: 'EQ Assessment' },
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
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCompany, setNewCompany] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCompanyId, setNewTeamCompanyId] = useState('');
  const [editingUser, setEditingUser] = useState(null); // uid currently being reassigned
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editTeamId, setEditTeamId] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedCompany, setExpandedCompany] = useState(null);
  const [toolVideos, setToolVideos] = useState({});
  const [uploadingTool, setUploadingTool] = useState(null);
  const [previewTool, setPreviewTool] = useState(null);
  const [welcomeVideoUrl, setWelcomeVideoUrl] = useState('');
  const [uploadingWelcome, setUploadingWelcome] = useState(false);
  const [previewWelcome, setPreviewWelcome] = useState(false);
  const [invites, setInvites] = useState([]);
  const [invitesLoaded, setInvitesLoaded] = useState(false);
  const [expandedViewer, setExpandedViewer] = useState(null); // uid of viewer whose report list is open
  const [savingVis, setSavingVis] = useState(null);

  const isMasterAdmin = currentUser?.email === MASTER_ADMIN;

  useEffect(() => {
    if (!isMasterAdmin) return;
    Promise.all([fetchUsers(), fetchCompanies(), fetchTeams(), fetchToolVideos(), fetchWelcomeVideo(), fetchInvites()]).finally(() => setLoading(false));
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
    // Browsers can't play .mov/.mkv/.avi or HEVC/H.265 inline even though a
    // desktop player can — warn before uploading so the video isn't blank in-app.
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const risky = ['mov', 'mkv', 'avi', 'wmv', 'flv', 'm4v', 'hevc'];
    if (risky.includes(ext) || file.type === 'video/quicktime') {
      if (!window.confirm(`This looks like a .${ext || 'mov'} file, which most browsers can't play inside the app (it may show blank even though it plays on your computer). For reliable playback, upload an MP4 (H.264 + AAC). Upload anyway?`)) {
        return;
      }
    }
    setUploadingTool(toolId);
    try {
      const storageRef = ref(storage, `toolVideos/${toolId}.${ext || 'mp4'}`);
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

  // The very first video a brand-new user sees on their first Dashboard visit
  // (WelcomeModal.jsx reads appConfig/welcome.videoUrl) — same upload flow as
  // the per-tool "How to use" videos, just a single video, not one per tool.
  async function fetchWelcomeVideo() {
    try {
      const snap = await getDoc(doc(db, 'appConfig', 'welcome'));
      if (snap.exists()) setWelcomeVideoUrl(snap.data().videoUrl || '');
    } catch {}
  }

  async function uploadWelcomeVideo(file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) { toast.error('Please choose a video file'); return; }
    if (file.size > 200 * 1024 * 1024) { toast.error('Video must be under 200 MB'); return; }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const risky = ['mov', 'mkv', 'avi', 'wmv', 'flv', 'm4v', 'hevc'];
    if (risky.includes(ext) || file.type === 'video/quicktime') {
      if (!window.confirm(`This looks like a .${ext || 'mov'} file, which most browsers can't play inside the app (it may show blank even though it plays on your computer). For reliable playback, upload an MP4 (H.264 + AAC). Upload anyway?`)) {
        return;
      }
    }
    setUploadingWelcome(true);
    try {
      const storageRef = ref(storage, `welcomeVideo/welcome.${ext || 'mp4'}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(db, 'appConfig', 'welcome'), { videoUrl: url }, { merge: true });
      setWelcomeVideoUrl(url);
      toast.success('Welcome video uploaded — it will play for every new user\'s first login.');
    } catch (e) {
      toast.error('Upload failed: ' + (e?.code || e?.message || 'check Storage rules'));
    } finally {
      setUploadingWelcome(false);
    }
  }

  async function removeWelcomeVideo() {
    try {
      await setDoc(doc(db, 'appConfig', 'welcome'), { videoUrl: '' }, { merge: true });
      setWelcomeVideoUrl('');
      toast.success('Welcome video removed');
    } catch (e) {
      toast.error('Could not remove: ' + (e?.message || e));
    }
  }

  // Every invite ever sent, across every company/leader — firestore.rules lets
  // the master admin read the whole invites collection (isMasterAdmin() in the
  // read rule), unlike a Leader who only sees the ones where invitedByUid is theirs.
  async function fetchInvites() {
    try {
      const snap = await getDocs(collection(db, 'invites'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setInvites(list);
    } catch (e) {
      console.warn('Could not load invites', e);
    }
    setInvitesLoaded(true);
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
      toast.error('Failed to create company: ' + (e?.code || e?.message || 'unknown error'));
    }
  }

  async function fetchTeams() {
    const snap = await getDocs(collection(db, 'teams'));
    setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function createTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamCompanyId) return;
    try {
      const ref = await addDoc(collection(db, 'teams'), {
        name: newTeamName.trim(),
        companyId: newTeamCompanyId,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
      });
      setTeams(t => [...t, { id: ref.id, name: newTeamName.trim(), companyId: newTeamCompanyId }]);
      setNewTeamName('');
      toast.success(`Team "${newTeamName.trim()}" created`);
    } catch (e) {
      toast.error('Failed to create team: ' + (e?.code || e?.message || 'unknown error'));
    }
  }

  // Fixes a wrong company/team assignment after the fact — updates both the
  // FK (companyId/teamId) and the denormalized display names in one write.
  async function reassignUser(uid, companyId, teamId) {
    try {
      // Fetch the company/team docs directly rather than trusting the local
      // `companies`/`teams` state — if those lists hadn't finished loading yet
      // when this ran, company?.name would silently resolve to '', writing a
      // companyId with no companyName (the user's profile then shows no
      // company name anywhere, even though they're correctly attached to it).
      let companyName = '';
      if (companyId) {
        const companySnap = await getDoc(doc(db, 'companies', companyId));
        companyName = companySnap.exists() ? (companySnap.data().name || '') : '';
      }
      let teamName = '';
      if (teamId) {
        const teamSnap = await getDoc(doc(db, 'teams', teamId));
        teamName = teamSnap.exists() ? (teamSnap.data().name || '') : '';
      }
      const patch = {
        companyId: companyId || '',
        companyName,
        teamId: teamId || '',
        teamName,
      };
      await updateDoc(doc(db, 'users', uid), patch);
      setUsers(u => u.map(x => x.uid === uid ? { ...x, ...patch } : x));
      toast.success('Company/team updated');
      setEditingUser(null);
    } catch (e) {
      toast.error('Failed to update company/team: ' + (e?.code || e?.message || 'unknown error'));
    }
  }

  async function setRole(uid, role) {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
      setUsers(u => u.map(x => x.uid === uid ? { ...x, role } : x));
      toast.success(`Role changed to ${role}`);
    } catch (e) {
      toast.error('Failed to update role');
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

  // Score visibility: grant a viewer (leader/manager) the ability to see the
  // Accountability Scores of their direct reports. Stored as an array of report
  // uids on the viewer's own user doc (`visibleScoreUids`). The Scores page reads
  // this to build the "Team Accountability Scores" table.
  async function toggleReport(viewerUid, reportUid) {
    const viewer = users.find(u => u.uid === viewerUid);
    const current = viewer?.visibleScoreUids || [];
    const next = current.includes(reportUid)
      ? current.filter(x => x !== reportUid)
      : [...current, reportUid];
    setSavingVis(viewerUid + reportUid);
    try {
      await updateDoc(doc(db, 'users', viewerUid), { visibleScoreUids: next });
      setUsers(u => u.map(x => x.uid === viewerUid ? { ...x, visibleScoreUids: next } : x));
    } catch (e) {
      toast.error('Failed to update visibility');
    }
    setSavingVis(null);
  }

  // Inline "change company/team" control shown next to every user row —
  // click to reveal company + team dropdowns (team list filters to the
  // chosen company), Save writes both FK + denormalized name in one go.
  function ReassignBlock({ u }) {
    const isEditing = editingUser === u.uid;
    if (!isEditing) {
      return (
        <button onClick={() => { setEditingUser(u.uid); setEditCompanyId(u.companyId || ''); setEditTeamId(u.teamId || ''); }}
          title="Change company/team"
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          ✏️ {u.companyId ? 'Reassign' : 'Assign'}
        </button>
      );
    }
    const teamOptions = teams.filter(t => t.companyId === editCompanyId);
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={editCompanyId} onChange={e => { setEditCompanyId(e.target.value); setEditTeamId(''); }}
          style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 11, background: 'var(--surface)', color: 'var(--text-primary)' }}>
          <option value="">Company…</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={editTeamId} onChange={e => setEditTeamId(e.target.value)} disabled={!editCompanyId}
          style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 11, background: 'var(--surface)', color: 'var(--text-primary)' }}>
          <option value="">No team</option>
          {teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={() => reassignUser(u.uid, editCompanyId, editTeamId)}
          style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
        <button onClick={() => setEditingUser(null)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>✕</button>
      </div>
    );
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['overview', '🏢 Org View'], ['pending', `⏳ Pending (${pendingUsers.length})`], ['companies', '⚙️ Companies'], ['teams', '🧩 Teams'], ['visibility', '👁️ Score Visibility'], ['videos', '🎬 Tool Videos'], ['invites', `✉️ Invites (${invites.filter(i => i.status === 'pending').length})`]].map(([id, label]) => (
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
                                    <select
                                      value={u.role || ''}
                                      onChange={e => setRole(u.uid, e.target.value)}
                                      title="Change position"
                                      style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: rc.bg, color: rc.text, border: `1px solid ${rc.text}33`, cursor: 'pointer' }}>
                                      {ROLE_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <ReassignBlock u={u} />
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
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        value={u.role || ''}
                        onChange={e => setRole(u.uid, e.target.value)}
                        title="Change position"
                        style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #1d4ed833', cursor: 'pointer' }}>
                        {ROLE_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      {u.companyName && <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#15803d' }}>🏢 {u.companyName}</span>}
                      {u.teamName && <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: '#fdf4ff', color: '#7e22ce' }}>👥 {u.teamName}</span>}
                    </div>
                  </div>
                  <ReassignBlock u={u} />
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
                const teamCount = teams.filter(t => t.companyId === c.id).length;
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

      {/* TEAMS MANAGEMENT */}
      {!loading && activeTab === 'teams' && (
        <div className="space-y-4">
          <form onSubmit={createTeam} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select
              className="input"
              style={{ flex: '0 0 220px' }}
              value={newTeamCompanyId}
              onChange={e => setNewTeamCompanyId(e.target.value)}
              required>
              <option value="">Company…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input
              className="input"
              style={{ flex: 1, minWidth: 160 }}
              placeholder="New team name..."
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary">
              + Add Team
            </button>
          </form>
          {companies.length === 0 ? (
            <div className="card p-6 text-center" style={{ color: 'var(--text-secondary)' }}>Add a company first — teams belong to a company.</div>
          ) : teams.length === 0 ? (
            <div className="card p-6 text-center" style={{ color: 'var(--text-secondary)' }}>No teams yet. Add your first one above.</div>
          ) : (
            <div className="space-y-4">
              {companies.map(c => {
                const companyTeams = teams.filter(t => t.companyId === c.id);
                if (companyTeams.length === 0) return null;
                return (
                  <div key={c.id}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      🏢 {c.name}
                    </div>
                    <div className="space-y-2">
                      {companyTeams.map(t => {
                        const memberCount = users.filter(u => u.teamId === t.id).length;
                        return (
                          <div key={t.id} className="card p-4" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 22 }}>🧩</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{memberCount} member{memberCount !== 1 ? 's' : ''}</div>
                            </div>
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
      )}

      {/* SCORE VISIBILITY */}
      {!loading && activeTab === 'visibility' && (
        <div className="space-y-3">
          <div className="card p-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <p style={{ fontWeight: 700, color: '#1d4ed8', margin: '0 0 4px', fontSize: 14 }}>👁️ Direct-report score visibility</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Pick a leader or manager below, then check the team members who are their direct reports.
              Each viewer will then see those people's Accountability Scores in the <strong>Team Accountability
              Scores</strong> table on their Score Dashboard. Changes save instantly.
            </p>
          </div>
          {approvedUsers.length === 0 ? (
            <div className="card p-6 text-center" style={{ color: 'var(--text-secondary)' }}>No approved users yet.</div>
          ) : (
            <div className="space-y-2">
              {[...approvedUsers]
                .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
                .map(viewer => {
                  const granted = viewer.visibleScoreUids || [];
                  const open = expandedViewer === viewer.uid;
                  const rc = ROLE_COLORS[viewer.role] || ROLE_COLORS['Individual Contributor'];
                  // Candidate reports = every other approved user.
                  const candidates = approvedUsers.filter(u => u.uid !== viewer.uid);
                  return (
                    <div key={viewer.uid} className="card" style={{ overflow: 'hidden' }}>
                      <button onClick={() => setExpandedViewer(open ? null : viewer.uid)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '0.9rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <Avatar name={viewer.displayName || viewer.email} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{viewer.displayName || viewer.email}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ padding: '1px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: rc.bg, color: rc.text }}>{viewer.role}</span>
                            <span>{viewer.companyName || 'Unassigned'}</span>
                            <span style={{ fontWeight: 700, color: granted.length ? '#0d9488' : '#94a3b8' }}>
                              👁️ sees {granted.length} report{granted.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: 18, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.75rem 1rem', maxHeight: 360, overflowY: 'auto' }}>
                          {candidates.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>No other users to assign.</p>
                          ) : candidates.map(rep => {
                            const checked = granted.includes(rep.uid);
                            const busy = savingVis === viewer.uid + rep.uid;
                            return (
                              <label key={rep.uid}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.25rem', borderBottom: '1px solid #f8fafc', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                                <input type="checkbox" checked={checked} disabled={busy}
                                  onChange={() => toggleReport(viewer.uid, rep.uid)}
                                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#0d9488' }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{rep.displayName || rep.email}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{rep.role} · {rep.companyName || 'Unassigned'}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TOOL VIDEOS */}
      {!loading && activeTab === 'videos' && (
        <div className="space-y-3">
          <div className="card p-4" style={{ background: '#f0fdfa', border: '1px solid #99f6e4' }}>
            <p style={{ fontWeight: 700, color: '#0f766e', margin: '0 0 4px', fontSize: 14 }}>🎬 "How to use" walkthrough videos</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Upload a short video for any tool. It plays automatically the first time a user opens that tool,
              and any time they click the <strong>▶ See Why</strong> button. Max 200 MB, MP4 recommended.
            </p>
          </div>
          {/* Welcome video — plays once for a brand-new user's very first Dashboard visit */}
          <div className="card p-4" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: '2px solid #0d9488' }}>
            <span style={{ fontSize: 20 }}>{welcomeVideoUrl ? '✅' : '👋'}</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Welcome Video</div>
              <div style={{ fontSize: 12, color: welcomeVideoUrl ? '#0d9488' : 'var(--text-secondary)' }}>
                {uploadingWelcome ? 'Uploading…' : welcomeVideoUrl ? 'Plays on every new user\'s first login' : 'No video yet'}
              </div>
            </div>
            {welcomeVideoUrl && !uploadingWelcome && (
              <button onClick={() => setPreviewWelcome(p => !p)}
                style={{ background: 'none', border: 'none', color: '#0f2044', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                {previewWelcome ? 'Hide' : 'Preview'}
              </button>
            )}
            <label className="btn-secondary" style={{ cursor: uploadingWelcome ? 'wait' : 'pointer', margin: 0, opacity: uploadingWelcome ? 0.6 : 1 }}>
              {welcomeVideoUrl ? 'Replace' : 'Upload'}
              <input type="file" accept="video/*" disabled={uploadingWelcome} style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; uploadWelcomeVideo(f); }} />
            </label>
            {welcomeVideoUrl && !uploadingWelcome && (
              <button onClick={removeWelcomeVideo}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Remove</button>
            )}
            {welcomeVideoUrl && previewWelcome && (
              <div style={{ flexBasis: '100%', width: '100%', marginTop: 8 }}>
                <video src={welcomeVideoUrl} controls playsInline preload="metadata"
                  style={{ width: '100%', maxHeight: 320, borderRadius: 8, background: '#000' }}
                  onError={() => toast.error(`This video can't play in the browser — it's likely a .mov/HEVC file. Re-upload as MP4 (H.264).`)} />
                <a href={welcomeVideoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#64748b' }}>Open in new tab ↗</a>
              </div>
            )}
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
                    <button onClick={() => setPreviewTool(p => p === tool.id ? null : tool.id)}
                      style={{ background: 'none', border: 'none', color: '#0f2044', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                      {previewTool === tool.id ? 'Hide' : 'Preview'}
                    </button>
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
                  {url && previewTool === tool.id && (
                    <div style={{ flexBasis: '100%', width: '100%', marginTop: 8 }}>
                      <video src={url} controls playsInline preload="metadata"
                        style={{ width: '100%', maxHeight: 320, borderRadius: 8, background: '#000' }}
                        onError={() => toast.error(`This video can't play in the browser — it's likely a .mov/HEVC file. Re-upload as MP4 (H.264).`)} />
                      <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#64748b' }}>Open in new tab ↗</a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INVITES — every invite sent by any leader/admin, across every company */}
      {!loading && activeTab === 'invites' && (
        <div className="space-y-3">
          <div className="card p-4" style={{ background: '#f0fdfa', border: '1px solid #99f6e4' }}>
            <p style={{ fontWeight: 700, color: '#0f766e', margin: '0 0 4px', fontSize: 14 }}>✉️ Team member invitations</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Every invite sent from the Team page, across every company — who invited them, what role/team, and whether they've joined yet.
            </p>
          </div>
          {invitesLoaded && invites.length === 0 ? (
            <div className="card p-6 text-center" style={{ color: 'var(--text-secondary)' }}>No invitations have been sent yet.</div>
          ) : (
            <div className="space-y-2">
              {invites.map(inv => (
                <div key={inv.id} className="card p-4" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20 }}>{inv.status === 'accepted' ? '✅' : '⏳'}</span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{inv.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Invited by {inv.invitedByName || 'Unknown'} · {inv.role}{inv.teamName ? ` · ${inv.teamName}` : ''}
                    </div>
                  </div>
                  <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#15803d' }}>🏢 {inv.companyName}</span>
                  <span className={inv.status === 'accepted' ? 'badge-green' : 'badge-yellow'} style={{ fontSize: 12 }}>
                    {inv.status === 'accepted' ? '✅ Joined' : '⏳ Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
