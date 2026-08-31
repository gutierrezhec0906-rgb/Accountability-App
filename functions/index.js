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
  const isNewRequest = newReq?.status === 'pending' && newReq.toUid &&
    (prevReq?.requestedAt !== newReq.requestedAt || prevReq?.status !== 'pending');
  const isReminder = newReq?.status === 'pending' && newReq.toUid &&
    newReq.remindedAt && prevReq?.remindedAt !== newReq.remindedAt;
  if (isNewRequest || isReminder) {
    const to = await emailForUid(newReq.toUid);
    if (to) {
      mails.push({
        to,
        subject: isReminder
          ? `🔔 Reminder: ${requesterName} is waiting on your peer assessment`
          : `🙋 ${requesterName} requested your peer assessment`,
        html: brandedEmail(
          isReminder ? 'Reminder: peer assessment still pending' : 'Peer assessment requested',
          `<p style="color: #475569; font-size: 15px; line-height: 1.6;">
             ${isReminder ? `This is a friendly reminder — <strong>${requesterName}</strong> is still waiting on you` : `<strong>${requesterName}</strong> asked you`} to rate their skills in the
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

  // 2b. Feedback delivered — email the recipient the full text of any newly
  // arrived entry in their own feedbackReceived array (written by the sender's
  // client straight onto this doc, so this fires on the RECIPIENT's own update).
  const prevReceivedIds = new Set((before.feedbackReceived || []).map(f => f.id));
  const newReceived = (after.feedbackReceived || []).filter(f => !prevReceivedIds.has(f.id));
  for (const fb of newReceived) {
    if (!after.email) continue;
    const fromName = fb.anonymous ? 'Someone (anonymous)' : (fb.from || 'A teammate');
    const stars = '★'.repeat(fb.rating || 0) + '☆'.repeat(5 - (fb.rating || 0));
    mails.push({
      to: after.email,
      subject: `📬 You received feedback from ${fromName}`,
      html: brandedEmail(
        'You received new feedback',
        `<p style="color: #475569; font-size: 15px; line-height: 1.6;">
           <strong>${fromName}</strong> sent you ${fb.type ? `<strong>${fb.type.toLowerCase()}</strong> ` : ''}feedback${fb.category ? ` on <strong>${fb.category}</strong>` : ''}.
         </p>
         <p style="color: #f59e0b; font-size: 16px; letter-spacing: 2px;">${stars}</p>
         ${fb.text ? `<p style="color: #0f2044; font-size: 14px; background: white; border-left: 3px solid #0d9488; padding: 12px 16px; line-height: 1.6; white-space: pre-line;">${fb.text}</p>` : ''}`,
        'View in Feedback Box', '/feedback'
      ),
    });
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

  // 4. New team member pending approval — fires once the signup flow attaches
  // a companyId to the new user's doc (a client update, not the initial
  // create), at which point we know which company's leaders to notify.
  const justJoinedCompany = !before.companyId && after.companyId;
  if (justJoinedCompany && after.status === 'pending') {
    try {
      const leadersSnap = await admin.firestore().collection('users')
        .where('companyId', '==', after.companyId).get();
      const leaders = leadersSnap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(u => u.uid !== event.params.uid && u.email &&
                     (u.isAdmin || u.role === 'Leader' || u.role === 'Manager'));
      for (const leader of leaders) {
        mails.push({
          to: leader.email,
          subject: `🙋 ${requesterName} is awaiting your approval`,
          html: brandedEmail(
            'New team member pending approval',
            `<p style="color: #475569; font-size: 15px; line-height: 1.6;">
               <strong>${requesterName}</strong> (${after.email || 'no email on file'}) joined
               <strong>${after.companyName || 'your company'}</strong>${after.teamName ? ` on the <strong>${after.teamName}</strong> team` : ''}
               and is waiting for your approval before they can access the app.
             </p>`,
            'Review in Team Approvals', '/approvals'
          ),
        });
      }
    } catch (e) { console.error('Could not load leaders for new-member approval email', e); }
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
// Matched against the ACTUAL toolLabel strings used across the app — do not
// guess prefixes (e.g. "Leadership Quotes" does not start with "quote";
// "Personal Vision" does not start with "vision"). Keep in sync with
// client/src/utils/scoring.js#toolKeyFromLabel.
function toolKeyFromLabel(label = '') {
  const l = label.toLowerCase();
  if (l.includes('smart goal')) return 'smart-goals';
  if (l.includes('urgency')) return 'urgency';
  if (l.includes('skills')) return 'skills';
  if (l.includes('career')) return 'career';
  if (l.includes('lean') || l.includes('waste')) return 'lean';
  if (l.includes('feedback')) return 'feedback';
  if (l.includes('mindfulness')) return 'mindfulness';
  if (l.includes('action closed') || l.includes('visual board') || l.includes('quick action')) return 'visual-board';
  if (l.includes('coaching')) return 'coaching';
  if (l.includes('problem') || l.includes('5 why') || l.includes('fishbone') || l.includes('a3')) return 'problem-solving';
  if (l.includes('disc')) return 'disc';
  if (l.includes('eq assessment') || l.includes('eq development') || l.includes('eq opex') || l.includes('opex')) return 'eq-opex';
  if (l.includes('vision')) return 'vision';
  if (l.includes('mentor')) return 'mentoring';
  if (l.includes('training')) return 'training';
  if (l.includes('quote')) return 'quotes';
  if (l.includes('line of balance') || l.includes('lob')) return 'lob';
  return null;
}

// Build the motivational weekly report for one user's data. Returns { subject, html }
// or null when there is nothing worth sending (never send an empty report to a
// brand-new user with zero history).
// Five leadership pillars (mirror the sidebar categories + colors).
const PILLARS = [
  { id: 'model',     label: 'Set the Bar',            color: '96,165,250',  keys: ['visual-board', 'lob', 'urgency', 'eq-opex'] },
  { id: 'inspire',   label: 'Spark the Vision',        color: '52,211,153',  keys: ['vision', 'smart-goals', 'mindfulness'] },
  { id: 'challenge', label: 'Improve the Flow',        color: '251,191,36',  keys: ['lean', 'problem-solving', 'disc'] },
  { id: 'enable',    label: 'Enable the Team',         color: '167,139,250', keys: ['skills', 'training', 'mentoring', 'career'] },
  { id: 'encourage', label: 'Winning with Compassion', color: '251,113,133', keys: ['feedback', 'coaching', 'quotes'] },
];
const KEY_TO_PILLAR = {};
PILLARS.forEach(p => p.keys.forEach(k => { KEY_TO_PILLAR[k] = p.id; }));
const PILLAR_ENGAGEMENT = {
  model:     'Great leaders set the standard before they ask for it — step up here and the team will follow your lead.',
  inspire:   'Your team moves faster when they can see the bigger picture — go paint it for them and watch them rally.',
  challenge: 'Every bottleneck you remove frees your whole team — hunt one down and turn friction into flow.',
  enable:    'Your real legacy is the leaders you build — pour genuine time into developing your people this week.',
  encourage: 'Recognition and care cost you nothing and change everything — use them generously and often.',
};
// Coaching session follow-up status (by each session's next-session date).
function coachingStatus(sessions = []) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const s = { ontrack: 0, warning: 0, overdue: 0, total: sessions.length, behind: [] };
  sessions.forEach(x => {
    if (!x.nextSession) { s.ontrack++; return; }
    const diff = Math.round((new Date(x.nextSession + 'T00:00:00') - today) / 86400000);
    if (diff < 0) { s.overdue++; s.behind.push({ coachee: x.coachee || 'a coachee', due: x.nextSession }); }
    else if (diff <= 14) s.warning++;
    else s.ontrack++;
  });
  return s;
}

// Training Center dashboard counts (mirror the app's Training page).
function trainingStatusCounts(trainings = []) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const s = { completed: 0, ontrack: 0, warning: 0, overdue: 0, total: trainings.length };
  trainings.forEach(t => {
    if (t.completed) { s.completed++; return; }
    if (!t.dueDate) { s.ontrack++; return; }
    const diff = Math.round((new Date(t.dueDate + 'T00:00:00') - today) / 86400000);
    if (diff < 0) s.overdue++; else if (diff <= 14) s.warning++; else s.ontrack++;
  });
  return s;
}

// LOB tasks that are behind: past a planned date column with a value under 100%.
function lobBehindTasks(lobRecords = []) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const items = [];
  lobRecords.forEach(lob => {
    (lob.tasks || []).forEach(t => {
      if (!(t.name || '').trim()) return;
      let missed = null;
      (lob.dates || []).forEach((d, ci) => {
        if (!d || missed) return;
        const raw = (t.cells || [])[ci];
        const hasVal = raw !== undefined && raw !== null && String(raw).trim() !== '';
        if (new Date(d + 'T00:00:00') < today && hasVal && parseFloat(raw) < 100) missed = d;
      });
      if (missed) items.push({ lob: lob.name || 'Line of Balance', task: t.name, due: missed });
    });
  });
  return items;
}

function buildPillars(pointsBreakdown) {
  const idx = Object.fromEntries(PILLARS.map((p, i) => [p.id, i]));
  const out = PILLARS.map(p => ({ id: p.id, label: p.label, color: p.color, items: [], total: 0 }));
  pointsBreakdown.forEach(pb => {
    const pid = KEY_TO_PILLAR[toolKeyFromLabel(pb.label)];
    if (pid != null && idx[pid] != null) { out[idx[pid]].items.push(pb); out[idx[pid]].total += pb.points; }
  });
  return out;
}

// SMART goal quality — mirrors goalQualityPct in the client.
const SMART_KEYS = ['specific', 'measurable', 'achievable', 'relevant', 'timeBound'];
function smartFieldQ(text = '') {
  const w = (text || '').trim().split(/\s+/).filter(Boolean).length;
  if (!w) return 0; if (w < 5) return 20; if (w < 15) return 50; if (w < 30) return 80; return 100;
}
function smartGoalQ(g) {
  return Math.round(SMART_KEYS.reduce((a, k) => a + smartFieldQ(g[k]), 0) / SMART_KEYS.length);
}
function smartGoalsNote(total, high, opp) {
  if (total === 0) {
    return { kudos: false, text: `You don't have any SMART goals yet — and that's the most important place to start. Please set at least 1 or 2 SMART goals this coming week. Clear, written goals are what turn effort into real, measurable leadership growth. Take 10 minutes and define where you're headed.` };
  }
  if (opp === 0) {
    return { kudos: true, text: `Kudos — great job with the quality of your SMART goals! All ${total} ${total === 1 ? 'goal is' : 'goals are'} High Quality. That clarity will keep you focused and moving.` };
  }
  return { kudos: false, text: `Please consider improving the quality and detail of your SMART goals — you have ${opp} with opportunit${opp === 1 ? 'y' : 'ies'} and ${high} at High Quality. Adding more specific, measurable detail will help you understand your objectives better and reach them.` };
}

// Personalized closing message tiered by the week's points earned.
function weeklyEncouragement(points, name) {
  if (points <= 20) {
    return {
      headline: `You've got more in you, ${name} 💪`,
      message: `${name}, I know how much your daily responsibilities pull at your time — and I believe in you. You can do better, and your development depends on no one but you. ${points} point${points === 1 ? '' : 's'} this week is a start, not your ceiling. Keep going, and let's aim for at least 35 points next week.`,
    };
  }
  if (points <= 40) {
    return {
      headline: `Nice job, ${name}! 👏`,
      message: `Nice job, ${name}! You're taking your leadership development seriously and it shows — ${points} points this week. Keep up the good work and carry this momentum into next week.`,
    };
  }
  if (points <= 60) {
    return {
      headline: `You crushed it, ${name}! 🔥`,
      message: `You crushed it, ${name}! ${points} points this week is a genuinely amazing performance. Keep operating at this level and you'll achieve great things in your career.`,
    };
  }
  return {
    headline: `Outstanding job, ${name}! 🏆`,
    message: `Outstanding job, ${name}! At ${points} points this week you're well above the average in leadership development. Keep this up and you'll be ready for your next challenge very soon.`,
  };
}

function buildWeeklyReport(data) {
  const name = (data.displayName || '').split(' ')[0] || 'Leader';
  const weekAgo = reportWeekAgoMs();
  const weekAgoStr = new Date(weekAgo).toISOString().split('T')[0];

  const events = (data.pointEvents || []).filter(e => e.date >= weekAgoStr);
  const weekPoints = events.filter(e => e.points > 0).reduce((s, e) => s + e.points, 0);
  const netPoints = events.reduce((s, e) => s + (e.points || 0), 0);
  const enc = weeklyEncouragement(weekPoints, name);
  const sgList = (data.smartGoals || []).filter(g => g && g.status !== 'deleted' && g.status !== 'archived');
  const sgHigh = sgList.filter(g => smartGoalQ(g) >= 80).length;
  const sgNote = smartGoalsNote(sgList.length, sgHigh, sgList.length - sgHigh);
  const peerReq = (data.skillsPeerRequest && data.skillsPeerRequest.status === 'pending') ? data.skillsPeerRequest : null;

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
  // Every approved user gets a report — even with zero activity, so inactive
  // users receive the encouraging 0–20 nudge rather than being silently skipped.

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

  // Points earned this week, grouped by activity and summed (highest first).
  const pointsByLabel = {};
  events.filter(e => e.points > 0).forEach(e => {
    const label = e.toolLabel || 'App activity';
    pointsByLabel[label] = (pointsByLabel[label] || 0) + e.points;
  });
  const pointsBreakdown = Object.entries(pointsByLabel)
    .map(([label, points]) => ({ label, points }))
    .sort((a, b) => b.points - a.points);
  // Accountability Board action status (embedded in the "Set the Bar" pillar).
  const actStatusOf = (a) => {
    const active = a.recommitmentDate || a.dueDate;
    if (!active) return 'Green';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(active + 'T00:00:00') - today) / 86400000);
    if (days < 0) return 'Red'; if (days <= 5) return 'Yellow'; return 'Green';
  };
  const allActionsEver = data.visualBoard || [];
  const openActions = allActionsEver.filter(a => !a.closed)
    .map(a => ({ title: a.title || 'Untitled', owner: a.owner || '', due: a.recommitmentDate || a.dueDate || '', status: actStatusOf(a) }));
  // Say-Do Ratio — accountability-board actions, all-time since account creation:
  // committed (every action ever created) vs. actually delivered on the original
  // commitment (closed on time, no recommitments needed). recommitmentCount > 0
  // means the due date slipped and had to be pushed at least once.
  const totalCommitted = allActionsEver.length;
  const totalClosedOnTime = allActionsEver.filter(a => a.closed && a.closedOnTime).length;
  const totalMultipleCommitments = allActionsEver.filter(a => (a.recommitmentCount || 0) > 1).length;
  const sayDoRatioPct = totalCommitted > 0 ? Math.round((totalClosedOnTime / totalCommitted) * 100) : null;
  const redA = openActions.filter(a => a.status === 'Red');
  const yelA = openActions.filter(a => a.status === 'Yellow');
  const grnC = openActions.filter(a => a.status === 'Green').length;
  const lobBehind = lobBehindTasks(data.lobRecords || []);
  const trainStatus = trainingStatusCounts(data.trainings || []);
  const coachStatus = coachingStatus(data.coachingSessions || []);

  // The report embedded inside each pillar (mirrors the PDF).
  function pillarReport(id) {
    const pcolor = (PILLARS.find(x => x.id === id) || {}).color || '226,232,240';
    if (id === 'model') {
      const chip = (label, count, color) => `<span style="display:inline-block;background:${color}1a;color:${color};border:1px solid ${color}55;border-radius:9999px;padding:2px 10px;font-size:12px;font-weight:800;margin:2px 4px 2px 0;">${label} ${count}</span>`;
      const flagged = [...redA, ...yelA].map(a =>
        `<div style="font-size:12px;color:#475569;padding:3px 0;"><strong style="color:${a.status === 'Red' ? '#dc2626' : '#b45309'};">${a.status}</strong> — ${a.title} <span style="color:#94a3b8;">(due ${a.due || '—'})</span></div>`).join('');
      const lobHtml = lobBehind.length ? `
        <p style="margin:10px 0 4px;font-size:12px;font-weight:800;color:#dc2626;">Line of Balance — Catch Up Needed</p>
        <p style="margin:0 0 4px;font-size:12.5px;color:#b91c1c;font-weight:600;line-height:1.5;">${lobBehind.length} Line-of-Balance task${lobBehind.length === 1 ? ' is' : 's are'} past a planned date and not yet 100% complete. It's imperative you catch up — a slipping schedule compounds fast. You've got this: block time this week, update the numbers, and get each activity back on pace.</p>
        ${lobBehind.slice(0, 8).map(it => `<div style="font-size:12px;color:#475569;padding:2px 0;">• <strong>${it.task}</strong> (${it.lob}) — behind since ${it.due}</div>`).join('')}` : '';
      return `<div style="padding:6px 14px 4px;">
        <p style="margin:2px 0 6px;font-size:12px;font-weight:800;color:#0f2044;">Accountability Board — Action Status</p>
        ${chip('🔴 Overdue', redA.length, '#dc2626')}${chip('🟡 Due Soon', yelA.length, '#b45309')}${chip('🟢 On Track', grnC, '#15803d')}
        ${flagged ? `<div style="margin-top:6px;">${flagged}</div>` : (openActions.length ? '<p style="font-size:12px;color:#94a3b8;margin:6px 0 0;">All open actions are on track.</p>' : '<p style="font-size:12px;color:#94a3b8;margin:6px 0 0;">No open actions on your Accountability Board.</p>')}
        ${lobHtml}
      </div>`;
    }
    if (id === 'inspire' && sgNote) {
      return `<div style="margin:6px 14px 4px;padding:10px 12px;background:${sgNote.kudos ? '#f0fdf4' : '#fffbeb'};border-left:3px solid ${sgNote.kudos ? '#16a34a' : '#f59e0b'};border-radius:6px;">
        <p style="margin:0;font-size:12.5px;color:${sgNote.kudos ? '#15803d' : '#b45309'};font-weight:${sgNote.kudos ? 700 : 600};line-height:1.5;">${sgNote.text}</p></div>`;
    }
    if (id === 'encourage') {
      const cs = coachStatus;
      if (!cs.total) return '';
      const tile = (label, count, color) => `<td style="width:33%;padding:4px;"><div style="background:#f8fafc;border:1.5px solid rgb(${pcolor});border-radius:6px;padding:8px;text-align:center;"><div style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;margin-bottom:2px;"></div><div style="font-size:18px;font-weight:900;color:${color};line-height:1;">${count}</div><div style="font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:2px;">${label}</div></div></td>`;
      const names = cs.behind.map(b => b.coachee).slice(0, 4).join(', ');
      const nudge = cs.overdue > 0 ? `<div style="margin:6px 14px 4px;padding:10px 12px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:6px;">
        <p style="margin:0;font-size:12.5px;color:#b91c1c;font-weight:600;line-height:1.5;">You have ${cs.overdue} coaching follow-up${cs.overdue === 1 ? '' : 's'} past due (${names}). Following through is where leaders are truly built — the people you develop remember who showed up. Reconnect this week and keep their growth moving.</p></div>` : '';
      return `<p style="margin:8px 14px 4px;font-size:12px;font-weight:800;color:#0f2044;">Coaching Log — Follow-Up Status</p>
        <table style="width:calc(100% - 20px);margin:0 14px;border-collapse:collapse;"><tr>
          ${tile('On Track', cs.ontrack, '#16a34a')}${tile('Due Soon', cs.warning, '#f59e0b')}${tile('Past Due', cs.overdue, '#dc2626')}
        </tr></table>${nudge}`;
    }
    if (id === 'enable') {
      const ts = trainStatus;
      const tile = (label, count, color) => `<td style="width:25%;padding:4px;"><div style="background:#f8fafc;border:1.5px solid rgb(${pcolor});border-radius:6px;padding:8px;text-align:center;"><div style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;margin-bottom:2px;"></div><div style="font-size:18px;font-weight:900;color:${color};line-height:1;">${count}</div><div style="font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:2px;">${label}</div></div></td>`;
      const trainingHtml = ts.total ? `
        <p style="margin:8px 14px 4px;font-size:12px;font-weight:800;color:#0f2044;">Training Center — Dashboard</p>
        <table style="width:calc(100% - 20px);margin:0 14px;border-collapse:collapse;"><tr>
          ${tile('Completed', ts.completed, '#0d9488')}${tile('On Track', ts.ontrack, '#16a34a')}${tile('Due Soon', ts.warning, '#f59e0b')}${tile('Past Due', ts.overdue, '#dc2626')}
        </tr></table>
        <p style="margin:2px 14px 0;font-size:11px;color:#94a3b8;">${ts.completed} of ${ts.total} complete (${Math.round((ts.completed / ts.total) * 100)}%)</p>` : '';
      const skillsHtml = peerReq ? `<div style="margin:8px 14px 4px;padding:10px 12px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:6px;">
        <p style="margin:0;font-size:12.5px;color:#b45309;font-weight:600;line-height:1.5;">We strongly recommend following up with <strong>${peerReq.toName || 'your teammate'}</strong> — in person or by email — to complete your skills assessment. Your request is still pending.</p></div>` : '';
      return trainingHtml + skillsHtml;
    }
    return '';
  }

  // Points grouped into the five leadership pillars (sidebar colors), each with its report.
  const pillars = buildPillars(pointsBreakdown);
  // Two least-active pillars this week + the specific modules not used, for the
  // strong "grow these next week" recommendation.
  const moduleLabel = Object.fromEntries(MODULES.map(m => [m.key, m.label]));
  pillars.forEach(p => {
    const keys = (PILLARS.find(x => x.id === p.id) || {}).keys || [];
    p.unusedTools = keys.filter(kk => !usedThisWeekKeys.has(kk)).map(kk => moduleLabel[kk] || kk);
    p.engagement = PILLAR_ENGAGEMENT[p.id] || '';
  });
  const weakPillars = pillars
    .filter(p => p.unusedTools.length > 0)
    .sort((a, b) => a.total - b.total || b.unusedTools.length - a.unusedTools.length)
    .slice(0, 2);
  const weakPillarsHtml = weakPillars.length
    ? weakPillars.map(p => `
      <div style="margin:10px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-left:4px solid rgb(${p.color});padding:4px 12px;">
          <span style="font-weight:800;font-size:14px;color:rgb(${p.color});">${p.label}</span>
          <span style="font-size:12px;color:#94a3b8;">${p.total > 0 ? `only +${p.total} pt${p.total === 1 ? '' : 's'} this week` : 'no points this week'}</span>
        </div>
        <p style="margin:4px 12px 0;font-size:13px;color:#334155;line-height:1.5;">You didn't use <strong>${p.unusedTools.join(', ')}</strong> this week. ${p.engagement}</p>
      </div>`).join('')
    : '<p style="font-size:14px;color:#15803d;font-weight:700;">Outstanding breadth — you touched every leadership pillar this week. Keep the whole system moving! 🌟</p>';
  const pillarsHtml = pillars.map(p => `
    <div style="margin:12px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-left:4px solid rgb(${p.color});background:#f8fafc;padding:6px 12px;border-radius:4px;">
        <span style="font-weight:800;font-size:14px;color:rgb(${p.color});">${p.label}</span>
        <span style="font-weight:800;font-size:14px;color:rgb(${p.color});">${p.total > 0 ? `+${p.total} pt${p.total === 1 ? '' : 's'}` : '—'}</span>
      </div>
      ${p.items.length
        ? p.items.map(it => `<div style="display:flex;justify-content:space-between;padding:5px 14px;font-size:13px;color:#334155;"><span>${it.label}</span><span style="font-weight:700;color:#0f2044;">+${it.points}</span></div>`).join('')
        : '<div style="padding:5px 14px;font-size:12px;color:#94a3b8;">No points earned in this pillar this week.</div>'}
      ${pillarReport(p.id)}
    </div>`).join('');

  const usedBadges = usedThisWeek.length
    ? usedThisWeek.map(m => `<span style="display:inline-block;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:9999px;padding:3px 10px;font-size:12px;font-weight:700;margin:2px;">${m.icon} ${m.label}</span>`).join('')
    : '<span style="color:#94a3b8;font-size:13px;">No tools logged this week — this week is a fresh start!</span>';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#f8fafc;">
      <div style="background:linear-gradient(135deg,#0b1a38,#0f2044 60%,#0d9488 140%);padding:32px;text-align:center;">
        <p style="color:#93c5fd;margin:0 0 6px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">Your Weekly Accountability Report</p>
        <h1 style="color:#fff;margin:0;font-size:24px;">${enc.headline}</h1>
        <div style="margin-top:18px;display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);border-radius:14px;padding:14px 28px;">
          <span style="color:#fff;font-size:36px;font-weight:900;">${weekPoints}</span>
          <span style="color:#cbd5e1;font-size:14px;"> points earned this week</span>
        </div>
        <p style="color:#93c5fd;margin:14px 0 0;font-size:13px;">Accountability Score: <strong style="color:#fff;">${score}/100</strong>${netPoints !== weekPoints ? ` &nbsp;·&nbsp; Net movement: ${netPoints >= 0 ? '+' : ''}${netPoints}` : ''}</p>
      </div>

      <div style="padding:28px 32px;background:#fff;">
        <h2 style="font-size:17px;color:#0f2044;margin:0 0 6px;">Your Accountability Score for This Week</h2>
        <p style="font-size:13.5px;color:#475569;line-height:1.6;margin:0 0 6px;">
          Here is your week at a glance — <strong>Points This Week</strong> is what you earned in the last 7 days, <strong>Accountability Score</strong> is your overall standing out of 100, and <strong>Tool Coverage</strong> is how much of the leadership toolkit you used. Every action is a brick in the foundation of the leader you are becoming. 💪
        </p>

        <!-- Tool coverage -->
        <div style="margin:24px 0;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;font-weight:800;color:#0f2044;font-size:14px;">📊 Your Tool Coverage</p>
          <p style="margin:0 0 4px;font-size:13px;color:#475569;">This week you used <strong>${usedThisWeek.length} of ${TOTAL_MODULES}</strong> tools (<strong>${weekPct}%</strong>). All-time you have explored <strong>${everPct}%</strong> of the toolkit.</p>
          <div style="background:#e2e8f0;border-radius:9999px;height:10px;margin:8px 0;"><div style="height:10px;border-radius:9999px;background:#0d9488;width:${weekPct}%;"></div></div>
          <div style="margin-top:8px;">${usedBadges}</div>
        </div>

        ${recognition ? `<h2 style="font-size:15px;color:#0f2044;margin:22px 0 4px;">🏆 What you did well</h2>${recognition}` : ''}

        ${weekPoints > 0 ? `
        <h2 style="font-size:15px;color:#0f2044;margin:22px 0 6px;">🎉 Points you earned this week</h2>
        <p style="font-size:13px;color:#475569;margin:0 0 8px;">Great work, ${name}! You earned ${weekPoints} point${weekPoints === 1 ? '' : 's'} this week across the five leadership pillars:</p>
        ${pillarsHtml}` : ''}

        <h2 style="font-size:15px;color:#0f2044;margin:24px 0 4px;">🌱 Focus next week — your two growth pillars</h2>
        ${weakPillars.length ? `<p style="font-size:13px;color:#64748b;margin:0 0 6px;">Your two quietest pillars this week were <strong>${weakPillars.map(p => p.label).join('</strong> and <strong>')}</strong>. Make these your priority next week — here's exactly where to grow:</p>` : ''}
        ${weakPillarsHtml}

        <div style="margin:26px 0 6px;padding:16px;background:#f0fdfa;border-left:4px solid #0d9488;border-radius:8px;">
          <p style="margin:0;font-size:14px;color:#0f766e;font-weight:700;line-height:1.6;">${enc.message}</p>
        </div>

        <div style="text-align:center;margin:26px 0 4px;">
          <a href="${APP_URL}" style="background:#0d9488;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;">Open the App & Keep Growing →</a>
        </div>
        <p style="text-align:center;font-size:13px;color:#64748b;margin:14px 0 0;">You've got this, ${name}. See you in the app next week! 🚀</p>

        ${totalCommitted > 0 ? `
        <h2 style="font-size:15px;color:#0f2044;margin:28px 0 4px;border-top:1px solid #e2e8f0;padding-top:20px;">🎯 Say-Do Ratio — Accountability Board, All-Time</h2>
        <p style="font-size:13px;color:#475569;margin:0 0 10px;line-height:1.6;">A say-do ratio measures whether what you commit to gets delivered — every action you've ever created on the Accountability Board, since you opened your account, versus how many you actually closed on time with no recommitments.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><tr>
          <td style="width:33%;padding:4px;"><div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:12px 6px;text-align:center;"><div style="font-size:24px;line-height:1;">📋</div><div style="font-size:22px;font-weight:900;color:#0f2044;margin-top:4px;">${totalCommitted}</div><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:2px;">Total Actions Committed</div></div></td>
          <td style="width:33%;padding:4px;"><div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:12px 6px;text-align:center;"><div style="font-size:24px;line-height:1;">✅</div><div style="font-size:22px;font-weight:900;color:#15803d;margin-top:4px;">${totalClosedOnTime}</div><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:2px;">Closed On Time</div></div></td>
          <td style="width:33%;padding:4px;"><div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:8px;padding:12px 6px;text-align:center;"><div style="font-size:24px;line-height:1;">🔁</div><div style="font-size:22px;font-weight:900;color:#b45309;margin-top:4px;">${totalMultipleCommitments}</div><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:2px;">Multiple Commitments</div></div></td>
        </tr></table>
        <div style="background:linear-gradient(135deg,#0b1a38,#0f2044 60%,#0d9488 140%);border-radius:10px;padding:18px;text-align:center;">
          <div style="font-size:11px;color:#93c5fd;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">🎯 Say-Do Ratio</div>
          <div style="font-size:34px;font-weight:900;color:#fff;line-height:1.2;margin-top:4px;">${sayDoRatioPct}%</div>
          <div style="font-size:12px;color:#cbd5e1;margin-top:2px;">${totalClosedOnTime} of ${totalCommitted} committed actions closed on time</div>
        </div>` : ''}
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

// Leaders/Managers/Admins invite a new team member by email + role. Only the
// inviter's own company can be assigned — the invite record and the outbound
// email are both built server-side so a client can't forge a different
// companyId onto the invite.
const INVITE_ROLES = ['Supervisor', 'Manager', 'Individual Contributor'];

exports.sendInvite = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const email = String(request.data?.email || '').trim().toLowerCase();
  const role = request.data?.role;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'A valid email address is required');
  }
  if (!INVITE_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'Position must be Supervisor, Manager, or Individual Contributor');
  }
  const requestedTeamId = request.data?.teamId || null;
  const newTeamName = String(request.data?.newTeamName || '').trim();
  if (!requestedTeamId && !newTeamName) {
    throw new HttpsError('invalid-argument', 'Select a team or provide a new team name');
  }

  const inviterSnap = await admin.firestore().collection('users').doc(request.auth.uid).get();
  const inviter = inviterSnap.exists ? inviterSnap.data() : null;
  if (!inviter) throw new HttpsError('not-found', 'Inviter profile not found');

  const canInvite = inviter.isAdmin || inviter.role === 'Leader';
  if (!canInvite) throw new HttpsError('permission-denied', 'Only Leaders or Admins can send invitations');
  if (!inviter.companyId) throw new HttpsError('failed-precondition', 'You must be assigned to a company before you can invite members');

  const existingUser = await admin.firestore().collection('users').where('email', '==', email).limit(1).get();
  if (!existingUser.empty) throw new HttpsError('already-exists', 'Someone with this email already has an account');

  const companySnap = await admin.firestore().collection('companies').doc(inviter.companyId).get();
  const companyName = companySnap.exists ? (companySnap.data().name || '') : '';

  // Resolve the team: either an existing team the inviter's company owns, or
  // create a new one on the fly (client can't write teams/* directly — that's
  // master-admin only in firestore.rules — so the invited member's team is
  // always set here by the leader, never picked by the invitee at signup).
  let teamId, teamName;
  if (requestedTeamId) {
    const teamSnap = await admin.firestore().collection('teams').doc(requestedTeamId).get();
    if (!teamSnap.exists || teamSnap.data().companyId !== inviter.companyId) {
      throw new HttpsError('invalid-argument', 'Selected team does not belong to your company');
    }
    teamId = requestedTeamId;
    teamName = teamSnap.data().name || '';
  } else {
    const teamRef = await admin.firestore().collection('teams').add({
      name: newTeamName,
      companyId: inviter.companyId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    });
    teamId = teamRef.id;
    teamName = newTeamName;
  }

  const inviteRef = await admin.firestore().collection('invites').add({
    email,
    role,
    companyId: inviter.companyId,
    companyName,
    teamId,
    teamName,
    invitedByUid: request.auth.uid,
    invitedByName: inviter.displayName || inviter.email || 'A leader',
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const signupUrl = `${APP_URL}/signup?invite=${inviteRef.id}&email=${encodeURIComponent(email)}&role=${encodeURIComponent(role)}&company=${encodeURIComponent(companyName)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0f2044; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Leadership Flow Technologies</h1>
        <p style="color: #93c5fd; margin: 8px 0 0;">Accountability App</p>
      </div>
      <div style="padding: 32px; background: #f8fafc;">
        <h2 style="color: #0f2044; margin-top: 0;">You're Invited to Grow as a Leader! 🚀</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Welcome to the Accountability App! <strong>${inviter.displayName || 'Your leader'}</strong> at <strong>${companyName}</strong> has personally invited you to join as a <strong>${role}</strong>.
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          This is where you'll build lasting leadership habits, sharpen your accountability, and track real, measurable growth — one action at a time. Every tool inside is designed to help you become a stronger, more capable leader on your team.
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Your journey starts with one click. Create your account and let's get to work.
        </p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${signupUrl}"
             style="background: #0d9488; color: white; padding: 14px 34px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
            Create Your Account →
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${signupUrl}" style="color: #0d9488; word-break: break-all;">${signupUrl}</a>
        </p>
      </div>
      <div style="background: #0f2044; padding: 16px; text-align: center;">
        <p style="color: #93c5fd; font-size: 12px; margin: 0;">
          © 2026 Leadership Flow Technologies. All rights reserved.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Leadership Flow Technologies" <${ADMIN_EMAIL}>`,
    to: email,
    subject: `${inviter.displayName || 'Your leader'} invited you to join ${companyName} on the Accountability App`,
    html,
  });

  return { success: true, inviteId: inviteRef.id };
});

// Shared helper for every AI-assist Cloud Function — calls Anthropic's API
// directly via fetch (Node 20 has it built in) rather than pulling in the SDK,
// since these are the only AI calls in the app so far. `userPromptOrMessages`
// is either a single user-turn string (existing single-shot callers) or a
// full messages array [{role,content},...] for multi-turn conversations
// (the coaching practice roleplay).
async function callClaude(systemPrompt, userPromptOrMessages, maxTokens = 400) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new HttpsError('failed-precondition', 'AI assistant is not configured yet — ask your admin to add the ANTHROPIC_API_KEY secret.');

  const messages = Array.isArray(userPromptOrMessages)
    ? userPromptOrMessages
    : [{ role: 'user', content: userPromptOrMessages }];

  let resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      }),
    });
  } catch (e) {
    throw new HttpsError('unavailable', 'Could not reach the AI service: ' + (e?.message || 'network error'));
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new HttpsError('internal', `AI request failed (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  return (data.content || []).map(b => b.text || '').join('').trim();
}

// Strips a ```json ... ``` (or bare ```) fence some models wrap a JSON answer
// in, so a parse failure doesn't fall back to leaking "```json"/"["/"]" as
// fake list items.
function stripCodeFence(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

// AI assistant for the Coaching Log — two modes:
//   'questions' — suggest 4 open-ended coaching questions from a coaching goal
//   'outcome'   — draft a short outcome summary from session notes + action items
exports.coachingAiAssist = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { mode, goal, notes, actionItems } = request.data || {};
  let systemPrompt, userPrompt;

  if (mode === 'questions') {
    if (!(goal || '').trim()) throw new HttpsError('invalid-argument', 'Enter a coaching goal first');
    systemPrompt = 'You are an expert executive coach. Given a coaching goal, suggest exactly 4 short, open-ended coaching questions a manager could ask in the session to help the coachee reach their own insights (questions-first coaching, not advice-giving). Return ONLY a JSON array of 4 strings — no other text, no markdown.';
    userPrompt = `Coaching goal: ${goal.trim()}`;
  } else if (mode === 'outcome') {
    if (!(notes || '').trim()) throw new HttpsError('invalid-argument', 'Add session notes first');
    const itemsText = (actionItems || [])
      .map(a => (typeof a === 'string' ? a : a?.action || ''))
      .filter(Boolean)
      .join('; ');
    systemPrompt = 'You are an expert executive coach. Given coaching session notes and action items, write a concise 2-3 sentence outcome summary suitable for a coaching log record. Return ONLY the outcome text — no preamble, no quotes, no markdown.';
    userPrompt = `Session notes: ${notes.trim()}\n\nAction items: ${itemsText || 'None recorded'}`;
  } else {
    throw new HttpsError('invalid-argument', 'Unknown mode');
  }

  const text = await callClaude(systemPrompt, userPrompt);

  if (mode === 'questions') {
    const cleaned = stripCodeFence(text);
    let questions;
    try {
      questions = JSON.parse(cleaned);
    } catch {
      questions = cleaned
        .split('\n')
        .map(s => s.replace(/^[-*\d.\s]+/, '').replace(/^["'[]+|["',\]]+$/g, '').trim())
        .filter(s => s && s !== '[' && s !== ']');
    }
    return { questions: (Array.isArray(questions) ? questions : []).slice(0, 4) };
  }
  return { outcome: text };
});

// AI assistant for the 5 Whys tool — two modes:
//   'suggestWhy'       — propose one plausible next-level cause, continuing the chain
//   'suggestRootCause' — synthesize a root cause + countermeasure from the full chain
exports.fiveWhysAiAssist = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { mode, problem, whys, index } = request.data || {};
  if (!(problem || '').trim()) throw new HttpsError('invalid-argument', 'Fill in the Problem Statement first');
  const chain = (whys || []).map(w => (w || '').trim()).filter(Boolean);

  let systemPrompt, userPrompt;
  if (mode === 'suggestWhy') {
    const i = Number.isInteger(index) ? index : chain.length;
    const priorAnswer = i === 0 ? problem.trim() : chain[i - 1];
    if (i > 0 && !priorAnswer) throw new HttpsError('invalid-argument', 'Fill in the previous Why first');
    systemPrompt = 'You are an expert in root cause analysis using the 5 Whys method. Given a problem statement and the causal chain of Why answers built so far, suggest ONE plausible next-level cause that logically continues the chain — focus on process, system, or standard-work factors, never blame an individual. Return ONLY the suggested answer as one or two sentences — no preamble, no quotes, no markdown, no numbering.';
    const chainText = chain.length ? chain.map((w, idx) => `Why ${idx + 1}: ${w}`).join('\n') : 'None yet';
    userPrompt = `Problem statement: ${problem.trim()}\n\nChain so far:\n${chainText}\n\nSuggest the answer to: "${i === 0 ? 'Why did this happen?' : 'Why did that happen?'}" (continuing from: "${priorAnswer}")`;
  } else if (mode === 'suggestRootCause') {
    if (chain.length < 2) throw new HttpsError('invalid-argument', 'Fill in at least 2 Whys first');
    systemPrompt = 'You are an expert in root cause analysis using the 5 Whys method. Given a problem statement and a full chain of Why answers, write a concise root cause statement plus a proposed countermeasure (a process/system fix, not blaming a person). 2-3 sentences total. Return ONLY that text — no preamble, no quotes, no markdown.';
    const chainText = chain.map((w, idx) => `Why ${idx + 1}: ${w}`).join('\n');
    userPrompt = `Problem statement: ${problem.trim()}\n\nChain:\n${chainText}`;
  } else {
    throw new HttpsError('invalid-argument', 'Unknown mode');
  }

  const text = await callClaude(systemPrompt, userPrompt, 300);
  return { suggestion: text };
});

// AI assistant for SMART Goals — drafts all 5 SMART components (Specific,
// Measurable, Achievable, Relevant, Time-Bound) from a rough goal title/idea,
// so a user can start from a draft instead of a blank field for each one.
exports.smartGoalAiAssist = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { title, dueDate } = request.data || {};
  if (!(title || '').trim()) throw new HttpsError('invalid-argument', 'Enter a goal title first');

  const systemPrompt = 'You are an expert in SMART goal-setting for leadership development. Given a rough goal title (and optionally a target date), draft a strong, specific version of each SMART component: Specific, Measurable, Achievable, Relevant, and Time-Bound. Each should be 1-2 concrete sentences (20-40 words), written as if the goal-owner wrote it themselves in first person. Return ONLY a JSON object with exactly these keys: specific, measurable, achievable, relevant, timeBound. No other text, no markdown.';
  const userPrompt = `Goal title: ${title.trim()}${dueDate ? `\nTarget date: ${dueDate}` : ''}`;

  const text = await callClaude(systemPrompt, userPrompt, 600);
  const cleaned = stripCodeFence(text);
  let draft;
  try {
    draft = JSON.parse(cleaned);
  } catch {
    throw new HttpsError('internal', 'AI response could not be parsed — try again');
  }
  const fields = ['specific', 'measurable', 'achievable', 'relevant', 'timeBound'];
  const result = {};
  fields.forEach(k => { result[k] = typeof draft?.[k] === 'string' ? draft[k].trim() : ''; });
  return { draft: result };
});

// Posts to a Microsoft Teams channel via an Incoming Webhook when a new
// Visual Management action item is created — so the whole team sees it in
// Teams without opening the app. The webhook URL is a secret (posting to it
// requires no auth at all), so it lives only server-side as an env var, never
// exposed to the client.
exports.notifyTeamsNewAction = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) return { posted: false, reason: 'not-configured' };

  const { title, owner, dueDate, createdByName } = request.data || {};
  if (!(title || '').trim()) throw new HttpsError('invalid-argument', 'Missing action title');

  const card = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '0D9488',
    summary: 'New action item on the Accountability Board',
    title: '🔴 New Action Item — Accountability Board',
    sections: [{
      facts: [
        { name: 'Action', value: title },
        { name: 'Owner', value: owner || 'Unassigned' },
        { name: 'Due Date', value: dueDate || 'No due date' },
        { name: 'Created By', value: createdByName || 'A teammate' },
      ],
    }],
    potentialAction: [{
      '@type': 'OpenUri',
      name: 'Open the Accountability Board',
      targets: [{ os: 'default', uri: `${APP_URL}/visual-board` }],
    }],
  };

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(card),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.warn(`Teams webhook failed (${resp.status}): ${errText.slice(0, 200)}`);
      return { posted: false, reason: 'webhook-error' };
    }
    return { posted: true };
  } catch (e) {
    console.warn('Could not reach Teams webhook: ' + (e?.message || 'network error'));
    return { posted: false, reason: 'network-error' };
  }
});

// Sends a text message (via Twilio) to every teammate who has opted in with a
// phoneNumber on their profile, whenever a new Visual Management action item
// is created. Twilio credentials are secrets — live only server-side as env
// vars, never exposed to the client.
exports.notifySmsNewAction = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken   = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber  = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) return { sent: 0, reason: 'not-configured' };

  const { title, owner, dueDate } = request.data || {};
  if (!(title || '').trim()) throw new HttpsError('invalid-argument', 'Missing action title');

  const callerSnap = await admin.firestore().collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.exists ? callerSnap.data() : null;
  if (!caller?.companyId) return { sent: 0, reason: 'no-company' };

  const teamSnap = await admin.firestore().collection('users')
    .where('companyId', '==', caller.companyId)
    .get();
  const recipients = teamSnap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.uid !== request.auth.uid && (u.phoneNumber || '').trim());

  if (!recipients.length) return { sent: 0, reason: 'no-recipients' };

  const body = `📋 New action item on the Accountability Board: "${title.trim()}" — Owner: ${owner || 'Unassigned'}${dueDate ? `, Due ${dueDate}` : ''}. ${APP_URL}/visual-board`;
  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const results = await Promise.allSettled(recipients.map(u => {
    const params = new URLSearchParams({ To: u.phoneNumber.trim(), From: fromNumber, Body: body });
    return fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: authHeader },
      body: params,
    }).then(resp => { if (!resp.ok) throw new Error(`Twilio ${resp.status}`); });
  }));

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return { sent, attempted: recipients.length };
});

// Emails every teammate in the same company (except whoever created it)
// whenever a new Visual Management action item is added. Uses the existing
// Zoho transporter/brandedEmail helper already wired up for every other
// notification in the app — no new secrets needed.
exports.notifyEmailNewAction = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { title, owner, dueDate } = request.data || {};
  if (!(title || '').trim()) throw new HttpsError('invalid-argument', 'Missing action title');

  const callerSnap = await admin.firestore().collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.exists ? callerSnap.data() : null;
  if (!caller?.companyId) return { sent: 0, reason: 'no-company' };

  const teamSnap = await admin.firestore().collection('users')
    .where('companyId', '==', caller.companyId)
    .get();
  const recipients = teamSnap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.uid !== request.auth.uid && (u.email || '').trim());

  if (!recipients.length) return { sent: 0, reason: 'no-recipients' };

  const creatorName = caller.displayName || caller.email || 'A teammate';
  const html = brandedEmail(
    '📋 New Action Item on the Accountability Board',
    `<p style="color:#475569;font-size:16px;line-height:1.6;">
       <strong>${creatorName}</strong> just added a new action to the Accountability Board:
     </p>
     <div style="background:white;border-radius:10px;padding:18px 20px;margin:16px 0;border:1px solid #e2e8f0;">
       <table style="width:100%;border-collapse:collapse;">
         <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px;width:110px;">Action</td><td style="padding:6px 0;font-weight:700;color:#0f2044;">${title}</td></tr>
         <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px;">Owner</td><td style="padding:6px 0;color:#0f2044;">${owner || 'Unassigned'}</td></tr>
         <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px;">Due Date</td><td style="padding:6px 0;color:#0f2044;">${dueDate || 'No due date'}</td></tr>
       </table>
     </div>`,
    'Open the Accountability Board',
    '/visual-board'
  );

  const results = await Promise.allSettled(recipients.map(u => transporter.sendMail({
    from: `"Accountability App" <${ADMIN_EMAIL}>`,
    to: u.email,
    subject: `New Action Item: "${title}"`,
    html,
  })));

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return { sent, attempted: recipients.length };
});

// Coaching Log — AI-powered voice practice. The coach speaks (browser mic +
// speech-to-text on the client), Claude plays a realistic coachee persona and
// writes the reply in character, and ElevenLabs turns that reply into speech
// so the coach hears a "real" voice talking back. Multi-turn: the client
// sends the running transcript each time so the coachee stays consistent.
const PRACTICE_SCENARIOS = {
  underperformance: 'You are Jordan, an employee whose performance has slipped over the last month — missed two deadlines and a quality issue on a deliverable. You are a bit defensive at first, feel a little overwhelmed and possibly burnt out, but you are not a bad employee and you do want to improve if the manager approaches this with empathy rather than blame. Open up gradually as the conversation goes well; stay guarded or push back if the manager is accusatory.',
  conflict: 'You are Sam, a team member who has been in a tense conflict with a coworker over shared responsibilities on a project. You feel unheard and a little frustrated, and you believe the other person hasn\'t been pulling their weight. You are willing to talk it through but you want to feel like your side is genuinely being heard before you soften.',
  career: 'You are Alex, an ambitious employee who wants to grow into a leadership role but isn\'t sure what steps to take or whether your manager sees that potential in you. You are enthusiastic but also a little insecure about whether you are "ready." You ask thoughtful questions and respond well to specific, concrete guidance.',
  resistance: 'You are Casey, a longtime team member who is skeptical and resistant to a new process or tool the company wants to roll out. You liked how things worked before and worry the change will slow you down. You are polite but push back with specific objections; you can be won over by a manager who listens to your concerns and involves you in the solution rather than just dictating it.',
  disciplinary: 'You are Taylor, receiving a serious conversation about a repeated conduct or attendance issue that has already been discussed once before. You are anxious and a little defensive, possibly minimizing the issue at first. You respond to a manager who is direct but respectful and fair; you shut down or get combative if the manager is harsh or dismissive.',
};

exports.coachingPracticeReply = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { scenario, history, message } = request.data || {};
  const persona = PRACTICE_SCENARIOS[scenario];
  if (!persona) throw new HttpsError('invalid-argument', 'Unknown or missing scenario');
  if (!(message || '').trim()) throw new HttpsError('invalid-argument', 'Missing coach message');

  const systemPrompt = `${persona}\n\nStay fully in character as this person for the entire conversation. Respond naturally and conversationally, as if speaking out loud — 1 to 4 sentences, no stage directions, no asterisks, no narration, just what you would actually say. Never break character to give coaching advice or acknowledge you are an AI.`;

  const messages = (Array.isArray(history) ? history : [])
    .filter(h => (h?.text || '').trim())
    .map(h => ({ role: h.role === 'coachee' ? 'assistant' : 'user', content: h.text.trim() }));
  messages.push({ role: 'user', content: message.trim() });

  const replyText = await callClaude(systemPrompt, messages, 250);

  // Text-to-speech via ElevenLabs, so the reply is heard, not just read.
  // Optional: if no key is configured, still return the text so the practice
  // tool works in text-only mode.
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // "Rachel" — a default premade voice
  let audioBase64 = null;
  if (elevenKey) {
    try {
      const ttsResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'audio/mpeg',
          'xi-api-key': elevenKey,
        },
        body: JSON.stringify({
          text: replyText,
          model_id: 'eleven_turbo_v2',
          voice_settings: { stability: 0.4, similarity_boost: 0.75 },
        }),
      });
      if (ttsResp.ok) {
        const buf = Buffer.from(await ttsResp.arrayBuffer());
        audioBase64 = buf.toString('base64');
      } else {
        console.warn(`ElevenLabs TTS failed (${ttsResp.status})`);
      }
    } catch (e) {
      console.warn('Could not reach ElevenLabs: ' + (e?.message || 'network error'));
    }
  }

  return { replyText, audioBase64 };
});

// Feedback Box — turns a rough main idea into a clear, well-phrased request
// for feedback from a coworker, peer, or direct report.
exports.improveFeedbackMessage = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { note, category } = request.data || {};
  if (!(note || '').trim()) throw new HttpsError('invalid-argument', 'Write your main idea first');

  const systemPrompt = 'You are an expert in workplace communication and leadership development. Given a rough, unpolished idea for a request for feedback from a coworker, peer, or direct report, rewrite it as a clear, warm, specific, and professional message — 2-4 sentences. Keep the original intent and any specifics the person mentioned (what/when/topic). Make it easy for the recipient to know exactly what kind of feedback would help. Return ONLY the rewritten message — no preamble, no quotes, no markdown.';
  const userPrompt = `Feedback topic: ${category || 'General'}\nRough idea: ${note.trim()}`;

  const improved = await callClaude(systemPrompt, userPrompt, 250);
  return { improved };
});

// Feedback Box — Submit Feedback form. Polishes the Situation-Behavior-Impact
// fields (When / What / Effect) into clear, specific, behavior-based language,
// without inventing details the user didn't provide.
exports.improveFeedbackSBI = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { when, what, effect } = request.data || {};
  if (!(when || '').trim() && !(what || '').trim() && !(effect || '').trim()) {
    throw new HttpsError('invalid-argument', 'Fill in at least one field first');
  }

  const systemPrompt = 'You are an expert in giving effective, specific, behavior-based feedback (Situation-Behavior-Impact model). Given a leader\'s rough notes for the When/What/Effect fields of a piece of feedback, rewrite each field to be clearer, more specific, and more impactful — 1-2 sentences each. Do not invent new facts or details not implied by the input; only sharpen and clarify what was given. If a field is empty, leave it as an empty string in your output. Return ONLY a JSON object with exactly these keys: when, what, effect. No other text, no markdown.';
  const userPrompt = `When: ${(when || '').trim() || '(empty)'}\nWhat: ${(what || '').trim() || '(empty)'}\nEffect: ${(effect || '').trim() || '(empty)'}`;

  const text = await callClaude(systemPrompt, userPrompt, 400);
  const cleaned = stripCodeFence(text);
  let improved;
  try {
    improved = JSON.parse(cleaned);
  } catch {
    throw new HttpsError('internal', 'AI response could not be parsed — try again');
  }
  return {
    when: typeof improved?.when === 'string' ? improved.when.trim() : (when || ''),
    what: typeof improved?.what === 'string' ? improved.what.trim() : (what || ''),
    effect: typeof improved?.effect === 'string' ? improved.effect.trim() : (effect || ''),
  };
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
