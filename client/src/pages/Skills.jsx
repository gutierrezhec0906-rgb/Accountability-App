import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

const defaultCategories = [
  { category: 'Leadership',    skills: [{ name: 'Strategic Thinking', self: 3, peer: 0 },{ name: 'Team Development', self: 3, peer: 0 },{ name: 'Decision Making', self: 3, peer: 0 },{ name: 'Communication', self: 3, peer: 0 }] },
  { category: 'Technical',     skills: [{ name: 'Lean Principles', self: 3, peer: 0 },{ name: 'Data Analysis', self: 3, peer: 0 },{ name: 'Root Cause Analysis', self: 3, peer: 0 },{ name: 'Project Management', self: 3, peer: 0 }] },
  { category: 'Interpersonal', skills: [{ name: 'Conflict Resolution', self: 3, peer: 0 },{ name: 'Coaching & Mentoring', self: 3, peer: 0 },{ name: 'Emotional Intelligence', self: 3, peer: 0 },{ name: 'Active Listening', self: 3, peer: 0 }] },
];

const levelLabels = ['','Novice','Developing','Proficient','Advanced','Expert'];
const catColors = { Leadership: '#0f2044', Technical: '#0891b2', Interpersonal: '#8b5cf6' };

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RatingDots({ value, onChange, color }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => onChange && onChange(n)}
          style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${n <= value ? color : '#e2e8f0'}`, background: n <= value ? color : 'transparent', color: n <= value ? 'white' : '#cbd5e1', fontWeight: 700, fontSize: '0.75rem', cursor: onChange ? 'pointer' : 'default', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {n}
        </button>
      ))}
    </div>
  );
}

export default function Skills() {
  const { currentUser, userProfile } = useAuth();
  const [matrix, setMatrix] = useState(defaultCategories);
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newSkill, setNewSkill] = useState({ category: 'Leadership', name: '', self: 3 });
  const [history, setHistory] = useState([]);
  const [expandedRec, setExpandedRec] = useState(null);
  const [saving, setSaving] = useState(false);

  // Peer assessment (leaders only)
  const [team, setTeam] = useState([]);
  const [assessingUid, setAssessingUid] = useState('');
  const [peerRatings, setPeerRatings] = useState({});
  const [savingPeer, setSavingPeer] = useState(false);

  const isLeader = userProfile?.isAdmin || userProfile?.role === 'Leader' || userProfile?.role === 'Manager';

  useEffect(() => {
    async function load() {
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.skillsMatrix)  setMatrix(data.skillsMatrix);
          if (data.skillsHistory) setHistory(data.skillsHistory);
        }
      } catch (e) { console.error(e); }
    }
    load();
  }, [currentUser]);

  // Leaders: load teammates in the same company (skill names only are shown — blind rating)
  useEffect(() => {
    async function fetchTeam() {
      const companyId = userProfile?.companyId;
      if (!companyId || !isLeader || !currentUser) return;
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('companyId', '==', companyId)));
        const members = [];
        snap.forEach(d => {
          if (d.id === currentUser.uid) return;
          const u = d.data();
          members.push({
            uid: d.id,
            name: u.displayName || u.email || 'Unknown',
            matrix: u.skillsMatrix || defaultCategories,
          });
        });
        setTeam(members);
      } catch (e) { console.error(e); }
    }
    fetchTeam();
  }, [userProfile?.companyId, isLeader, currentUser]);

  const assessee = team.find(t => t.uid === assessingUid) || null;
  const assesseeSkillCount = assessee ? assessee.matrix.flatMap(c => c.skills).length : 0;
  const peerRatedCount = Object.values(peerRatings).filter(v => v > 0).length;
  const allPeerRated = assessee && peerRatedCount === assesseeSkillCount && assesseeSkillCount > 0;

  function skillKey(cat, name) { return `${cat}|${name}`; }

  async function savePeerAssessment() {
    if (!assessee || !allPeerRated) return;
    setSavingPeer(true);
    try {
      const now = new Date().toISOString();
      const assessorName = userProfile?.displayName || userProfile?.email || 'Leader';

      // Re-read the teammate's doc fresh so we don't clobber concurrent changes
      const snap = await getDoc(doc(db, 'users', assessee.uid));
      const data = snap.exists() ? snap.data() : {};
      const theirMatrix = data.skillsMatrix || defaultCategories;

      const updatedMatrix = theirMatrix.map(cat => ({
        ...cat,
        skills: cat.skills.map(s => {
          const rating = peerRatings[skillKey(cat.category, s.name)];
          return rating > 0 ? { ...s, peer: rating, peerBy: assessorName, peerAt: now } : s;
        }),
      }));

      const ratedVals = Object.values(peerRatings).filter(v => v > 0);
      const avgPeerNow = +(ratedVals.reduce((a, b) => a + b, 0) / ratedVals.length).toFixed(1);
      const allTheirSkills = updatedMatrix.flatMap(c => c.skills);
      const avgSelfNow = allTheirSkills.length
        ? +(allTheirSkills.reduce((a, s) => a + s.self, 0) / allTheirSkills.length).toFixed(1) : 0;

      const record = {
        id: now,
        savedAt: now,
        type: 'peer',
        assessorName,
        avgSelf: avgSelfNow,
        avgPeer: avgPeerNow,
        snapshot: updatedMatrix.map(cat => ({
          category: cat.category,
          skills: cat.skills.map(s => ({ name: s.name, self: s.self, peer: s.peer || 0 })),
        })),
      };
      const theirHistory = [record, ...(data.skillsHistory || [])].slice(0, 12);

      await setDoc(doc(db, 'users', assessee.uid), {
        skillsMatrix: updatedMatrix,
        skillsHistory: theirHistory,
      }, { merge: true });

      toast.success(`Peer assessment saved for ${assessee.name}`);
      setAssessingUid('');
      setPeerRatings({});
      // Refresh team so a re-open shows current state
      setTeam(t => t.map(m => m.uid === assessee.uid ? { ...m, matrix: updatedMatrix } : m));
    } catch (e) {
      console.error(e);
      toast.error('Save failed — check permissions');
    }
    setSavingPeer(false);
  }

  function updateSelf(catIdx, skillIdx, val) {
    setMatrix(m => m.map((cat, ci) => ci !== catIdx ? cat : { ...cat, skills: cat.skills.map((s, si) => si !== skillIdx ? s : { ...s, self: val }) }));
  }

  const allSkills = matrix.flatMap(c => c.skills);
  const avgSelf = allSkills.length ? +(allSkills.reduce((a, s) => a + s.self, 0) / allSkills.length).toFixed(1) : 0;
  const peerRated = allSkills.filter(s => s.peer > 0);
  const avgPeer = peerRated.length ? +(peerRated.reduce((a, s) => a + s.peer, 0) / peerRated.length).toFixed(1) : null;

  async function saveAssessment() {
    if (!currentUser) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const record = {
        id: now,
        savedAt: now,
        avgSelf,
        avgPeer,
        snapshot: matrix.map(cat => ({
          category: cat.category,
          skills: cat.skills.map(s => ({ name: s.name, self: s.self, peer: s.peer || 0 })),
        })),
      };
      const updatedHistory = [record, ...history].slice(0, 12);
      await setDoc(doc(db, 'users', currentUser.uid), {
        skillsMatrix: matrix,
        skillsHistory: updatedHistory,
      }, { merge: true });
      setHistory(updatedHistory);
      toast.success('Assessment saved');
    } catch (e) {
      console.error(e);
      toast.error('Save failed');
    }
    setSaving(false);
  }

  async function addSkill(e) {
    e.preventDefault();
    const updated = matrix.map(cat => cat.category !== newSkill.category ? cat : { ...cat, skills: [...cat.skills, { name: newSkill.name, self: newSkill.self, peer: 0 }] });
    setMatrix(updated);
    setNewSkill({ category: 'Leadership', name: '', self: 3 });
    setShowAdd(false);
    try {
      if (currentUser) await setDoc(doc(db, 'users', currentUser.uid), { skillsMatrix: updated }, { merge: true });
      toast.success('Skill added');
    } catch (e) { console.error(e); toast.error('Save failed'); }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader icon="⭐" title="Skills Development Matrix" subtitle="Self-assessment and peer ratings across skill domains"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={editMode ? 'btn-primary' : 'btn-secondary'} disabled={saving}
              onClick={() => {
                if (editMode) saveAssessment();
                setEditMode(e => !e);
              }}>
              {editMode ? (saving ? 'Saving…' : '✓ Save Assessment') : '✏️ Edit'}
            </button>
            <button className="btn-primary" onClick={() => setShowAdd(s => !s)}>+ Add Skill</button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
        <div className="stat-tile" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Avg Self-Assessment</p>
          <p style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0d9488', margin: 0 }}>{avgSelf}<span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 400 }}>/5</span></p>
        </div>
        <div className="stat-tile" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Avg Peer Rating</p>
          <p style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f2044', margin: 0 }}>{avgPeer ?? '—'}<span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 400 }}>/5</span></p>
        </div>
      </div>

      {/* Leader: peer assessment panel */}
      {isLeader && team.length > 0 && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid #c4b5fd', background: '#faf5ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '1.1rem' }}>👥</span>
            <h3 style={{ fontWeight: 800, color: '#5b21b6', margin: 0, fontSize: '0.95rem' }}>Assess a Teammate</h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#7c3aed', margin: '0 0 12px', lineHeight: 1.5 }}>
            Rate each skill from your own observation. Their self-ratings are hidden on purpose — a blind rating is what makes the gap analysis honest.
          </p>

          <select className="input" value={assessingUid}
            onChange={e => { setAssessingUid(e.target.value); setPeerRatings({}); }}
            style={{ marginBottom: assessingUid ? 14 : 0, maxWidth: 360 }}>
            <option value="">Select a teammate…</option>
            {team.map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}
          </select>

          {assessee && assesseeSkillCount === 0 && (
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>This teammate has no skills defined yet.</p>
          )}

          {assessee && assesseeSkillCount > 0 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {assessee.matrix.map(cat => (
                  <div key={cat.category} style={{ background: 'white', borderRadius: 12, border: '1px solid #e9d5ff', overflow: 'hidden' }}>
                    <div style={{ padding: '0.5rem 1rem', background: catColors[cat.category] || '#0f2044' }}>
                      <span style={{ color: 'white', fontWeight: 800, fontSize: '0.8rem' }}>{cat.category}</span>
                    </div>
                    {cat.skills.map((s, si) => {
                      const key = skillKey(cat.category, s.name);
                      return (
                        <div key={s.name} style={{ padding: '0.75rem 1rem', borderBottom: si < cat.skills.length - 1 ? '1px solid #f3e8ff' : 'none' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', margin: '0 0 8px' }}>{s.name}</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '42px auto', columnGap: 12, alignItems: 'center', justifyContent: 'start' }}>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peer</p>
                            <RatingDots value={peerRatings[key] || 0}
                              onChange={val => setPeerRatings(r => ({ ...r, [key]: val }))} color="#7c3aed" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: allPeerRated ? '#15803d' : '#7c3aed' }}>
                  {peerRatedCount}/{assesseeSkillCount} skills rated {allPeerRated ? '✓' : ''}
                </span>
                <button className="btn-primary" onClick={savePeerAssessment}
                  disabled={savingPeer || !allPeerRated}
                  style={{ background: '#7c3aed', borderColor: '#7c3aed', opacity: allPeerRated ? 1 : 0.5 }}>
                  {savingPeer ? 'Saving…' : `💾 Save Peer Assessment for ${assessee.name}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showAdd && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>Add New Skill</h3>
          <form onSubmit={addSkill} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <div><label className="label">Category</label><select className="input" value={newSkill.category} onChange={e => setNewSkill(f => ({ ...f, category: e.target.value }))}>{matrix.map(c => <option key={c.category}>{c.category}</option>)}</select></div>
            <div><label className="label">Skill Name</label><input className="input" required value={newSkill.name} onChange={e => setNewSkill(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Agile Methodology" /></div>
            <div><label className="label">Initial Rating</label><input className="input" type="number" min={1} max={5} value={newSkill.self} onChange={e => setNewSkill(f => ({ ...f, self: +e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit">Add Skill</button>
              <button className="btn-secondary" type="button" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {matrix.map((cat, ci) => (
          <div key={cat.category} className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1.25rem', background: catColors[cat.category] || '#0f2044', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>{cat.category}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{cat.skills.length} skills</span>
            </div>
            <div>
              {cat.skills.map((skill, si) => (
                <div key={skill.name} style={{ padding: '0.875rem 1.25rem', borderBottom: si < cat.skills.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {/* Line 1: name + level on the left, badges on the right */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0 0 2px' }}>{skill.name}</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>{levelLabels[skill.self]}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {skill.self > skill.peer && skill.peer > 0 && <span className="badge-yellow">Gap</span>}
                      {skill.peer > skill.self && <span className="badge-green" style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 700 }}>Hidden Strength</span>}
                      {skill.self < 3 && <span className="badge-red">Develop</span>}
                    </div>
                  </div>
                  {/* Line 2: ratings in a fixed-width label grid — identical left edge on every row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '42px auto', columnGap: 12, rowGap: 8, alignItems: 'center', justifyContent: 'start' }}>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Self</p>
                    <RatingDots value={skill.self} onChange={editMode ? val => updateSelf(ci, si, val) : null} color="#0d9488" />
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peer</p>
                    {skill.peer > 0
                      ? <div>
                          <RatingDots value={skill.peer} color="#0f2044" />
                          {skill.peerBy && (
                            <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '3px 0 0' }}>
                              by {skill.peerBy}{skill.peerAt ? ` · ${new Date(skill.peerAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                            </p>
                          )}
                        </div>
                      : <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>Awaiting peer assessment</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Assessment records */}
      {history.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginTop: '1.5rem' }}>
          <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.9rem' }}>Assessment Records</h4>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>Every saved assessment with its date — tap one to see the full snapshot</p>
          <style>{`
            .skills-rec-scroll::-webkit-scrollbar { width: 8px; -webkit-appearance: none; }
            .skills-rec-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 8px; }
            .skills-rec-scroll::-webkit-scrollbar-thumb { background: #64748b; border-radius: 8px; border: 1px solid #e2e8f0; }
          `}</style>
          <div className="skills-rec-scroll" style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            maxHeight: 420, overflowY: history.length > 4 ? 'scroll' : 'visible',
            paddingRight: 6,
            scrollbarWidth: 'thin', scrollbarColor: '#64748b #e2e8f0',
          }}>
            {history.map((rec, i) => {
              const prev = history[i + 1];
              const delta = prev ? +(rec.avgSelf - prev.avgSelf).toFixed(1) : null;
              return (
                <div key={rec.id} style={{ borderRadius: 10, border: `1px solid ${i === 0 ? '#99f6e4' : '#e2e8f0'}`, overflow: 'hidden', flexShrink: 0 }}>
                  <button onClick={() => setExpandedRec(expandedRec === rec.id ? null : rec.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0.65rem 0.875rem', background: i === 0 ? '#f0fdfa' : '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {i === 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#0d9488', color: 'white', padding: '1px 7px', borderRadius: 9999 }}>Latest</span>}
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: 9999,
                          background: rec.type === 'peer' ? '#ede9fe' : '#f0fdfa',
                          color: rec.type === 'peer' ? '#7c3aed' : '#0d9488' }}>
                          {rec.type === 'peer' ? `👥 Peer · ${rec.assessorName || 'Leader'}` : 'Self'}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtDate(rec.savedAt)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', color: '#0d9488', fontWeight: 700 }}>Self: {rec.avgSelf}/5</span>
                        <span style={{ fontSize: '0.72rem', color: '#0f2044', fontWeight: 700 }}>Peer: {rec.avgPeer ?? '—'}/5</span>
                        {delta !== null && delta !== 0 && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: delta > 0 ? '#15803d' : '#dc2626' }}>
                            {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`} vs previous
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', flexShrink: 0 }}>{expandedRec === rec.id ? '▲' : '▼'}</span>
                  </button>
                  {expandedRec === rec.id && (
                    <div style={{ padding: '0.75rem 0.875rem', background: 'white', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(rec.snapshot || []).map(cat => (
                        <div key={cat.category}>
                          <p style={{ fontSize: '0.7rem', fontWeight: 800, color: catColors[cat.category] || '#0f2044', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.category}</p>
                          {cat.skills.map(s => (
                            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0', borderBottom: '1px dashed #f1f5f9' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.name}</span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', flexShrink: 0 }}>
                                Self {s.self} · Peer {s.peer || '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
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
