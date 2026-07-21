const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1' });

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_APP_PASSWORD,
  },
});

const ADMIN_EMAIL = 'hectorg@accountability-app.com';
const APP_URL = 'https://www.accountability-app.com';

exports.sendWelcomeEmail = onDocumentCreated('users/{uid}', async (event) => {
  const data = event.data?.data();
  if (!data || !data.email) return;

  const { email, displayName, role, status } = data;
  const isFirst = status === 'approved';

  // 1. Welcome email to the new user
  const userHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0f2044; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Leadership Flow Technologies</h1>
        <p style="color: #93c5fd; margin: 8px 0 0;">Accountability App</p>
      </div>
      <div style="padding: 32px; background: #f8fafc;">
        <h2 style="color: #0f2044;">Welcome, ${displayName}!</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Your account has been created successfully as a <strong>${role}</strong>.
        </p>
        ${isFirst
          ? `<p style="color: #475569; font-size: 16px; line-height: 1.6;">
               You are the first user and have been granted <strong>full admin access</strong> automatically.
             </p>`
          : `<p style="color: #475569; font-size: 16px; line-height: 1.6;">
               Your account is currently <strong>pending approval</strong>. The administrator will review and activate your account shortly. You will be able to access the app once approved.
             </p>`
        }
        <div style="margin: 32px 0; text-align: center;">
          <a href="${APP_URL}"
             style="background: #0f2044; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
            Go to App
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 14px;">
          If you have any questions, reply to this email and we'll be happy to help.
        </p>
      </div>
      <div style="background: #0f2044; padding: 16px; text-align: center;">
        <p style="color: #93c5fd; font-size: 12px; margin: 0;">
          © 2026 Leadership Flow Technologies. All rights reserved.
        </p>
      </div>
    </div>
  `;

  // 2. Admin notification email
  const adminHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0f2044; padding: 24px 32px; display: flex; align-items: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">🔔 New User Signup</h1>
      </div>
      <div style="padding: 32px; background: #f8fafc;">
        <p style="color: #475569; font-size: 16px;">A new user has just signed up for the Accountability App and is awaiting your approval.</p>
        <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px; width: 120px;">Name</td><td style="padding: 8px 0; font-weight: 700; color: #0f2044;">${displayName}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Email</td><td style="padding: 8px 0; color: #0f2044;">${email}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Role</td><td style="padding: 8px 0; color: #0f2044;">${role}</td></tr>
            <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Status</td><td style="padding: 8px 0;"><span style="background: #fef9c3; color: #92400e; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 700;">⏳ Pending Approval</span></td></tr>
          </table>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${APP_URL}/admin"
             style="background: #0f2044; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
            Review in Admin Panel
          </a>
        </div>
      </div>
      <div style="background: #0f2044; padding: 16px; text-align: center;">
        <p style="color: #93c5fd; font-size: 12px; margin: 0;">Leadership Flow Technologies Accountability App</p>
      </div>
    </div>
  `;

  await Promise.all([
    transporter.sendMail({
      from: `"Leadership Flow Technologies" <${ADMIN_EMAIL}>`,
      to: email,
      subject: 'Welcome to the Accountability App',
      html: userHtml,
    }),
    transporter.sendMail({
      from: `"Accountability App" <${ADMIN_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: `🔔 New Signup: ${displayName} (${role})`,
      html: adminHtml,
    }),
  ]);

  console.log(`Welcome email sent to ${email}, admin notified at ${ADMIN_EMAIL}`);
});

// ── Request notification emails ─────────────────────────────────────────────
// Watches users/{uid} updates and emails the person who needs to act when a
// request is created in any module:
//   1. Skills   — skillsPeerRequest {toUid, status:'pending'}      → the requested teammate
//   2. Feedback — feedbackRequests[] items {toUid, status:'pending'} → each requested teammate
//   3. SMART    — a goal transitions to status 'pending_approval'   → company leaders/managers

function brandedEmail(heading, bodyHtml, ctaLabel, ctaPath) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0f2044; padding: 24px 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Leadership Flow Technologies</h1>
        <p style="color: #93c5fd; margin: 6px 0 0; font-size: 13px;">Accountability App</p>
      </div>
      <div style="padding: 32px; background: #f8fafc;">
        <h2 style="color: #0f2044; margin-top: 0;">${heading}</h2>
        ${bodyHtml}
        <div style="margin: 28px 0; text-align: center;">
          <a href="${APP_URL}${ctaPath}"
             style="background: #0d9488; color: white; padding: 13px 30px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: bold;">
            ${ctaLabel}
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">You are receiving this because a teammate needs your input in the Accountability App.</p>
      </div>
      <div style="background: #0f2044; padding: 14px; text-align: center;">
        <p style="color: #93c5fd; font-size: 12px; margin: 0;">© 2026 Leadership Flow Technologies. All rights reserved.</p>
      </div>
    </div>
  `;
}

async function emailForUid(uid) {
  if (!uid) return null;
  try {
    const snap = await admin.firestore().collection('users').doc(uid).get();
    return snap.exists ? (snap.data().email || null) : null;
  } catch { return null; }
}

exports.sendRequestEmails = onDocumentUpdated('users/{uid}', async (event) => {
  const before = event.data?.before?.data() || {};
  const after  = event.data?.after?.data()  || {};
  const requesterName = after.displayName || after.email || 'A teammate';
  const mails = [];

  // 1. Skills peer-assessment request (new pending request, or re-request)
  const prevReq = before.skillsPeerRequest;
  const newReq  = after.skillsPeerRequest;
  if (newReq?.status === 'pending' && newReq.toUid &&
      (prevReq?.requestedAt !== newReq.requestedAt || prevReq?.status !== 'pending')) {
    const to = await emailForUid(newReq.toUid);
    if (to) {
      mails.push({
        to,
        subject: `🙋 ${requesterName} requested your peer assessment`,
        html: brandedEmail(
          'Peer assessment requested',
          `<p style="color: #475569; font-size: 15px; line-height: 1.6;">
             <strong>${requesterName}</strong> asked you to rate their skills in the
             <strong>Skills Development Matrix</strong>. Your honest, independent rating helps them
             see their real gaps — their self-ratings stay hidden from you on purpose.
           </p>`,
          'Complete Their Assessment', '/skills'
        ),
      });
    }
  }

  // 2. Feedback requests — email each newly added pending request target
  const prevFbIds = new Set((before.feedbackRequests || []).map(r => r.id));
  const newFbReqs = (after.feedbackRequests || []).filter(r => r.status === 'pending' && !prevFbIds.has(r.id));
  for (const req of newFbReqs) {
    const to = await emailForUid(req.toUid);
    if (to) {
      mails.push({
        to,
        subject: `📨 ${requesterName} requested your feedback`,
        html: brandedEmail(
          'Feedback requested',
          `<p style="color: #475569; font-size: 15px; line-height: 1.6;">
             <strong>${requesterName}</strong> asked for your feedback${req.category ? ` on <strong>${req.category}</strong>` : ''}.
           </p>
           ${req.note ? `<p style="color: #64748b; font-size: 14px; border-left: 3px solid #0d9488; padding-left: 12px; line-height: 1.6;">"${req.note}"</p>` : ''}`,
          'Give Feedback', '/feedback'
        ),
      });
    }
  }

  // 3. SMART goal approval requests — email company leaders/managers/admins
  const prevPending = new Set((before.smartGoals || []).filter(g => g.status === 'pending_approval').map(g => g.id));
  const newPending  = (after.smartGoals || []).filter(g => g.status === 'pending_approval' && !prevPending.has(g.id));
  if (newPending.length > 0 && after.companyId) {
    try {
      const leadersSnap = await admin.firestore().collection('users')
        .where('companyId', '==', after.companyId).get();
      const leaders = leadersSnap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(u => u.uid !== event.params.uid && u.email &&
                     (u.isAdmin || u.role === 'Leader' || u.role === 'Manager'));
      const goalTitles = newPending.map(g => `<li style="margin-bottom: 4px;"><strong>${g.title || 'Untitled goal'}</strong></li>`).join('');
      for (const leader of leaders) {
        mails.push({
          to: leader.email,
          subject: `🎯 ${requesterName} requested SMART goal approval`,
          html: brandedEmail(
            'SMART goal completion needs your approval',
            `<p style="color: #475569; font-size: 15px; line-height: 1.6;">
               <strong>${requesterName}</strong> marked the following goal${newPending.length > 1 ? 's' : ''} as completed
               and is waiting for your review:
             </p>
             <ul style="color: #0f2044; font-size: 14px; line-height: 1.6;">${goalTitles}</ul>`,
            'Review & Approve', '/smart-goals'
          ),
        });
      }
    } catch (e) { console.error('Could not load leaders for SMART approval email', e); }
  }

  if (mails.length === 0) return;
  await Promise.all(mails.map(m => transporter.sendMail({
    from: `"Accountability App" <${ADMIN_EMAIL}>`,
    ...m,
  })));
  console.log(`Sent ${mails.length} request notification email(s) for user ${event.params.uid}`);
});

// ── Career plan milestone reminder emails (daily scheduled) ─────────────────
// Runs once a day. For each user with a completed careerPlan, emails them when a
// milestone progress note is due within 5 days, or the day it lapses (points lost).
// Per-milestone flags (careerPlan.reminders) prevent duplicate emails.
const CAREER_WINDOWS = [
  { key: 'd30', label: '30-day',  days: 30,  penalty: '2 points' },
  { key: 'd90', label: '90-day',  days: 90,  penalty: '3 points' },
  { key: 'm6',  label: '6-month', days: 180, penalty: '2 points' },
  { key: 'm12', label: '12-month', days: 365, penalty: 'all your remaining points' },
];

exports.careerMilestoneReminders = onSchedule('every day 14:00', async () => {
  const snap = await admin.firestore().collection('users').get();
  let sent = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const cp = data.careerPlan;
    if (!cp?.completedAt || !data.email) continue;

    const daysSince = (Date.now() - new Date(cp.completedAt).getTime()) / 86400000;
    const reminders = { ...(cp.reminders || {}) };
    let changed = false;

    for (const w of CAREER_WINDOWS) {
      const filled = (cp.checkIns?.[w.key]?.note || '').trim().length > 0;
      if (filled) continue;
      const daysUntil = w.days - daysSince;
      const flag = reminders[w.key] || { warned: false, lapsed: false };

      // Due within 5 days (and not yet passed) → "due soon" email, once
      if (daysUntil > 0 && daysUntil <= 5 && !flag.warned) {
        await transporter.sendMail({
          from: `"Accountability App" <${ADMIN_EMAIL}>`,
          to: data.email,
          subject: `🚀 Your ${w.label} career check-in is due in ${Math.ceil(daysUntil)} day${Math.ceil(daysUntil) === 1 ? '' : 's'}`,
          html: brandedEmail(
            `Your ${w.label} career check-in is coming up`,
            `<p style="color: #475569; font-size: 15px; line-height: 1.6;">
               Add a progress note to your Career Development Plan by day ${w.days} to keep your points.
               If you miss it, you'll lose <strong>${w.penalty}</strong>.
             </p>`,
            'Add Progress Note', '/career'
          ),
        });
        flag.warned = true; changed = true; sent++;
      }

      // Just lapsed → "points lost" email, once
      if (daysUntil <= 0 && !flag.lapsed) {
        await transporter.sendMail({
          from: `"Accountability App" <${ADMIN_EMAIL}>`,
          to: data.email,
          subject: `⚠️ Your ${w.label} career check-in is overdue`,
          html: brandedEmail(
            `Your ${w.label} career check-in is overdue`,
            `<p style="color: #475569; font-size: 15px; line-height: 1.6;">
               You missed the ${w.label} checkpoint on your Career Development Plan, so <strong>${w.penalty}</strong> are at risk.
               Add your progress note now — even late, it restores that milestone's points.
             </p>`,
            'Update My Plan', '/career'
          ),
        });
        flag.lapsed = true; changed = true; sent++;
      }

      reminders[w.key] = flag;
    }

    if (changed) {
      await docSnap.ref.set({ careerPlan: { ...cp, reminders } }, { merge: true });
    }
  }
  console.log(`Career milestone reminders: sent ${sent} email(s)`);
});

// ── Weekly Accountability Score Report (motivational, Fridays) ──────────────
// Module catalogue — key matches the `tool` key stored in users/{uid}.toolSessions.
// `praise` is used when the leader USED the tool this week; `nudge` when they did not.
const MODULES = [
  { key: 'career',          label: 'Career Development Plan', icon: '🚀', praise: 'one of the most important tools a leader can use — it maps your growth and keeps you becoming who you want to be', nudge: 'Build or update your Career Development Plan — it is the backbone of long-term leadership growth.' },
  { key: 'smart-goals',     label: 'SMART Goals',            icon: '🎯', praise: 'clear, measurable goals turn intention into results — leaders who write goals achieve more', nudge: 'Set one SMART goal — a single clear, measurable target creates momentum for the whole week.' },
  { key: 'coaching',        label: 'Coaching Log',           icon: '📝', praise: 'coaching your people is the highest-leverage thing you do as a leader', nudge: 'Log a coaching session — developing others multiplies your impact far beyond your own hands.' },
  { key: 'skills',          label: 'Skills Matrix',          icon: '⭐', praise: 'knowing exactly where you stand is the first step to deliberate growth', nudge: 'Rate yourself on the Skills Matrix — you cannot improve what you have not measured.' },
  { key: 'urgency',         label: 'Sense of Urgency',       icon: '⚡', praise: 'a bias for action separates leaders who talk from leaders who deliver', nudge: 'Try the Sense of Urgency reflections — small daily prompts that sharpen your bias for action.' },
  { key: 'feedback',        label: 'Feedback',               icon: '📬', praise: 'timely feedback is a gift that helps your whole team grow', nudge: 'Give a piece of feedback this week — specific, timely input is how teams get better.' },
  { key: 'problem-solving', label: 'Problem Solving',        icon: '🔍', praise: 'getting to the real root cause is what stops problems from coming back', nudge: 'Run a 5 Whys or Fishbone — solve a problem at the root instead of firefighting the symptom.' },
  { key: 'eq-opex',         label: 'Emotional Intelligence', icon: '💡', praise: 'self-awareness under pressure is a superpower for leaders', nudge: 'Take the EQ assessment — emotional intelligence is the top predictor of leadership success.' },
  { key: 'lean',            label: 'Lean Toolkit',           icon: '🏭', praise: 'eliminating waste and running clean 5S audits builds an operation you can be proud of', nudge: 'Run a 5S audit or log a Kaizen — continuous improvement compounds week after week.' },
  { key: 'disc',            label: 'DISC',                   icon: '🧠', praise: 'understanding communication styles makes every conversation land better', nudge: 'Take the DISC assessment — understanding your style helps you flex to reach anyone.' },
  { key: 'mindfulness',     label: 'Mindfulness',            icon: '🧘', praise: 'a calm, centered leader makes better decisions', nudge: 'Take two minutes for a breathing exercise — a centered leader leads more clearly.' },
  { key: 'vision',          label: 'Vision',                 icon: '🔭', praise: 'a clear vision gives your team a destination worth working toward', nudge: 'Sharpen your Vision — people move faster when they know where they are going and why.' },
  { key: 'mentoring',       label: 'Mentoring',              icon: '🤝', praise: 'mentoring is how great leaders pass on what they know', nudge: 'Capture a mentoring moment — investing in others is investing in your legacy.' },
  { key: 'lob',             label: 'Lines of Business',      icon: '📈', praise: 'staying close to the numbers keeps your leadership grounded in reality', nudge: 'Review your Lines of Business — leaders who know their numbers make sharper calls.' },
  { key: 'training',        label: 'Training',               icon: '📚', praise: 'never-stop-learning is the habit behind every great career', nudge: 'Log a training — the best leaders are the most relentless learners.' },
  { key: 'quotes',          label: 'Leadership Quotes',      icon: '💬', praise: 'a moment of reflection with a great idea sets the tone for the day', nudge: 'Reflect on a Leadership Quote — a small daily dose of wisdom compounds over time.' },
  { key: 'visual-board',    label: 'Visual Board',           icon: '📊', praise: 'making work visible is how teams self-correct without micromanaging', nudge: 'Set up a Visual Board — visible progress keeps the whole team accountable.' },
];
const TOTAL_MODULES = MODULES.length;

const REPORT_QUOTES = [
  '"The growth and development of people is the highest calling of leadership." — Harvey Firestone',
  '"A leader is one who knows the way, goes the way, and shows the way." — John C. Maxwell',
  '"Success is the sum of small efforts repeated day in and day out." — Robert Collier',
  '"What gets measured gets managed." — Peter Drucker',
  '"The best way to predict the future is to create it." — Peter Drucker',
  '"Excellence is not an act, but a habit." — Aristotle',
  '"Leadership is not about being in charge. It is about taking care of those in your charge." — Simon Sinek',
];

function reportWeekAgoMs() { return Date.now() - 7 * 24 * 60 * 60 * 1000; }

// Map a pointEvent.toolLabel to a module key (mirrors the client's weeklyReport.js).
function toolKeyFromLabel(label = '') {
  const l = label.toLowerCase();
  if (l.startsWith('smart goal')) return 'smart-goals';
  if (l.startsWith('urgency')) return 'urgency';
  if (l.startsWith('skills')) return 'skills';
  if (l.startsWith('career')) return 'career';
  if (l.startsWith('lean') || l.startsWith('waste')) return 'lean';
  if (l.startsWith('feedback')) return 'feedback';
  if (l.startsWith('mindfulness')) return 'mindfulness';
  if (l.startsWith('action closed')) return 'visual-board';
  if (l.startsWith('coaching')) return 'coaching';
  if (l.startsWith('problem') || l.includes('5 why') || l.includes('fishbone') || l.includes('a3')) return 'problem-solving';
  if (l.startsWith('disc')) return 'disc';
  if (l.startsWith('eq')) return 'eq-opex';
  if (l.startsWith('vision')) return 'vision';
  if (l.startsWith('mentor')) return 'mentoring';
  if (l.startsWith('training')) return 'training';
  if (l.startsWith('quote')) return 'quotes';
  if (l.startsWith('line of balance') || l.startsWith('lob')) return 'lob';
  return null;
}

// Build the motivational weekly report for one user's data. Returns { subject, html }
// or null when there is nothing worth sending (never send an empty report to a
// brand-new user with zero history).
function buildWeeklyReport(data) {
  const name = (data.displayName || '').split(' ')[0] || 'Leader';
  const weekAgo = reportWeekAgoMs();
  const weekAgoStr = new Date(weekAgo).toISOString().split('T')[0];

  const events = (data.pointEvents || []).filter(e => e.date >= weekAgoStr);
  const weekPoints = events.filter(e => e.points > 0).reduce((s, e) => s + e.points, 0);
  const netPoints = events.reduce((s, e) => s + (e.points || 0), 0);

  const sessions = data.toolSessions || [];
  const usedThisWeekKeys = new Set(sessions.filter(s => (s.openedAt || 0) >= weekAgo).map(s => s.tool));
  const usedEverKeys = new Set(sessions.map(s => s.tool));
  // Fallback: also count tools inferred from point-earning activity this week.
  (data.pointEvents || []).forEach(e => {
    const key = toolKeyFromLabel(e.toolLabel || '');
    if (!key) return;
    usedEverKeys.add(key);
    if ((e.date || '') >= weekAgoStr) usedThisWeekKeys.add(key);
  });

  const usedThisWeek = MODULES.filter(m => usedThisWeekKeys.has(m.key));
  const notUsedThisWeek = MODULES.filter(m => !usedThisWeekKeys.has(m.key));
  const weekPct = Math.round((usedThisWeek.length / TOTAL_MODULES) * 100);
  const everPct = Math.round((usedEverKeys.size / TOTAL_MODULES) * 100);

  const score = data.calculatedScore != null ? data.calculatedScore : 0;
  const hasHistory = (data.pointEvents || []).length > 0 || sessions.length > 0;
  if (!hasHistory) return null;

  const quote = REPORT_QUOTES[new Date().getDate() % REPORT_QUOTES.length];

  // Recognition — celebrate up to 3 tools used this week (already priority-ordered)
  const recognition = usedThisWeek.slice(0, 3).map(m =>
    `<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eef2f7;">
       <span style="font-size:20px;">${m.icon}</span>
       <p style="margin:0;font-size:14px;color:#334155;line-height:1.5;">
         <strong style="color:#0f2044;">Great job using ${m.label}!</strong> — ${m.praise}. Keep it going, and encourage your peers to use it too.
       </p>
     </div>`).join('');

  // Recommendations — up to 3 high-priority tools NOT used this week
  const recommendations = notUsedThisWeek.slice(0, 3).map(m =>
    `<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eef2f7;">
       <span style="font-size:20px;">${m.icon}</span>
       <p style="margin:0;font-size:14px;color:#334155;line-height:1.5;">
         <strong style="color:#0f2044;">${m.label}</strong> — ${m.nudge}
       </p>
     </div>`).join('');

  // Activity list — this week's point events (most recent up to 12)
  const activityRows = events.slice(0, 12).map(e =>
    `<tr>
       <td style="padding:6px 10px;font-weight:800;color:${e.points >= 0 ? '#15803d' : '#dc2626'};white-space:nowrap;">${e.points >= 0 ? '+' : ''}${e.points}</td>
       <td style="padding:6px 10px;color:#0f2044;font-weight:600;">${e.toolLabel || 'Activity'}</td>
       <td style="padding:6px 10px;color:#64748b;font-size:12px;">${e.date}</td>
     </tr>`).join('');

  const usedBadges = usedThisWeek.length
    ? usedThisWeek.map(m => `<span style="display:inline-block;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:9999px;padding:3px 10px;font-size:12px;font-weight:700;margin:2px;">${m.icon} ${m.label}</span>`).join('')
    : '<span style="color:#94a3b8;font-size:13px;">No tools logged this week — this week is a fresh start!</span>';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#f8fafc;">
      <div style="background:linear-gradient(135deg,#0b1a38,#0f2044 60%,#0d9488 140%);padding:32px;text-align:center;">
        <p style="color:#93c5fd;margin:0 0 6px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">Your Weekly Accountability Report</p>
        <h1 style="color:#fff;margin:0;font-size:24px;">Great week, ${name}! 🎉</h1>
        <div style="margin-top:18px;display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);border-radius:14px;padding:14px 28px;">
          <span style="color:#fff;font-size:36px;font-weight:900;">${weekPoints}</span>
          <span style="color:#cbd5e1;font-size:14px;"> points earned this week</span>
        </div>
        <p style="color:#93c5fd;margin:14px 0 0;font-size:13px;">Accountability Score: <strong style="color:#fff;">${score}/100</strong>${netPoints !== weekPoints ? ` &nbsp;·&nbsp; Net movement: ${netPoints >= 0 ? '+' : ''}${netPoints}` : ''}</p>
      </div>

      <div style="padding:28px 32px;background:#fff;">
        <p style="font-size:15px;color:#334155;line-height:1.6;margin:0 0 4px;">
          Every action you logged this week is a brick in the foundation of the leader you are becoming. Here is your progress — and where to aim next. 💪
        </p>

        <!-- Tool coverage -->
        <div style="margin:24px 0;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;font-weight:800;color:#0f2044;font-size:14px;">📊 Your Tool Coverage</p>
          <p style="margin:0 0 4px;font-size:13px;color:#475569;">This week you used <strong>${usedThisWeek.length} of ${TOTAL_MODULES}</strong> tools (<strong>${weekPct}%</strong>). All-time you have explored <strong>${everPct}%</strong> of the toolkit.</p>
          <div style="background:#e2e8f0;border-radius:9999px;height:10px;margin:8px 0;"><div style="height:10px;border-radius:9999px;background:#0d9488;width:${weekPct}%;"></div></div>
          <div style="margin-top:8px;">${usedBadges}</div>
        </div>

        ${recognition ? `<h2 style="font-size:15px;color:#0f2044;margin:22px 0 4px;">🏆 What you did well</h2>${recognition}` : ''}

        <h2 style="font-size:15px;color:#0f2044;margin:22px 0 4px;">🌱 Grow next week — tools to prioritize</h2>
        <p style="font-size:13px;color:#64748b;margin:0 0 6px;">You have not touched these yet this week. Pick one or two — small, consistent steps compound into big growth:</p>
        ${recommendations || '<p style="font-size:14px;color:#15803d;font-weight:700;">Incredible — you touched every tool this week! You are setting the standard. 🌟</p>'}

        ${activityRows ? `
        <h2 style="font-size:15px;color:#0f2044;margin:24px 0 6px;">📋 This week's movement</h2>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;">
          ${activityRows}
        </table>` : ''}

        <div style="margin:26px 0 6px;padding:16px;background:#f0fdfa;border-left:4px solid #0d9488;border-radius:8px;">
          <p style="margin:0;font-size:14px;color:#0f766e;font-style:italic;line-height:1.6;">${quote}</p>
        </div>

        <div style="text-align:center;margin:26px 0 4px;">
          <a href="${APP_URL}" style="background:#0d9488;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;">Open the App & Keep Growing →</a>
        </div>
        <p style="text-align:center;font-size:13px;color:#64748b;margin:14px 0 0;">You've got this, ${name}. See you in the app next week! 🚀</p>
      </div>

      <div style="background:#0f2044;padding:16px;text-align:center;">
        <p style="color:#93c5fd;font-size:12px;margin:0;">© 2026 Leadership Flow Technologies · Accountability App</p>
      </div>
    </div>
  `;

  return { subject: `🚀 ${name}, your weekly report: ${weekPoints} points earned!`, html };
}

async function sendWeeklyReports() {
  const snap = await admin.firestore().collection('users').get();
  let sent = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!data.email || data.status === 'pending') continue;
    const report = buildWeeklyReport(data);
    if (!report) continue;
    try {
      await transporter.sendMail({
        from: `"Accountability App" <${ADMIN_EMAIL}>`,
        to: data.email,
        subject: report.subject,
        html: report.html,
      });
      sent++;
    } catch (e) { console.error(`Weekly report failed for ${data.email}`, e); }
  }
  console.log(`Weekly accountability reports: sent ${sent}`);
  return sent;
}

// Fridays at 5 PM (US Central) — end of the work week.
exports.weeklyAccountabilityReport = onSchedule(
  { schedule: 'every friday 17:00', timeZone: 'America/Chicago' },
  async () => { await sendWeeklyReports(); }
);

// On-demand: email the signed-in user their own weekly report right now (for testing/preview).
exports.sendMyWeeklyReport = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const snap = await admin.firestore().collection('users').doc(request.auth.uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'User not found');
  const data = snap.data();
  if (!data.email) throw new HttpsError('failed-precondition', 'No email on file');
  const report = buildWeeklyReport(data) || {
    subject: '🚀 Your weekly accountability report',
    html: `<div style="font-family:Arial,sans-serif;padding:24px;">Start using the app's tools this week and your next report will be full of progress! 💪 <a href="${APP_URL}">Open the app →</a></div>`,
  };
  await transporter.sendMail({
    from: `"Accountability App" <${ADMIN_EMAIL}>`,
    to: data.email,
    subject: report.subject,
    html: report.html,
  });
  return { success: true, to: data.email };
});

exports.deleteUser = onCall(async (request) => {
  if (request.auth?.token?.email !== 'hectorg@accountability-app.com') {
    throw new HttpsError('permission-denied', 'Only master admin can delete users');
  }
  const { uid } = request.data;
  // Delete from Auth if the account exists (ignore error if it doesn't)
  try { await admin.auth().deleteUser(uid); } catch (e) { /* orphan doc — no auth account */ }
  await admin.firestore().collection('users').doc(uid).delete();
  return { success: true };
});
