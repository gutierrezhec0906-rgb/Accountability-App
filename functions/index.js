const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
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
