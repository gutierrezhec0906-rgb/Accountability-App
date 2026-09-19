import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { logPointEvent, localDateStr } from '../utils/scoring';

function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

// Stable English data values — stored on Firestore records (category, type)
// and used as comparison/filter values throughout this file. Only the
// DISPLAYED text is translated, via trCategory/trType below.
const categories = ['Leadership', 'Performance', 'Communication', 'Coaching', 'Teamwork', 'Technical', 'General'];
const types = ['All', 'Peer', 'Supervisor', 'Direct Report', 'Other', 'Self'];
const REACTION_EMOJIS = ['👍', '❤️', '🎉', '🙏', '😍', '👎'];

const CATEGORY_KEYS = { Leadership: 'leadership', Performance: 'performance', Communication: 'communication', Coaching: 'coaching', Teamwork: 'teamwork', Technical: 'technical', General: 'general' };
function trCategory(t, cat) { return t(`feedback.categories.${CATEGORY_KEYS[cat] || cat}`, cat); }

const TYPE_KEYS = { All: 'all', Peer: 'peer', Supervisor: 'supervisor', 'Direct Report': 'directReport', Other: 'other', Self: 'self' };
function trType(t, type) { return t(`feedback.types.${TYPE_KEYS[type] || type}`, type); }

function StarRow({ rating }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '0.9rem', color: n <= rating ? '#f59e0b' : '#e2e8f0' }}>★</span>)}
    </div>
  );
}

// Quick emoji reactions — lets the recipient say "thanks" without typing.
// `reactions` is { emoji: [uid, ...] }. Shows every emoji that has at least
// one reaction, plus the full picker so a new reaction can always be added.
function ReactionRow({ reactions = {}, myUid, onToggle }) {
  const { t } = useTranslation();
  const active = new Set(REACTION_EMOJIS.filter(e => (reactions[e] || []).includes(myUid)));
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
      {REACTION_EMOJIS.map(emoji => {
        const count = (reactions[emoji] || []).length;
        const isActive = active.has(emoji);
        if (count === 0 && !isActive) {
          return (
            <button key={emoji} onClick={() => onToggle(emoji)} title={t('feedback.react', 'React')}
              style={{ background: 'none', border: '1px solid #e8edf5', borderRadius: 9999, padding: '2px 8px', fontSize: '0.85rem', cursor: 'pointer', opacity: 0.55, transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.55'}>
              {emoji}
            </button>
          );
        }
        return (
          <button key={emoji} onClick={() => onToggle(emoji)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, border: isActive ? '1px solid #0d9488' : '1px solid #e8edf5', background: isActive ? '#f0fdfa' : 'white', borderRadius: 9999, padding: '2px 8px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 700, color: '#0f2044' }}>
            {emoji}<span style={{ fontSize: '0.7rem' }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function Avatar({ name }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const colors = ['#0d9488', '#0f2044', '#7c3aed', '#be185d', '#b45309', '#065f46'];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.78rem', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── Relationship filter (right, small box) ──
// Filters the Given/Received feed shown in the big left box by relationship type.
function RelationshipFilter({ filterType, onSelect, isMobile }) {
  const { t } = useTranslation();
  return (
    <div style={{ width: isMobile ? '100%' : 200, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#0f2044', borderRadius: '12px 12px 0 0', padding: '0.75rem 1rem' }}>
        <p style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem', margin: 0 }}>🔗 {t('feedback.relationship', 'Relationship')}</p>
      </div>
      <div style={{ border: '1px solid #e8edf5', borderTop: 'none', borderRadius: '0 0 12px 12px', background: '#fafbfc', padding: '0.625rem', display: 'flex', flexDirection: isMobile ? 'row' : 'column', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: 6 }}>
        {types.map(typ => (
          <button key={typ} onClick={() => onSelect(typ)}
            style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s', flex: isMobile ? '1 1 auto' : 'unset',
              background: filterType === typ ? '#0d9488' : 'white', color: filterType === typ ? 'white' : '#475569', boxShadow: filterType === typ ? 'none' : '0 0 0 1px #e8edf5 inset' }}>
            {trType(t, typ)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Request Feedback Modal ──
function RequestModal({ teamMembers, onClose, onSave }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState([]);
  const [category, setCategory] = useState('General');
  const [note, setNote] = useState('');
  const [improving, setImproving] = useState(false);

  function toggleMember(uid) {
    setSelected(s => s.includes(uid) ? s.filter(id => id !== uid) : [...s, uid]);
  }

  async function improveNote() {
    if (!note.trim()) return toast.error(t('feedback.toast.writeMainIdeaFirst', 'Write your main idea first'));
    setImproving(true);
    try {
      const fn = httpsCallable(getFunctions(), 'improveFeedbackMessage');
      const res = await fn({ note, category });
      if (res.data?.improved) setNote(res.data.improved);
    } catch (e) {
      toast.error(e?.message || t('feedback.toast.aiImprovementFailed', 'AI improvement failed'));
    }
    setImproving(false);
  }

  function handleSend() {
    if (selected.length === 0) return toast.error(t('feedback.toast.selectAtLeastOnePerson', 'Select at least one person'));
    onSave(selected, category, note.trim());
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: 500, width: '100%', padding: '1.5rem', borderRadius: 18, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '1.05rem' }}>📨 {t('feedback.requestFeedback', 'Request Feedback')}</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0' }}>{t('feedback.selectWhoYouWantFeedbackFrom', 'Select who you want feedback from')}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Team member picker */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
              {t('feedback.teamMembersSelected', 'Team Members ({{count}} selected)', { count: selected.length })}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem' }}>
              {teamMembers.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', padding: '0.5rem', margin: 0 }}>{t('feedback.noTeamMembersFound', 'No team members found.')}</p>
              ) : teamMembers.map(m => {
                const checked = selected.includes(m.uid);
                return (
                  <label key={m.uid}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.625rem', borderRadius: 8, cursor: 'pointer', background: checked ? '#f0fdfa' : 'transparent', border: `1px solid ${checked ? '#0d9488' : 'transparent'}`, transition: 'all 0.15s' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleMember(m.uid)} style={{ width: 16, height: 16, accentColor: '#0d9488', flexShrink: 0 }} />
                    <Avatar name={m.displayName} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>{m.displayName || m.email}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{[m.teamName, m.isAdmin ? t('feedback.manager', 'Manager') : m.role].filter(Boolean).join(' · ') || t('feedback.teamMember', 'Team Member')}</p>
                    </div>
                    {checked && <span style={{ fontSize: '0.8rem', color: '#0d9488', fontWeight: 700 }}>✓</span>}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              {t('feedback.feedbackTopic', 'Feedback Topic')}
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  style={{ padding: '0.3rem 0.75rem', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                    background: category === c ? '#0f2044' : '#f1f5f9', color: category === c ? 'white' : '#475569' }}>
                  {trCategory(t, c)}
                </button>
              ))}
            </div>
          </div>

          {/* Optional note */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              {t('feedback.addANote', 'Add a note')} <span style={{ fontWeight: 400, textTransform: 'none' }}>({t('feedback.optional', 'optional')})</span>
            </label>
            <textarea className="input" rows={3}
              placeholder={t('feedback.notePlaceholder', "Write your main idea — e.g. feedback on my communication style during last week's project...")}
              value={note} onChange={e => setNote(e.target.value)}
              style={{ resize: 'vertical', marginBottom: 6 }} />
            <button type="button" onClick={improveNote} disabled={improving || !note.trim()}
              style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, color: '#6d28d9', fontWeight: 700, fontSize: '0.75rem', padding: '4px 10px', cursor: note.trim() ? 'pointer' : 'not-allowed', opacity: note.trim() ? 1 : 0.5 }}>
              {improving ? t('feedback.improving', 'Improving…') : `✨ ${t('feedback.improveWithAI', 'Improve with AI')}`}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn-primary" onClick={handleSend} style={{ flex: 1 }}
            disabled={selected.length === 0}>
            📨 {selected.length > 1 ? t('feedback.sendRequestsCount', 'Send Requests ({{count}})', { count: selected.length }) : t('feedback.sendRequest', 'Send Request')}
          </button>
          <button className="btn-secondary" onClick={onClose}>{t('feedback.cancel', 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
}

export default function Feedback() {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const isMobile = useIsMobile();
  const [showForm, setShowForm]       = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [filterType, setFilterType]   = useState('All');
  const [tab, setTab] = useState('given'); // 'given' | 'received' | 'requests'
  const [form, setForm] = useState({ type: 'Peer', from: '', to: '', toUid: '', anonymous: false, category: 'Leadership', rating: 5, when: '', what: '', effect: '' });
  const [teamMembers, setTeamMembers] = useState([]);
  const [given,    setGiven]    = useState([]);
  const [received, setReceived] = useState([]);
  const [requests, setRequests] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [improvingSBI, setImprovingSBI] = useState(false);
  const [monthlyFeedbackCount, setMonthlyFeedbackCount] = useState(0);

  const myName = userProfile?.displayName || currentUser?.displayName || currentUser?.email || '';

  useEffect(() => {
    async function fetchAll() {
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          setGiven(data.feedbackEntries || []);
          setReceived(data.feedbackReceived || []);
          setRequests(data.feedbackRequests || []);
          // Count feedback points earned in last 30 days
          const thirtyDaysAgo = localDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
          const fbCount = (data.pointEvents || [])
            .filter(e => e.toolLabel === 'Feedback Given' && e.date >= thirtyDaysAgo && e.points > 0)
            .length;
          setMonthlyFeedbackCount(fbCount);

          // Load team members from users collection filtered by same companyId
          const companyId = data.companyId;
          if (companyId) {
            const membersSnap = await getDocs(query(
              collection(db, 'users'),
              where('companyId', '==', companyId)
            ));
            const members = membersSnap.docs
              .map(d => ({ uid: d.id, ...d.data() }))
              .filter(m => m.status === 'approved' || m.isAdmin === true);
            setTeamMembers(members);

            // Backfill: entries sent BEFORE cross-user delivery existed (or that
            // silently failed to deliver) never reached the recipient's inbox.
            // Catch them up once here, then flag each as delivered so this
            // doesn't re-run every load.
            const given = data.feedbackEntries || [];
            const undelivered = given.filter(f => !f.delivered);
            if (undelivered.length > 0) {
              const nextGiven = [...given];
              let changed = false;
              for (const f of undelivered) {
                const toUid = f.toUid || members.find(m => (m.displayName || m.email) === f.to)?.uid;
                let delivered = false;
                if (toUid) {
                  try {
                    await updateDoc(doc(db, 'users', toUid), {
                      feedbackReceived: arrayUnion({ ...f, toUid, read: false }),
                    });
                    delivered = true;
                  } catch (e) { console.error('Backfill delivery failed for', f.id, e); }
                }
                const idx = nextGiven.findIndex(g => g.id === f.id);
                if (idx !== -1 && delivered) { nextGiven[idx] = { ...nextGiven[idx], toUid, delivered: true }; changed = true; }
              }
              if (changed) {
                await setDoc(doc(db, 'users', currentUser.uid), { feedbackEntries: nextGiven }, { merge: true });
                setGiven(nextGiven);
              }
            }
          }
        }
      } catch (e) { console.error(e); }
    }
    fetchAll();
  }, [currentUser]);

  async function awardFeedbackPoint() {
    if (monthlyFeedbackCount >= 5) return 'capped-monthly';
    const { awarded, capReached } = await logPointEvent(currentUser.uid, {
      points: 1,
      toolLabel: 'Feedback Given',
      reason: 'Gave feedback to a team member (+1 pt, max 5/month)',
    });
    if (awarded) {
      setMonthlyFeedbackCount(c => c + 1);
      return 'earned';
    }
    return capReached ? 'capped-daily' : false;
  }

  async function persist(entries, reqs) {
    const update = {};
    if (entries !== undefined) update.feedbackEntries  = entries;
    if (reqs    !== undefined) update.feedbackRequests = reqs;
    await setDoc(doc(db, 'users', currentUser.uid), update, { merge: true });
    if (entries !== undefined) setGiven(entries);
    if (reqs    !== undefined) setRequests(reqs);
  }

  async function improveSBI() {
    if (!form.when.trim() && !form.what.trim() && !form.effect.trim()) {
      return toast.error(t('feedback.toast.fillInAtLeastOneField', 'Fill in at least one field first'));
    }
    setImprovingSBI(true);
    try {
      const fn = httpsCallable(getFunctions(), 'improveFeedbackSBI');
      const res = await fn({ when: form.when, what: form.what, effect: form.effect });
      if (res.data) {
        setForm(f => ({
          ...f,
          when: res.data.when || f.when,
          what: res.data.what || f.what,
          effect: res.data.effect || f.effect,
        }));
      }
    } catch (e) {
      toast.error(e?.message || t('feedback.toast.aiImprovementFailed', 'AI improvement failed'));
    }
    setImprovingSBI(false);
  }

  async function submitFeedback(e) {
    e.preventDefault();
    if (!form.toUid) return toast.error(t('feedback.toast.selectARecipient', 'Please select a recipient'));
    setSubmitting(true);
    try {
      const newEntry = {
        id: Date.now().toString(),
        uid: currentUser.uid,
        type: form.type,
        from: form.anonymous ? 'Anonymous' : (form.from || myName),
        to: form.to,
        toUid: form.toUid,
        anonymous: form.anonymous,
        category: form.category,
        rating: form.rating,
        when: form.when,
        what: form.what,
        effect: form.effect,
        text: [
          form.when && `${t('feedback.whenLabel', 'When')}: ${form.when}`,
          form.what && `${t('feedback.whatLabel', 'What')}: ${form.what}`,
          form.effect && `${t('feedback.effectLabel', 'Effect')}: ${form.effect}`,
        ].filter(Boolean).join('\n\n'),
        date: localDateStr(),
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
      };
      // Deliver a copy into the recipient's own doc so they can actually see it —
      // this is what the "Received" tab, the sidebar badge, and the notification
      // email all read from. Cross-user write allowed by the sameCompany rule.
      let delivered = false;
      try {
        await updateDoc(doc(db, 'users', form.toUid), {
          feedbackReceived: arrayUnion({ ...newEntry, read: false }),
        });
        delivered = true;
      } catch (e) { console.error('Could not deliver feedback to recipient', e); }
      await persist([{ ...newEntry, delivered }, ...given], undefined);
      if (!delivered) toast.error(t('feedback.toast.notDelivered', "Saved, but couldn't deliver to {{name}}'s inbox — they may not see it. Try again shortly.", { name: form.to }), { duration: 7000 });
      const earned = await awardFeedbackPoint();
      if (earned === 'earned') toast.success(t('feedback.toast.submittedEarned', 'Feedback submitted! +1 pt ({{count}}/5 this month)', { count: monthlyFeedbackCount + 1 }), { duration: 5000 });
      else if (earned === 'capped-monthly') toast(t('feedback.toast.submittedCappedMonthly', "Feedback submitted! You've reached the 5-pt monthly feedback limit. Points reset in 30 days."), { duration: 6000, icon: '📅' });
      else if (earned === 'capped-daily') toast(t('feedback.toast.submittedCappedDaily', 'Feedback submitted! Daily 25-pt cap reached — come back tomorrow.'), { duration: 6000, icon: '📅' });
      else toast.success(t('feedback.toast.submitted', 'Feedback submitted!'));
      setForm({ type: 'Peer', from: '', to: '', toUid: '', anonymous: false, category: 'Leadership', rating: 5, when: '', what: '', effect: '' });
      setShowForm(false);
    } catch (e) { toast.error(t('feedback.toast.submitFailed', 'Submit failed: {{error}}', { error: e?.message || e })); }
    setSubmitting(false);
  }

  // Mark all received feedback as read when the user opens the Received tab —
  // clears the sidebar badge and the unread dot on individual entries.
  async function markReceivedRead() {
    const unread = received.filter(f => !f.read);
    if (unread.length === 0) return;
    const updated = received.map(f => ({ ...f, read: true }));
    setReceived(updated);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { feedbackReceived: updated }, { merge: true });
    } catch {}
  }

  // Toggle the current user's reaction on a received feedback entry — one
  // emoji per person; clicking the same emoji again removes it, clicking a
  // different one switches it. Stored on the entry itself, in this user's
  // own feedbackReceived array (no cross-user write needed).
  async function toggleReaction(entryId, emoji) {
    const updated = received.map(f => {
      if (f.id !== entryId) return f;
      const reactions = { ...(f.reactions || {}) };
      const already = (reactions[emoji] || []).includes(currentUser.uid);
      for (const key of Object.keys(reactions)) {
        reactions[key] = reactions[key].filter(uid => uid !== currentUser.uid);
        if (reactions[key].length === 0) delete reactions[key];
      }
      if (!already) reactions[emoji] = [...(reactions[emoji] || []), currentUser.uid];
      return { ...f, reactions };
    });
    setReceived(updated);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { feedbackReceived: updated }, { merge: true });
    } catch { toast.error(t('feedback.toast.couldNotSaveReaction', 'Could not save reaction')); }
  }

  async function handleDelete(id) {
    if (!confirm(t('feedback.confirmDelete', 'Delete this feedback?'))) return;
    try {
      await persist(given.filter(f => f.id !== id), undefined);
      toast.success(t('feedback.toast.deleted', 'Deleted'));
    } catch { toast.error(t('feedback.toast.deleteFailed', 'Delete failed')); }
  }

  async function handleSendRequests(selectedUids, category, note) {
    const now = localDateStr();
    const newReqs = selectedUids.map(uid => {
      const member = teamMembers.find(m => m.uid === uid);
      return {
        id: `${Date.now()}-${uid}`,
        to: member?.displayName || member?.email || uid,
        toUid: uid,
        toRole: member?.role || '',
        category,
        note,
        date: now,
        status: 'pending',
      };
    });
    try {
      await persist(undefined, [...newReqs, ...requests]);
      const names = newReqs.map(r => r.to).join(', ');
      toast.success(newReqs.length > 1
        ? t('feedback.toast.requestsSentTo', 'Requests sent to {{names}}', { names })
        : t('feedback.toast.requestSentTo', 'Request sent to {{names}}', { names }));
    } catch { toast.error(t('feedback.toast.couldNotSaveRequests', 'Could not save requests')); }
  }

  async function handleDismissRequest(id) {
    try {
      await persist(undefined, requests.map(r => r.id === id ? { ...r, status: 'fulfilled' } : r));
      toast.success(t('feedback.toast.markedFulfilled', 'Marked as fulfilled'));
    } catch { toast.error(t('feedback.toast.updateFailed', 'Update failed')); }
  }

  function selectTab(tabName) {
    setTab(tabName);
    if (tabName === 'received') markReceivedRead();
  }

  const allFeedback = [...given, ...received.filter(r => !given.find(g => g.id === r.id))];
  const avg = allFeedback.length ? (allFeedback.reduce((a, f) => a + f.rating, 0) / allFeedback.length).toFixed(1) : '—';
  const pendingRequests = requests.filter(r => r.status === 'pending').length;
  const unreadCount = received.filter(f => !f.read).length;

  // Feed shown in the big left box — which list depends on the active tab
  // (Given / Received / Requests), then narrowed by the relationship filter
  // from the small right panel.
  const tabList  = tab === 'requests' ? requests : (tab === 'given' ? given : received);
  const filtered = tab === 'requests' || filterType === 'All' ? tabList : tabList.filter(f => f.type === filterType);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader icon="📬" title={t('feedback.pageTitle', 'Feedback Box — Accountability with Care')} subtitle={t('feedback.pageSubtitle', 'Anonymous or named feedback from peers, supervisors, and leaders')}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => setShowRequest(true)} style={{ position: 'relative' }}>
              📨 {t('feedback.requestFeedback', 'Request Feedback')}
              {pendingRequests > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pendingRequests}
                </span>
              )}
            </button>
            <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ {t('feedback.giveFeedback', 'Give Feedback')}</button>
          </div>
        }
      />

      {/* Request modal */}
      {showRequest && (
        <RequestModal
          teamMembers={teamMembers}
          onClose={() => setShowRequest(false)}
          onSave={handleSendRequests}
        />
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: isMobile ? 8 : 12, marginBottom: '1.5rem' }}>
        {[
          { label: t('feedback.avgRating', 'Avg Rating'),        value: avg,                                           color: '#0d9488' },
          { label: t('feedback.totalFeedback', 'Total Feedback'),    value: allFeedback.length,                            color: '#0f2044' },
          { label: t('feedback.pendingRequests', 'Pending Requests'),  value: pendingRequests,                               color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="stat-tile" style={{ textAlign: 'center', padding: isMobile ? '0.75rem 0.25rem' : undefined }}>
            <p style={{ fontSize: isMobile ? '1.4rem' : '2rem', fontWeight: 900, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending requests banner */}
      {pendingRequests > 0 && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 12, padding: '0.75rem 1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1rem' }}>⏳</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e' }}>
            {t('feedback.youHavePendingRequests', 'You have {{count}} pending feedback request(s).', { count: pendingRequests })}
          </span>
          <button onClick={() => setShowRequest(true)} style={{ marginLeft: 'auto', background: '#0f2044', color: 'white', border: 'none', borderRadius: 8, padding: '0.3rem 0.875rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            {t('feedback.viewRequests', 'View Requests')}
          </button>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: 'flex-start', width: '100%' }}>
        <div style={{ flex: isMobile ? '0 0 100%' : 1, minWidth: 0, width: isMobile ? '100%' : 'auto', order: isMobile ? 2 : 1 }}>

          {/* Submit form */}
          {showForm && (
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>{t('feedback.submitFeedback', 'Submit Feedback')}</h3>
              <form onSubmit={submitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <div><label className="label">{t('feedback.feedbackType', 'Feedback Type')}</label>
                    <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      {types.slice(1).map(typ => <option key={typ} value={typ}>{trType(t, typ)}</option>)}
                    </select>
                  </div>
                  <div><label className="label">{t('feedback.category', 'Category')}</label>
                    <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {categories.map(c => <option key={c} value={c}>{trCategory(t, c)}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="anon" checked={form.anonymous} onChange={e => setForm(f => ({ ...f, anonymous: e.target.checked }))} style={{ width: 16, height: 16 }} />
                  <label htmlFor="anon" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('feedback.submitAnonymously', 'Submit Anonymously')}</label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  {!form.anonymous && (
                    <div><label className="label">{t('feedback.yourNameFrom', 'Your Name (From)')}</label>
                      <input className="input" value={form.from || myName} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} placeholder={t('feedback.yourNamePlaceholder', 'Your name')} />
                    </div>
                  )}
                  <div style={form.anonymous ? { gridColumn: '1 / -1' } : {}}>
                    <label className="label">{t('feedback.recipientTo', 'Recipient (To) *')}</label>
                    <select className="input" required value={form.toUid} onChange={e => {
                      const uid = e.target.value;
                      const member = teamMembers.find(m => m.uid === uid);
                      setForm(f => ({ ...f, toUid: uid, to: member?.displayName || member?.email || '' }));
                    }}>
                      <option value="">— {t('feedback.selectTeamMember', 'Select team member')} —</option>
                      {teamMembers.map(m => (
                        <option key={m.uid} value={m.uid}>
                          {m.displayName || m.email}{m.teamName ? ` · ${m.teamName}` : ''}{m.isAdmin ? ` (${t('feedback.manager', 'Manager')})` : m.role ? ` (${m.role})` : ''}{m.uid === currentUser.uid ? ` — ${t('feedback.you', 'You')}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">{t('feedback.rating', 'Rating')}</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    {[
                      { n: 1, label: t('feedback.ratingLabels.small', 'Small'), desc: t('feedback.ratingDescs.small', 'Worth a mention, but limited scope') },
                      { n: 2, label: t('feedback.ratingLabels.noticed', 'Noticed'), desc: t('feedback.ratingDescs.noticed', 'A positive moment, but minor') },
                      { n: 3, label: t('feedback.ratingLabels.solid', 'Solid'), desc: t('feedback.ratingDescs.solid', 'Met the standard well') },
                      { n: 4, label: t('feedback.ratingLabels.strong', 'Strong'), desc: t('feedback.ratingDescs.strong', 'Clearly did more than expected') },
                      { n: 5, label: t('feedback.ratingLabels.exceptional', 'Exceptional'), desc: t('feedback.ratingDescs.exceptional', 'Went well beyond what the situation required') },
                    ].map(({ n, label, desc }) => (
                      <div key={n} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                        onMouseEnter={e => { const tip = e.currentTarget.querySelector('.rating-tip'); if (tip) tip.style.opacity = '1'; }}
                        onMouseLeave={e => { const tip = e.currentTarget.querySelector('.rating-tip'); if (tip) tip.style.opacity = '0'; }}>
                        {/* Tooltip */}
                        <div className="rating-tip" style={{
                          position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
                          background: '#0f2044', color: 'white', borderRadius: 8, padding: '6px 10px',
                          width: 160, fontSize: '0.72rem', lineHeight: 1.4, textAlign: 'center',
                          pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s', zIndex: 10,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        }}>
                          <span style={{ fontWeight: 700, display: 'block', marginBottom: 2 }}>{n} — {label}</span>
                          {desc}
                          {/* Arrow */}
                          <span style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #0f2044' }} />
                        </div>
                        <button type="button" onClick={() => setForm(f => ({ ...f, rating: n }))}
                          style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${n <= form.rating ? '#0d9488' : '#e2e8f0'}`, background: n <= form.rating ? '#0d9488' : 'transparent', color: n <= form.rating ? 'white' : '#94a3b8', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                          {n}
                        </button>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: n <= form.rating ? '#0d9488' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {[
                  { key: 'when',   label: t('feedback.whenDidThisHappen', 'When did this happen?'),         placeholder: t('feedback.whenPlaceholder', "e.g. Tuesday's huddle, last Thursday's client call…") },
                  { key: 'what',   label: t('feedback.whatDidTheyDo', 'What did they specifically do?'), placeholder: t('feedback.whatPlaceholder', 'e.g. flagged the material delay before being asked…') },
                  { key: 'effect', label: t('feedback.whatWasThePositiveEffect', 'What was the positive effect?'),  placeholder: t('feedback.effectPlaceholder', 'e.g. team resequenced immediately instead of losing time mid-shift…') },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <textarea className="input" rows={2} required value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ resize: 'vertical' }} />
                  </div>
                ))}
                <button type="button" onClick={improveSBI} disabled={improvingSBI}
                  style={{ alignSelf: 'flex-start', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, color: '#6d28d9', fontWeight: 700, fontSize: '0.78rem', padding: '5px 12px', cursor: 'pointer' }}>
                  {improvingSBI ? t('feedback.improving', 'Improving…') : `✨ ${t('feedback.improveSBIWithAI', 'Improve When/What/Effect with AI')}`}
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-primary" type="submit" disabled={submitting}>{submitting ? t('feedback.submitting', 'Submitting...') : t('feedback.submitFeedback', 'Submit Feedback')}</button>
                  <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>{t('feedback.cancel', 'Cancel')}</button>
                </div>
              </form>
            </div>
          )}

          {/* Given / Received / Requests tabs */}
          <div style={{ display: 'flex', gap: isMobile ? 6 : 8, marginBottom: '1.25rem' }}>
            {['given', 'received', 'requests'].map(tabName => (
              <button key={tabName} onClick={() => selectTab(tabName)} style={{ position: 'relative', flex: 1, padding: isMobile ? '0.5rem 0.25rem' : '0.5rem 0', borderRadius: 10, fontSize: isMobile ? '0.72rem' : '0.82rem', fontWeight: 800, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: tab === tabName ? '#0f2044' : '#f1f5f9', color: tab === tabName ? 'white' : '#475569' }}>
                {isMobile
                  ? (tabName === 'given' ? t('feedback.tabGivenMobile', 'Given ({{count}})', { count: given.length }) : tabName === 'received' ? t('feedback.tabReceivedMobile', 'Rcvd ({{count}})', { count: received.length }) : t('feedback.tabRequestsMobile', 'Req ({{count}})', { count: pendingRequests }))
                  : (tabName === 'given' ? t('feedback.tabGiven', 'Given ({{count}})', { count: given.length }) : tabName === 'received' ? t('feedback.tabReceived', 'Received ({{count}})', { count: received.length }) : t('feedback.tabRequests', 'Requests ({{count}})', { count: pendingRequests }))}
                {tabName === 'received' && unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -6, right: '30%', background: '#ef4444', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.length === 0 ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                {tab === 'requests' ? t('feedback.noPendingRequests', 'No pending requests.') : t('feedback.noFeedbackYet', 'No {{tab}} feedback yet.', { tab: tab === 'given' ? t('feedback.tabGivenWord', 'given') : t('feedback.tabReceivedWord', 'received') })}
              </div>
            ) : tab === 'requests' ? filtered.map(r => (
              <div key={r.id} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', margin: '0 0 4px' }}>{t('feedback.toLabel', 'To: {{name}}', { name: r.to })}</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: 9999, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{trCategory(t, r.category)}</span>
                      <span style={{ background: r.status === 'pending' ? '#fef9c3' : '#dcfce7', color: r.status === 'pending' ? '#b45309' : '#15803d', borderRadius: 9999, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                        {r.status === 'pending' ? `⏳ ${t('feedback.pending', 'Pending')}` : `✅ ${t('feedback.done', 'Done')}`}
                      </span>
                    </div>
                    {r.note && <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0', lineHeight: 1.5 }}>{r.note}</p>}
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '4px 0 0' }}>{r.date}</p>
                  </div>
                  {r.status === 'pending' && (
                    <button onClick={() => handleDismissRequest(r.id)} title={t('feedback.markAsFulfilled', 'Mark as fulfilled')} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', flexShrink: 0 }}>✓ {t('feedback.markFulfilled', 'Mark Fulfilled')}</button>
                  )}
                </div>
              </div>
            )) : filtered.map(f => (
              <div key={f.id} className="card" style={{ padding: '1.25rem', background: tab === 'received' && !f.read ? '#f0fdfa' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#e0f2fe,#bae6fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', flexShrink: 0 }}>
                      {f.from === 'Anonymous' ? '🎭' : (f.from?.[0] || '?')}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{f.from === 'Anonymous' ? t('feedback.anonymous', 'Anonymous') : f.from}</span>
                        {f.to && <><span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>→</span><span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0d9488' }}>{f.to}</span></>}
                        {tab === 'received' && !f.read && <span style={{ color: '#0d9488' }}>●</span>}
                        <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 9999, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{trType(t, f.type)}</span>
                        <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 9999, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{trCategory(t, f.category)}</span>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>{f.date}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StarRow rating={f.rating} />
                    {tab === 'given' && (
                      <button onClick={() => handleDelete(f.id)}
                        style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px' }}>🗑</button>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{f.text}</p>
                {tab === 'given' && f.uid === currentUser.uid && (
                  <p style={{ fontSize: '0.68rem', margin: '8px 0 0', fontWeight: 700, color: f.delivered ? '#15803d' : '#b45309' }}>
                    {f.delivered
                      ? `✓ ${t('feedback.deliveredToInbox', "Delivered to {{name}}'s inbox", { name: f.to })}`
                      : `⚠ ${f.toUid ? t('feedback.notYetDeliveredToInbox', "Not yet delivered to {{name}}'s inbox", { name: f.to }) : t('feedback.notYetDeliveredNoAccount', "Not yet delivered to {{name}}'s inbox — no matching account found", { name: f.to })}`}
                  </p>
                )}
                {tab === 'received' && (
                  <ReactionRow reactions={f.reactions} myUid={currentUser.uid} onToggle={emoji => toggleReaction(f.id, emoji)} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — relationship filter (shown above the feed on mobile) */}
        <div style={{ width: isMobile ? '100%' : 'auto', order: isMobile ? 1 : 2 }}>
          <RelationshipFilter filterType={filterType} onSelect={setFilterType} isMobile={isMobile} />
        </div>
      </div>
    </div>
  );
}
