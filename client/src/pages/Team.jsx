import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const roleColors = {
  Leader: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  Manager: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  Supervisor: { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
  'Team Lead': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  'Individual Contributor': { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
};

const roleIcons = {
  Leader: '👑',
  Manager: '🏢',
  Supervisor: '🎯',
  'Team Lead': '⭐',
  'Individual Contributor': '👤',
};

const allRoles = ['All', 'Leader', 'Manager', 'Supervisor', 'Team Lead', 'Individual Contributor'];

// Sample members shown when Firestore has no data yet
const sampleMembers = [
  { uid: '1', displayName: 'Patricia Wells', email: 'p.wells@company.com', role: 'Leader', createdAt: '2024-01-15', lastLogin: '2 hours ago', score: 4.8 },
  { uid: '2', displayName: 'James Carter', email: 'j.carter@company.com', role: 'Manager', createdAt: '2024-02-01', lastLogin: '1 day ago', score: 4.2 },
  { uid: '3', displayName: 'Sofia Nguyen', email: 's.nguyen@company.com', role: 'Team Lead', createdAt: '2024-03-10', lastLogin: '3 hours ago', score: 3.9 },
  { uid: '4', displayName: 'Marcus Johnson', email: 'm.johnson@company.com', role: 'Individual Contributor', createdAt: '2024-03-15', lastLogin: '5 hours ago', score: 3.5 },
  { uid: '5', displayName: 'Elena Martinez', email: 'e.martinez@company.com', role: 'Individual Contributor', createdAt: '2024-04-01', lastLogin: 'Yesterday', score: 4.1 },
  { uid: '6', displayName: 'David Kim', email: 'd.kim@company.com', role: 'Supervisor', createdAt: '2024-04-20', lastLogin: '2 days ago', score: 3.7 },
  { uid: '7', displayName: 'Ana Reyes', email: 'a.reyes@company.com', role: 'Individual Contributor', createdAt: '2024-05-05', lastLogin: 'Today', score: 4.4 },
  { uid: '8', displayName: 'Tom Baker', email: 't.baker@company.com', role: 'Individual Contributor', createdAt: '2024-05-18', lastLogin: '4 hours ago', score: 3.2 },
];

function Avatar({ name, photoURL, size = 40 }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const colors = ['#0d9488', '#0f2044', '#7c3aed', '#be185d', '#b45309', '#065f46'];
  const color = colors[name?.charCodeAt(0) % colors.length] || '#0d9488';
  if (photoURL) {
    return (
      <img src={photoURL} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #e2e8f0' }} />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function ScoreBar({ score }) {
  const pct = (score / 5) * 100;
  const color = score >= 4 ? '#0d9488' : score >= 3 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 9999, height: 6 }}>
        <div style={{ width: `${pct}%`, height: 6, borderRadius: 9999, background: color, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color, minWidth: 24 }}>{score}</span>
    </div>
  );
}

export default function Team() {
  const { currentUser } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');

  useEffect(() => {
    async function fetchMembers() {
      if (!currentUser || !userProfile) return;
      try {
        const companyId = userProfile.companyId;
        if (companyId) {
          const snap = await getDocs(query(
            collection(db, 'users'),
            where('companyId', '==', companyId),
            where('status', '==', 'approved'),
          ));
          const list = snap.docs
            .map(d => ({ uid: d.id, ...d.data() }))
            .filter(u => u.uid !== currentUser.uid);
          setMembers(list);
        }
      } catch (e) {
        console.warn('Could not load team members', e);
      }
      setLoading(false);
    }
    fetchMembers();
  }, [currentUser, userProfile]);

  const filtered = members.filter(m => {
    const matchRole = filter === 'All' || m.role === filter;
    const matchSearch = !search || m.displayName?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const roleCounts = allRoles.slice(1).reduce((acc, r) => ({ ...acc, [r]: members.filter(m => m.role === r).length }), {});

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>👥</div>
          <p>Loading team members...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }} className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Team</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 4 }}>
            {members.length} member{members.length !== 1 ? 's' : ''} across all roles
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('grid')} className={view === 'grid' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '0.4rem 0.75rem' }}>⊞ Grid</button>
          <button onClick={() => setView('list')} className={view === 'list' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '0.4rem 0.75rem' }}>≡ List</button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {Object.entries(roleCounts).filter(([, count]) => count > 0).map(([role, count]) => (
          <div key={role} className="card" style={{ padding: '0.875rem', textAlign: 'center', cursor: 'pointer', borderLeft: `3px solid ${roleColors[role]?.border || '#e2e8f0'}` }} onClick={() => setFilter(f => f === role ? 'All' : role)}>
            <div style={{ fontSize: '1.5rem' }}>{roleIcons[role]}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: roleColors[role]?.text || '#334155', marginTop: 2 }}>{count}</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{role}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="🔍  Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {allRoles.map(r => (
            <button key={r} onClick={() => setFilter(r)}
              style={{
                padding: '0.35rem 0.875rem', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: filter === r ? '#0f2044' : '#f1f5f9',
                color: filter === r ? '#fff' : '#475569',
              }}>
              {r} {r !== 'All' && roleCounts[r] ? `(${roleCounts[r]})` : r === 'All' ? `(${members.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Grid View */}
      {view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {filtered.map(member => {
            const rc = roleColors[member.role] || roleColors['Individual Contributor'];
            const isMe = member.uid === currentUser?.uid;
            return (
              <div key={member.uid} className="card" style={{ padding: '1.25rem', position: 'relative', borderTop: `3px solid ${rc.border}` }}>
                {isMe && (
                  <span style={{ position: 'absolute', top: 10, right: 10, background: '#0d9488', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>YOU</span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
                  <Avatar name={member.displayName} photoURL={member.photoURL} size={56} />
                  <div>
                    <p style={{ fontWeight: 700, color: '#1e293b', margin: 0, fontSize: '0.95rem' }}>{member.displayName || 'Unknown'}</p>
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '2px 0 0' }}>{member.email}</p>
                  </div>
                  <span style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, padding: '0.2rem 0.75rem', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>
                    {roleIcons[member.role]} {member.role}
                  </span>
                  {member.score && (
                    <div style={{ width: '100%' }}>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accountability Score</p>
                      <ScoreBar score={member.score} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#0f2044' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem 1.25rem', color: 'white', fontWeight: 600 }}>Member</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 500 }}>Role</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 500 }}>Email</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 500, minWidth: 140 }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member, i) => {
                const rc = roleColors[member.role] || roleColors['Individual Contributor'];
                const isMe = member.uid === currentUser?.uid;
                return (
                  <tr key={member.uid} style={{ borderBottom: '1px solid #f1f5f9', background: isMe ? '#f0fdfa' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '0.75rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={member.displayName} photoURL={member.photoURL} size={36} />
                        <div>
                          <p style={{ fontWeight: 700, color: '#1e293b', margin: 0 }}>{member.displayName || 'Unknown'}</p>
                          {isMe && <span style={{ fontSize: '0.65rem', background: '#0d9488', color: 'white', padding: '1px 6px', borderRadius: 9999, fontWeight: 700 }}>YOU</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, padding: '0.15rem 0.6rem', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {roleIcons[member.role]} {member.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{member.email}</td>
                    <td style={{ padding: '0.75rem 1rem', minWidth: 140 }}>
                      {member.score ? <ScoreBar score={member.score} /> : <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>No score yet</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No members match your search.</div>
          )}
        </div>
      )}
    </div>
  );
}
