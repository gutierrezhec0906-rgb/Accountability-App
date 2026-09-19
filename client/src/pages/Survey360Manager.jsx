import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import toast from 'react-hot-toast';
import { generate360Report } from '../utils/survey360Report';

const CATEGORIES = [
  { id: 'model',     label: 'Set the Bar',            icon: '🧭', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'inspire',   label: 'Spark the Vision',  icon: '🔭', color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  { id: 'challenge', label: 'Improve the Flow',    icon: '⚙️', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  { id: 'enable',    label: 'Enable the Team',     icon: '🤝', color: '#7c3aed', bg: '#fdf4ff', border: '#e9d5ff' },
  { id: 'encourage', label: 'Winning with Compassion',      icon: '❤️', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
];

// Displayed category label is translated via trCatLabel; `id` stays stable for aggregation keys.
function trCatLabel(t, cat) { return t(`survey360Manager.categories.${cat.id}`, cat.label); }
const RELATIONSHIP_KEYS = {
  'Peer': 'peer', 'Direct Report': 'directReport', 'Manager': 'manager',
  'Cross-functional Partner': 'crossFunctionalPartner', 'Other': 'other',
};
// `r.relationship` values are stored English data (written by Survey360.jsx) — only the
// displayed label is translated; color lookups stay keyed on the English value.
function trRelationship(t, r) { return t(`survey360Manager.relationships.${RELATIONSHIP_KEYS[r] || r}`, r); }

function uid8() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function avgScores(responses) {
  if (!responses?.length) return {};
  const totals = {};
  const counts = {};
  responses.forEach(r => {
    Object.entries(r.scores || {}).forEach(([cat, s]) => {
      totals[cat] = (totals[cat] || 0) + s;
      counts[cat] = (counts[cat] || 0) + 1;
    });
  });
  return Object.fromEntries(Object.keys(totals).map(k => [k, Math.round((totals[k] / counts[k]) * 10) / 10]));
}

function ScoreBar({ label, icon, color, bg, border, peerScore, selfScore }) {
  const { t } = useTranslation();
  const peerPct = Math.round((peerScore / 60) * 100);
  const selfPct = selfScore != null ? Math.round((selfScore / 60) * 100) : null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{icon}</span>
          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {selfPct != null && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{t('survey360Manager.selfLabel', 'Self:')} <strong style={{ color }}>{selfScore}/60</strong></span>}
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{t('survey360Manager.peersLabel', 'Peers:')} <strong style={{ color }}>{peerScore}/60</strong></span>
        </div>
      </div>
      <div style={{ background: '#f1f5f9', borderRadius: 99, height: 10, position: 'relative', overflow: 'visible' }}>
        <div style={{ height: 10, borderRadius: 99, background: `${color}40`, width: `${peerPct}%`, transition: 'width 1s ease' }} />
        <div style={{ height: 10, borderRadius: 99, background: color, width: `${peerPct}%`, position: 'absolute', top: 0, left: 0, transition: 'width 1s ease', opacity: 0.9 }} />
        {selfPct != null && (
          <div style={{ position: 'absolute', top: -3, left: `${selfPct}%`, width: 3, height: 16, background: '#0f2044', borderRadius: 2, transform: 'translateX(-50%)' }} title={t('survey360Manager.selfScoreTitle', 'Self: {{score}}/60', { score: selfScore })} />
        )}
      </div>
      {selfPct != null && (
        <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '4px 0 0', textAlign: 'right' }}>
          {t('survey360Manager.barLegend', 'Navy bar = peer avg · Dark line = your self-score')}
        </p>
      )}
    </div>
  );
}

export default function Survey360Manager() {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const [surveys, setSurveys]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selfLatest, setSelfLatest] = useState(null);
  const [copyMsg, setCopyMsg]   = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // surveyId pending delete

  const baseUrl = 'https://www.accountability-app.com';

  useEffect(() => { if (currentUser) load(); }, [currentUser]);

  async function load() {
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        setSurveys(snap.data().surveys360 || []);
        const assessments = snap.data().selfAssessments || [];
        if (assessments.length) setSelfLatest(assessments[assessments.length - 1]);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function createSurvey() {
    setCreating(true);
    try {
      const surveyId = uid8();
      const surveyDoc = {
        surveyId,
        uid: currentUser.uid,
        leaderUid: currentUser.uid,
        leaderName: userProfile?.displayName || currentUser.displayName || '',
        leaderRole: userProfile?.role || '',
        createdAt: new Date().toISOString(),
        responses: [],
      };
      // Store in surveys360 collection (public-write enabled via Firestore rules)
      await setDoc(doc(db, 'surveys360', surveyId), surveyDoc);
      // Also track the surveyId in user's doc
      const existing = surveys;
      await setDoc(doc(db, 'users', currentUser.uid), {
        surveys360: [...existing, { surveyId, createdAt: surveyDoc.createdAt, label: `Survey ${existing.length + 1}` }],
      }, { merge: true });
      setSurveys(s => [...s, { surveyId, createdAt: surveyDoc.createdAt, label: `Survey ${s.length + 1}` }]);
      toast.success(t('survey360Manager.toast.created', 'Survey created! Copy and share the link.'));
    } catch (e) {
      console.error(e);
      toast.error(t('survey360Manager.toast.createFailed', 'Could not create survey. Try again.'));
    }
    setCreating(false);
  }

  async function loadSurveyDetail(surveyId) {
    try {
      // Collect from surveys360 collection first (direct updateDoc path)
      let responses = [];
      try {
        const colSnap = await getDoc(doc(db, 'surveys360', surveyId));
        if (colSnap.exists()) responses = colSnap.data().responses || [];
      } catch (_) {}

      // Also query anonymous user docs that submitted for this surveyId
      try {
        const q = query(collection(db, 'users'), where('surveyId', '==', surveyId), where('isAnonResponse', '==', true));
        const snap = await getDocs(q);
        const seen = new Set(responses.map(r => r.submittedAt));
        snap.forEach(d => {
          const data = d.data();
          const r = data[`surveyResponse_${surveyId}`];
          if (r && !seen.has(r.submittedAt)) { responses.push(r); seen.add(r.submittedAt); }
        });
      } catch (_) {}

      const meta = surveys.find(s => s.surveyId === surveyId) || {};
      setSelected({
        surveyId,
        leaderName: userProfile?.displayName || '',
        leaderRole: userProfile?.role || '',
        ...meta,
        responses,
      });
    } catch (e) {
      console.error(e);
      toast.error(t('survey360Manager.toast.loadFailed', 'Could not load survey responses.'));
    }
  }

  async function deleteSurvey(surveyId) {
    try {
      // Remove from surveys360 collection
      try { await deleteDoc(doc(db, 'surveys360', surveyId)); } catch (_) {}
      // Remove from user's surveys list
      const updated = surveys.filter(s => s.surveyId !== surveyId);
      await setDoc(doc(db, 'users', currentUser.uid), { surveys360: updated }, { merge: true });
      setSurveys(updated);
      if (selected?.surveyId === surveyId) setSelected(null);
      toast.success(t('survey360Manager.toast.deleted', 'Survey deleted.'));
    } catch (e) {
      console.error(e);
      toast.error(t('survey360Manager.toast.deleteFailed', 'Could not delete survey.'));
    }
    setConfirmDelete(null);
  }

  function copyLink(surveyId) {
    const url = `${baseUrl}/survey/${surveyId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyMsg(surveyId);
      setTimeout(() => setCopyMsg(''), 2500);
    });
  }

  const responses  = selected?.responses || [];
  const peerAvg    = avgScores(responses);
  const selfScores = selfLatest?.scores || null;

  const RELATIONSHIP_COLORS = {
    'Peer': '#2563eb', 'Direct Report': '#0d9488', 'Manager': '#7c3aed',
    'Cross-functional Partner': '#d97706', 'Other': '#94a3b8',
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }} className="space-y-6">
      <PageHeader icon="🔄" title={t('survey360Manager.pageTitle', '360° Peer Feedback — Accountability from Every Angle')} subtitle={t('survey360Manager.pageSubtitle', 'Share a survey link with peers and reports — no app account needed.')} />

      {/* Create survey */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{t('survey360Manager.createNewRound', 'Create a new survey round')}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
              {t('survey360Manager.createNewRoundBody', 'Each round generates a unique anonymous link. Share it via email, Slack, or Teams. Respondents do not need an account in this app.')}
            </p>
          </div>
          <button onClick={createSurvey} disabled={creating}
            style={{ background: 'linear-gradient(135deg,#0f2044,#0d9488)', color: 'white', border: 'none', borderRadius: 10, padding: '0.625rem 1.5rem', fontWeight: 800, fontSize: '0.875rem', cursor: creating ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
            {creating ? t('survey360Manager.creating', '⏳ Creating…') : t('survey360Manager.createSurveyLink', '+ Create Survey Link')}
          </button>
        </div>

        {surveys.length > 0 && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {surveys.map(s => {
              const url = `${baseUrl}/survey/${s.surveyId}`;
              const isSelected = selected?.surveyId === s.surveyId;
              return (
                <div key={s.surveyId} style={{ border: `1px solid ${isSelected ? '#0d9488' : 'var(--border)'}`, borderRadius: 12, padding: '0.875rem 1rem', background: isSelected ? '#f0fdfa' : 'var(--card-bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px', fontSize: '0.875rem' }}>{s.label}</p>
                      <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.72rem' }}>
                        {t('survey360Manager.createdOn', 'Created {{date}}', { date: new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button onClick={() => copyLink(s.surveyId)}
                        style={{ background: copyMsg === s.surveyId ? '#0d9488' : '#f1f5f9', color: copyMsg === s.surveyId ? 'white' : '#475569', border: 'none', borderRadius: 8, padding: '5px 14px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                        {copyMsg === s.surveyId ? t('survey360Manager.copied', '✓ Copied!') : t('survey360Manager.copyLink', '📋 Copy Link')}
                      </button>
                      <button onClick={() => isSelected ? setSelected(null) : loadSurveyDetail(s.surveyId)}
                        style={{ background: isSelected ? '#0f2044' : 'transparent', color: isSelected ? 'white' : '#0d9488', border: `1px solid ${isSelected ? '#0f2044' : '#0d9488'}`, borderRadius: 8, padding: '5px 14px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                        {isSelected ? t('survey360Manager.close', 'Close') : t('survey360Manager.viewResults', 'View Results')}
                      </button>
                      {confirmDelete === s.surveyId ? (
                        <>
                          <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 700 }}>{t('survey360Manager.deleteQuestion', 'Delete?')}</span>
                          <button onClick={() => deleteSurvey(s.surveyId)}
                            style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '5px 12px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                            {t('survey360Manager.yesDelete', 'Yes, delete')}
                          </button>
                          <button onClick={() => setConfirmDelete(null)}
                            style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '5px 10px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                            {t('survey360Manager.cancel', 'Cancel')}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(s.surveyId)}
                          style={{ background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 10px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                          {t('survey360Manager.delete', '🗑 Delete')}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* URL display */}
                  <div style={{ marginTop: 8, background: '#f8fafc', borderRadius: 8, padding: '6px 10px', fontFamily: 'monospace', fontSize: '0.7rem', color: '#64748b', wordBreak: 'break-all' }}>
                    {url}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && surveys.length === 0 && (
          <div style={{ marginTop: 20, textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {t('survey360Manager.noSurveysYet', 'No surveys yet. Create your first one to get a shareable link.')}
          </div>
        )}
      </div>

      {/* Results panel */}
      {selected && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px', fontSize: '1rem' }}>
                {t('survey360Manager.resultsTitle', 'Results — {{label}}', { label: selected.label || t('survey360Manager.survey', 'Survey') })}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
                {t('survey360Manager.responsesReceived', '{{count}} response(s) received', { count: responses.length })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {selfLatest && (
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '6px 12px', fontSize: '0.72rem', color: '#64748b' }}>
                  {t('survey360Manager.darkLineNote', 'Dark line on bars = your self-score')}
                </div>
              )}
              {responses.length > 0 && (
                <button
                  onClick={() => generate360Report(
                    { ...selected, leaderName: userProfile?.displayName || '', leaderRole: userProfile?.role || '' },
                    selfLatest
                  )}
                  style={{ background: 'linear-gradient(135deg,#0f2044,#0d9488)', color: 'white', border: 'none', borderRadius: 10, padding: '0.5rem 1.25rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>
                  {t('survey360Manager.downloadPdf', '📄 Download PDF Report')}
                </button>
              )}
            </div>
          </div>

          {responses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '2rem', marginBottom: 8 }}>📭</p>
              <p style={{ fontWeight: 600, margin: 0 }}>{t('survey360Manager.noResponsesYet', 'No responses yet')}</p>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>{t('survey360Manager.shareLinkNote', 'Share the link with peers and reports to collect feedback.')}</p>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
                <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10, padding: '0.875rem', textAlign: 'center' }}>
                  <p style={{ fontWeight: 900, color: '#0d9488', fontSize: '1.75rem', margin: 0 }}>{responses.length}</p>
                  <p style={{ color: '#0f766e', fontSize: '0.72rem', fontWeight: 600, margin: 0 }}>{t('survey360Manager.responses', 'Responses')}</p>
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '0.875rem', textAlign: 'center' }}>
                  <p style={{ fontWeight: 900, color: '#2563eb', fontSize: '1.75rem', margin: 0 }}>
                    {Math.round(Object.values(peerAvg).reduce((a,b)=>a+b,0))}
                  </p>
                  <p style={{ color: '#1d4ed8', fontSize: '0.72rem', fontWeight: 600, margin: 0 }}>{t('survey360Manager.peerTotal300', 'Peer Total /300')}</p>
                </div>
                {selfLatest && (
                  <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '0.875rem', textAlign: 'center' }}>
                    <p style={{ fontWeight: 900, color: '#7c3aed', fontSize: '1.75rem', margin: 0 }}>
                      {selfLatest.total}
                    </p>
                    <p style={{ color: '#6d28d9', fontSize: '0.72rem', fontWeight: 600, margin: 0 }}>{t('survey360Manager.yourSelfScore300', 'Your Self-Score /300')}</p>
                  </div>
                )}
              </div>

              {/* Per-practice bars */}
              <div className="card" style={{ padding: '1.25rem', marginBottom: 16 }}>
                <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px', fontSize: '0.9rem' }}>{t('survey360Manager.scoreByPractice', 'Score by Practice')}</p>
                {CATEGORIES.map(c => (
                  <ScoreBar key={c.id}
                    label={trCatLabel(t, c)} icon={c.icon} color={c.color} bg={c.bg} border={c.border}
                    peerScore={peerAvg[c.id] || 0}
                    selfScore={selfScores ? selfScores[c.id] : null}
                  />
                ))}
              </div>

              {/* Open-ended answers */}
              {(() => {
                const OPEN_QS = [
                  { id: 'leaderStop',     label: t('survey360Manager.openQuestions.leaderStop', 'What should this person STOP doing?')     },
                  { id: 'leaderStart',    label: t('survey360Manager.openQuestions.leaderStart', 'What should this person START doing?')    },
                  { id: 'leaderContinue', label: t('survey360Manager.openQuestions.leaderContinue', 'What should this person CONTINUE doing?') },
                  { id: 'teamStop',       label: t('survey360Manager.openQuestions.teamStop', 'What should the team STOP doing?')        },
                  { id: 'teamStart',      label: t('survey360Manager.openQuestions.teamStart', 'What should the team START doing?')       },
                  { id: 'teamContinue',   label: t('survey360Manager.openQuestions.teamContinue', 'What should the team CONTINUE doing?')    },
                  { id: 'additionalComments', label: t('survey360Manager.openQuestions.additionalComments', 'Additional comments')                 },
                ];
                const hasOpen = responses.some(r => r.openAnswers && Object.values(r.openAnswers).some(v => v?.trim()));
                if (!hasOpen) return null;
                return (
                  <div className="card" style={{ padding: '1.25rem', marginBottom: 16 }}>
                    <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px', fontSize: '0.9rem' }}>{t('survey360Manager.openEndedFeedback', 'Open-Ended Feedback')}</p>
                    {OPEN_QS.map(oq => {
                      const answers = responses.map(r => (r.openAnswers || {})[oq.id]).filter(a => a?.trim());
                      if (!answers.length) return null;
                      return (
                        <div key={oq.id} style={{ marginBottom: 16 }}>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem', margin: '0 0 8px' }}>{oq.label}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {answers.map((ans, i) => (
                              <div key={i} style={{ background: '#f8fafc', borderLeft: '3px solid #0d9488', borderRadius: '0 8px 8px 0', padding: '8px 12px', fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
                                "{ans}"
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Respondent breakdown */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px', fontSize: '0.9rem' }}>{t('survey360Manager.whoResponded', 'Who responded')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {responses.map((r, i) => {
                    const total = Object.values(r.scores || {}).reduce((a,b)=>a+b, 0);
                    const rc = RELATIONSHIP_COLORS[r.relationship] || '#94a3b8';
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#f8fafc' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: rc, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem', flex: 1 }}>{r.name}</span>
                        <span style={{ fontSize: '0.72rem', background: `${rc}18`, color: rc, fontWeight: 700, borderRadius: 99, padding: '2px 8px' }}>{trRelationship(t, r.relationship)}</span>
                        <span style={{ fontWeight: 800, color: rc, fontSize: '0.85rem' }}>{total}/300</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Instructions card */}
      <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg,#f8fafc,#f0fdfa)' }}>
        <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', fontSize: '0.875rem' }}>{t('survey360Manager.howToUse', 'How to use 360° feedback')}</p>
        <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            t('survey360Manager.steps.0', 'Click "Create Survey Link" to generate a unique anonymous survey.'),
            t('survey360Manager.steps.1', 'Copy the link and share it via email, Slack, or Teams with 5–10 people who work closely with you.'),
            t('survey360Manager.steps.2', 'Respondents fill out 30 questions about your behaviors — no account required.'),
            t('survey360Manager.steps.3', 'Return here to view aggregated results as responses come in.'),
            t('survey360Manager.steps.4', 'Compare peer scores against your self-assessment to identify blind spots.'),
            t('survey360Manager.steps.5', 'Recommend sharing a new round every 6–12 months to track growth.'),
          ].map((s, i) => (
            <li key={i} style={{ color: '#475569', fontSize: '0.82rem', lineHeight: 1.5 }}>{s}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
