import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logPointEvent, calculateScore } from '../utils/scoring';

const discProfiles = {
  D: { name: 'Dominance',        color: '#ef4444', traits: ['Results-oriented','Direct & decisive','Competitive','Problem-solver','High sense of urgency'], strengths: 'Drives results, takes initiative, thrives under pressure', challenges: 'May overlook feelings, appear blunt, move too fast', tips: 'Slow down for team input. Ask questions before deciding.' },
  I: { name: 'Influence',        color: '#f59e0b', traits: ['Enthusiastic & optimistic','Collaborative','Persuasive','People-focused','Creative'], strengths: 'Inspires others, builds relationships, creates excitement', challenges: 'May avoid conflict, lose focus, overcommit', tips: 'Follow through on commitments. Use structure to stay organized.' },
  S: { name: 'Steadiness',       color: '#0d9488', traits: ['Patient & consistent','Dependable','Team player','Good listener','Diplomatic'], strengths: 'Creates harmony, reliable under stress, strong team builder', challenges: 'May resist change, avoid confrontation, struggle with urgency', tips: 'Practice speaking up earlier. Change is growth.' },
  C: { name: 'Conscientiousness',color: '#1e3a6e', traits: ['Analytical & precise','Quality-focused','Systematic','Detail-oriented','Fact-based'], strengths: 'Produces high-quality work, identifies risks, ensures accuracy', challenges: 'Analysis paralysis, overly critical, slow to decide', tips: 'Good is sometimes better than perfect. Ship and iterate.' },
};

const questions = [
  { id: 1, text: 'In a group project, I usually:',     D: 'Take charge and set direction',       I: 'Motivate and energize the team',          S: 'Support and listen to everyone',   C: 'Analyze and ensure quality' },
  { id: 2, text: 'When facing a problem, I:',          D: 'Act quickly and decisively',           I: 'Brainstorm with others enthusiastically', S: 'Think carefully and seek consensus', C: 'Research thoroughly before deciding' },
  { id: 3, text: 'My biggest strength at work is:',   D: 'Getting results fast',                 I: 'Building relationships',                  S: 'Being reliable and calm',          C: 'High accuracy and quality' },
  { id: 4, text: 'Others would describe me as:',      D: 'Direct and driven',                    I: 'Energetic and fun',                       S: 'Steady and dependable',            C: 'Thorough and precise' },
  { id: 5, text: 'Under pressure, I tend to:',        D: 'Push harder and faster',               I: 'Talk more and rally people',              S: 'Stay calm and patient',            C: 'Become more analytical' },
  { id: 6, text: 'I prefer meetings that are:',       D: 'Short, decisive, and action-focused',  I: 'Collaborative with open discussion',      S: 'Structured and inclusive',         C: 'Data-driven with clear agendas' },
  { id: 7, text: 'My communication style is:',        D: 'Blunt and to the point',               I: 'Expressive and storytelling',             S: 'Warm and diplomatic',              C: 'Factual and detailed' },
  { id: 8, text: 'I am most motivated by:',           D: 'Achieving challenging goals',           I: 'Recognition and fun',                     S: 'Team harmony and stability',       C: 'Mastery and accuracy' },
];

function balanceNote(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = sorted.filter(([, v]) => v >= sorted[0][1] - 1 && v > 0);
  if (top.length === 1) {
    return { level: 'warn', text: `Strongly ${discProfiles[top[0][0]].name}-dominant. Consider developing complementary styles for greater versatility.` };
  }
  if (top.length >= 3) {
    return { level: 'good', text: `Well-balanced across ${top.map(([k]) => k).join(', ')} — a versatile leadership style that adapts well to different situations.` };
  }
  return { level: 'good', text: `Balanced blend of ${top.map(([k]) => `${k} (${discProfiles[k].name})`).join(' & ')} — a strong combination for adaptive leadership.` };
}

function SavedPanel({ entries, onDelete }) {
  return (
    <div style={{ width: 270, flexShrink: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem', alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
      <p style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0 0 4px' }}>Assessment History</p>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 14px' }}>Goal: balanced across 2–3 styles</p>

      {entries.length === 0
        ? <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 24 }}>No assessments saved yet.</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 560, overflowY: 'auto' }}>
            {entries.map(e => {
              const taken = e.createdAt?.seconds ? new Date(e.createdAt.seconds * 1000) : new Date();
              const next  = new Date(taken); next.setMonth(next.getMonth() + 1);
              const note  = balanceNote(e.scores);
              const sorted = Object.entries(e.scores).sort((a, b) => b[1] - a[1]);
              return (
                <div key={e.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '0.875rem', border: '1px solid var(--border)' }}>
                  {/* date + primary */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{taken.toLocaleDateString()}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 800, background: discProfiles[e.primary].color, color: 'white' }}>
                      {e.primary} — {discProfiles[e.primary].name}
                    </span>
                  </div>

                  {/* score bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {sorted.map(([type, score]) => (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 14, fontSize: '0.68rem', fontWeight: 800, color: discProfiles[type].color }}>{type}</span>
                        <div style={{ flex: 1, height: 6, borderRadius: 9999, background: '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 9999, background: discProfiles[type].color, width: `${(score / questions.length) * 100}%` }} />
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', width: 12, textAlign: 'right' }}>{score}</span>
                      </div>
                    ))}
                  </div>

                  {/* balance note */}
                  <p style={{ fontSize: '0.68rem', color: note.level === 'good' ? '#0d9488' : '#f59e0b', margin: '0 0 8px', lineHeight: 1.4, fontWeight: 600 }}>
                    {note.level === 'good' ? '✓' : '⚠'} {note.text}
                  </p>

                  {/* next re-evaluation */}
                  <div style={{ background: '#eff6ff', borderRadius: 7, padding: '0.4rem 0.6rem', marginBottom: 8 }}>
                    <p style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 700, margin: 0 }}>📅 Re-evaluate by {next.toLocaleDateString()}</p>
                  </div>

                  <button onClick={() => onDelete(e.id)}
                    style={{ width: '100%', padding: '0.25rem 0', borderRadius: 7, fontSize: '0.7rem', fontWeight: 700, border: '1px solid #fca5a5', background: 'white', color: '#ef4444', cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

export default function DISC() {
  const { currentUser } = useAuth();
  const [answers, setAnswers]           = useState({});
  const [result, setResult]             = useState(null);
  const [view, setView]                 = useState('assessment');
  const [saved, setSaved]               = useState([]);
  const [discMeta, setDiscMeta]         = useState(null); // { lastAt: ms, earned: bool }

  async function fetchSaved() {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (!snap.exists()) return;
      const data = snap.data();
      setSaved(data.discAssessments || []);
      const lastSec = data.discLastAssessmentAt?.seconds;
      setDiscMeta({
        lastAt:  lastSec ? lastSec * 1000 : null,
        earned:  !!data.discPointsEarned,
      });
    } catch (e) {
      console.error('fetchSaved error:', e);
    }
  }

  async function persist(updated) {
    await setDoc(doc(db, 'users', currentUser.uid), { discAssessments: updated }, { merge: true });
    setSaved(updated);
  }

  useEffect(() => { fetchSaved(); }, [currentUser]);

  function calculate() {
    if (Object.keys(answers).length < questions.length) return toast.error('Please answer all questions');
    const scores = { D: 0, I: 0, S: 0, C: 0 };
    Object.values(answers).forEach(t => scores[t]++);
    const primary = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    setResult({ scores, primary });
    setView('results');
  }

  async function handleSave() {
    if (!result) return;
    if (!currentUser) return toast.error('Not logged in');
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const newEntry = {
        id: Date.now().toString(),
        scores: result.scores,
        primary: result.primary,
        answers,
        createdAt: { seconds: nowSec },
      };
      await persist([newEntry, ...saved]);

      // Always refresh the 90-day clock
      await updateDoc(doc(db, 'users', currentUser.uid), {
        discLastAssessmentAt: { seconds: nowSec },
      });

      // Award +5 pts one time ever
      const firstTime = !discMeta?.earned;
      if (firstTime) {
        await logPointEvent(currentUser.uid, {
          points: 5,
          toolLabel: 'DISC Assessment',
          reason: 'Completed first DISC personality assessment',
        });
        await updateDoc(doc(db, 'users', currentUser.uid), { discPointsEarned: true });
        toast.success('⭐ Assessment saved — +5 pts! Valid for 90 days.', { duration: 6000, icon: '🌟' });
      } else {
        toast.success('Assessment saved! Your 90-day score window has been reset.');
      }

      setDiscMeta({ lastAt: nowSec * 1000, earned: true });
      calculateScore(currentUser.uid).catch(() => {});
    } catch (e) {
      toast.error('Save failed: ' + e?.message);
    }
  }

  async function handleDelete(id) {
    try {
      await persist(saved.filter(e => e.id !== id));
    } catch (e) {
      toast.error('Delete failed: ' + e?.message);
    }
  }

  const answerCount = Object.keys(answers).length;
  const allAnswered = answerCount === questions.length;
  const tabs = [
    { id: 'assessment', label: '📋 Assessment' },
    { id: 'profiles',   label: '📖 DISC Profiles' },
    ...(result ? [{ id: 'results', label: '🏆 My Results' }] : []),
  ];

  // Warning banner logic
  const discDaysAgo  = discMeta?.lastAt ? Math.floor((Date.now() - discMeta.lastAt) / 86400000) : null;
  const discDaysLeft = discDaysAgo !== null ? 90 - discDaysAgo : null;
  const nextDueDate  = discMeta?.lastAt
    ? new Date(discMeta.lastAt + 90 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const showExpiredBanner = discMeta?.earned && discDaysLeft !== null && discDaysLeft < 0;
  const showWarnBanner    = discMeta?.earned && discDaysLeft !== null && discDaysLeft >= 0 && discDaysLeft <= 30;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader icon="🧠" title="DISC Personality Assessment" subtitle="Understand your behavioral style and leadership tendencies" />

      {/* Expired banner — 5 pts lost */}
      {showExpiredBanner && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 12, padding: '0.875rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>🔴</span>
          <div>
            <p style={{ fontWeight: 800, color: '#dc2626', margin: '0 0 2px', fontSize: '0.875rem' }}>DISC Score Expired — 5 points deducted</p>
            <p style={{ color: '#7f1d1d', fontSize: '0.78rem', margin: 0 }}>
              Your last assessment was <strong>{Math.abs(discDaysLeft)} days</strong> ago. Complete a new DISC assessment to restore your 5 points.
            </p>
          </div>
          <button onClick={() => setView('assessment')}
            style={{ marginLeft: 'auto', flexShrink: 0, background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '0.4rem 0.875rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
            Take Assessment →
          </button>
        </div>
      )}

      {/* Warning banner — expiring soon */}
      {showWarnBanner && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 12, padding: '0.875rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠️</span>
          <div>
            <p style={{ fontWeight: 800, color: '#92400e', margin: '0 0 2px', fontSize: '0.875rem' }}>DISC Renewal Due — {discDaysLeft} day{discDaysLeft !== 1 ? 's' : ''} left</p>
            <p style={{ color: '#78350f', fontSize: '0.78rem', margin: 0 }}>
              Your 5 points expire on <strong>{nextDueDate}</strong>. Complete a new assessment before then to keep your score.
            </p>
          </div>
          <button onClick={() => setView('assessment')}
            style={{ marginLeft: 'auto', flexShrink: 0, background: '#d97706', color: 'white', border: 'none', borderRadius: 8, padding: '0.4rem 0.875rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
            Renew Now →
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left: main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setView(t.id)}
                style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: view === t.id ? '#0f2044' : '#f1f5f9', color: view === t.id ? 'white' : '#475569' }}>
                {t.label}
              </button>
            ))}
          </div>

          {view === 'assessment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 9999, height: 8 }}>
                  <div style={{ height: 8, borderRadius: 9999, background: '#0d9488', width: `${(answerCount / questions.length) * 100}%`, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>{answerCount}/{questions.length}</span>
              </div>
              {questions.map(q => (
                <div key={q.id} className="card" style={{ padding: '1.25rem' }}>
                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.875rem', fontSize: '0.9375rem' }}>{q.id}. {q.text}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {Object.entries({ D: q.D, I: q.I, S: q.S, C: q.C }).map(([type, text]) => (
                      <button key={type} onClick={() => setAnswers(a => ({ ...a, [q.id]: type }))}
                        style={{ textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: 10, fontSize: '0.85rem', cursor: 'pointer', border: `2px solid ${answers[q.id] === type ? discProfiles[type].color : '#e2e8f0'}`, background: answers[q.id] === type ? discProfiles[type].color : 'transparent', color: answers[q.id] === type ? 'white' : '#475569', fontWeight: answers[q.id] === type ? 700 : 400, transition: 'all 0.15s' }}>
                        <span style={{ fontWeight: 800, marginRight: 6 }}>{type}:</span>{text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button className="btn-primary" onClick={calculate} disabled={!allAnswered}
                style={{ opacity: allAnswered ? 1 : 0.6, cursor: allAnswered ? 'pointer' : 'not-allowed' }}>
                {allAnswered ? '✓ Calculate My DISC Profile' : `Answer ${questions.length - answerCount} more question${questions.length - answerCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {view === 'profiles' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
              {Object.entries(discProfiles).map(([key, profile]) => (
                <div key={key} className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.875rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.25rem', fontWeight: 900, flexShrink: 0, background: profile.color }}>{key}</div>
                    <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '1.0625rem' }}>{profile.name}</h4>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '0.875rem' }}>
                    {profile.traits.map(t => (
                      <span key={t} style={{ padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, background: profile.color + '18', color: profile.color }}>{t}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}><strong>Strengths:</strong> {profile.strengths}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 8px' }}><strong>Watch out for:</strong> {profile.challenges}</p>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, fontStyle: 'italic', color: profile.color, margin: 0 }}>💡 {profile.tips}</p>
                </div>
              ))}
            </div>
          )}

          {view === 'results' && result && (() => {
            const note = balanceNote(result.scores);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ borderRadius: 16, padding: '1.75rem', color: 'white', background: `linear-gradient(135deg, ${discProfiles[result.primary].color}, #0f2044)` }}>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Your Primary DISC Style</p>
                  <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 8px', color: 'white' }}>{result.primary} — {discProfiles[result.primary].name}</h2>
                  <p style={{ color: 'rgba(255,255,255,0.85)', margin: '0 0 16px', fontSize: '0.9rem' }}>{discProfiles[result.primary].strengths}</p>
                  <button onClick={handleSave}
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 9, padding: '0.4rem 1rem', color: 'white', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                    💾 Save Results
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {Object.entries(result.scores).map(([type, score]) => (
                    <div key={type} className="stat-tile" style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.75rem', fontWeight: 900, color: discProfiles[type].color }}>{score}</div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{type}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{discProfiles[type].name}</div>
                    </div>
                  ))}
                </div>

                {/* Balance insight */}
                <div className="card" style={{ padding: '1.25rem', borderLeft: `4px solid ${note.level === 'good' ? '#0d9488' : '#f59e0b'}` }}>
                  <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', fontSize: '0.9375rem' }}>
                    {note.level === 'good' ? '✅ Style Balance' : '⚠️ Style Balance'}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>{note.text}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '8px 0 0', fontStyle: 'italic' }}>
                    A well-rounded leader blends 2–3 styles. If you score heavily in one area, practice the complementary styles to become more adaptable.
                  </p>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', fontSize: '0.9375rem' }}>Development Tips for {result.primary} Style</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 8px' }}><strong>Watch out for:</strong> {discProfiles[result.primary].challenges}</p>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0d9488', margin: 0 }}>💡 {discProfiles[result.primary].tips}</p>
                </div>

                <button className="btn-secondary" onClick={() => { setAnswers({}); setResult(null); setView('assessment'); }}>Retake Assessment</button>
              </div>
            );
          })()}
        </div>

        {/* Right: saved panel */}
        <SavedPanel entries={saved} onDelete={handleDelete} />
      </div>
    </div>
  );
}
