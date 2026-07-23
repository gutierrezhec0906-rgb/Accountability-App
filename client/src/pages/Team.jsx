import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const roleColors = {
  Leader: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  Manager: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  Supervisor: { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
  'Individual Contributor': { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
};

const roleIcons = {
  Leader: '👑',
  Manager: '🏢',
  Supervisor: '🎯',
  'Individual Contributor': '👤',
};

const allRoles = ['All', 'Leader', 'Manager', 'Supervisor', 'Individual Contributor'];

// Org-chart hierarchy: lower rank = higher in the chart.
const ROLE_RANK = { Leader: 0, Manager: 1, Supervisor: 2, 'Individual Contributor': 3 };

function Avatar({ name, photoURL, size = 40 }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const colors = ['#0d9488', '#0f2044', '#7c3aed', '#be185d', '#b45309', '#065f46'];
  const color = colors[name?.charCodeAt(0) % colors.length] || '#0d9488';
  if (photoURL) {
    return <img src={photoURL} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #e2e8f0' }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function ScoreBar({ score }) {
  const pct = Math.min(100, score);
  const color = score >= 75 ? '#0d9488' : score >= 50 ? '#f59e0b' : score >= 25 ? '#f97316' : '#94a3b8';
  const label = score >= 75 ? 'Exceptional' : score >= 50 ? 'High Performer' : score >= 25 ? 'Developing' : 'Getting Started';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 9999, height: 6 }}>
        <div style={{ width: `${pct}%`, height: 6, borderRadius: 9999, background: color, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 800, color, minWidth: 28 }}>{score}</span>
      <span style={{ fontSize: '0.65rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

export default function Team() {
  const { currentUser, userProfile } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [orgDefaulted, setOrgDefaulted] = useState(false);

  const isAdmin = currentUser?.email === 'hectorg@accountability-app.com' || userProfile?.isAdmin;

  // Admins land on the org-chart view by default (once).
  useEffect(() => {
    if (isAdmin && !orgDefaulted) { setView('org'); setOrgDefaulted(true); }
  }, [isAdmin, orgDefaulted]);
  const isLeader = userProfile?.role === 'Leader';
  const canSeeScores = isAdmin || isLeader;

  useEffect(() => {
    async function fetchMembers() {
      if (!currentUser) return;
      try {
        let snap;
        if (isAdmin) {
          // Admin sees ALL approved users
          snap = await getDocs(query(collection(db, 'users'), where('status', '==', 'approved')));
        } else {
          // Leader/others see only their company
          const companyId = userProfile?.companyId;
          if (!companyId) { setLoading(false); return; }
          snap = await getDocs(query(
            collection(db, 'users'),
            where('companyId', '==', companyId),
            where('status', '==', 'approved'),
          ));
        }
        const list = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.uid !== currentUser.uid)
          .sort((a, b) => (b.calculatedScore ?? 0) - (a.calculatedScore ?? 0));
        setMembers(list);
      } catch (e) {
        console.warn('Could not load team members', e);
      }
      setLoading(false);
    }
    if (userProfile !== undefined) fetchMembers();
  }, [currentUser, userProfile, isAdmin]);

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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            {isAdmin ? 'All Members' : 'Team'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 4 }}>
            {members.length} member{members.length !== 1 ? 's' : ''}{isAdmin ? ' across all companies' : ' in your team'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && <button onClick={() => setView('org')} className={view === 'org' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '0.4rem 0.75rem' }}>🗂 Org Chart</button>}
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

      {/* Org Chart View (admin only) — grouped by company, ranked top-down */}
      {isAdmin && view === 'org' && (() => {
        const byCompany = {};
        filtered.forEach(m => {
          const c = m.companyName || 'No Company';
          (byCompany[c] = byCompany[c] || []).push(m);
        });
        const companies = Object.keys(byCompany).sort((a, b) => a.localeCompare(b));
        if (companies.length === 0) {
          return <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No members match your search.</div>;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {companies.map(company => {
              // Group this company's members by role, ordered by rank (top → bottom).
              const members = [...byCompany[company]].sort(
                (a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) || (a.displayName || '').localeCompare(b.displayName || '')
              );
              const levels = [];
              members.forEach(m => {
                const rank = ROLE_RANK[m.role] ?? 9;
                let lvl = levels.find(l => l.rank === rank);
                if (!lvl) { lvl = { rank, members: [] }; levels.push(lvl); }
                lvl.members.push(m);
              });
              return (
                <div key={company} className="card" style={{ padding: '1.25rem 1rem 1.5rem', overflowX: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingLeft: 4 }}>
                    <span style={{ fontSize: '1.1rem' }}>🏢</span>
                    <h3 style={{ fontWeight: 800, color: '#0f2044', margin: 0, fontSize: '1rem' }}>{company}</h3>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 9999, fontWeight: 700 }}>
                      {byCompany[company].length} member{byCompany[company].length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 'fit-content' }}>
                    {levels.map((lvl, li) => (
                      <div key={lvl.rank} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                        {li > 0 && <div style={{ width: 2, height: 22, background: '#cbd5e1' }} />}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {lvl.members.map(member => {
                            const rc = roleColors[member.role] || roleColors['Individual Contributor'];
                            const score = member.calculatedScore ?? null;
                            return (
                              <div key={member.uid} style={{
                                width: 210, background: 'white', border: `1px solid ${rc.border}`,
                                borderTop: `3px solid ${rc.text}`, borderRadius: 12, padding: '0.9rem',
                                boxShadow: '0 1px 6px rgba(15,32,68,0.06)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6,
                              }}>
                                <Avatar name={member.displayName} photoURL={member.photoURL} size={48} />
                                <p style={{ fontWeight: 700, color: '#1e293b', margin: 0, fontSize: '0.9rem' }}>{member.displayName || 'Unknown'}</p>
                                <span style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, padding: '0.15rem 0.6rem', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 700 }}>
                                  {roleIcons[member.role]} {member.role}
                                </span>
                                {canSeeScores && (score !== null
                                  ? <div style={{ width: '100%' }}><ScoreBar score={score} /></div>
                                  : <p style={{ fontSize: '0.68rem', color: '#cbd5e1', margin: 0 }}>No score yet</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Grid View */}
      {view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filtered.map(member => {
            const rc = roleColors[member.role] || roleColors['Individual Contributor'];
            const score = member.calculatedScore ?? null;
            return (
              <div key={member.uid} className="card" style={{ padding: '1.25rem', borderTop: `3px solid ${rc.border}` }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
                  <Avatar name={member.displayName} photoURL={member.photoURL} size={56} />
                  <div>
                    <p style={{ fontWeight: 700, color: '#1e293b', margin: 0, fontSize: '0.95rem' }}>{member.displayName || 'Unknown'}</p>
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '2px 0 0' }}>{member.email}</p>
                    {isAdmin && member.companyName && (
                      <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '2px 0 0', fontWeight: 600 }}>{member.companyName}</p>
                    )}
                  </div>
                  <span style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, padding: '0.2rem 0.75rem', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>
                    {roleIcons[member.role]} {member.role}
                  </span>
                  {canSeeScores && (
                    <div style={{ width: '100%' }}>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accountability Score</p>
                      {score !== null ? <ScoreBar score={score} /> : (
                        <p style={{ fontSize: '0.72rem', color: '#cbd5e1', margin: 0 }}>No score yet</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No members match your search.</div>
          )}
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
                {isAdmin && <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 500 }}>Company</th>}
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 500 }}>Email</th>
                {canSeeScores && <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 500, minWidth: 200 }}>Score</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((member, i) => {
                const rc = roleColors[member.role] || roleColors['Individual Contributor'];
                const score = member.calculatedScore ?? null;
                return (
                  <tr key={member.uid} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '0.75rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={member.displayName} photoURL={member.photoURL} size={36} />
                        <p style={{ fontWeight: 700, color: '#1e293b', margin: 0 }}>{member.displayName || 'Unknown'}</p>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, padding: '0.15rem 0.6rem', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {roleIcons[member.role]} {member.role}
                      </span>
                    </td>
                    {isAdmin && <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>{member.companyName || '—'}</td>}
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{member.email}</td>
                    {canSeeScores && (
                      <td style={{ padding: '0.75rem 1rem', minWidth: 200 }}>
                        {score !== null ? <ScoreBar score={score} /> : <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>No score yet</span>}
                      </td>
                    )}
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
