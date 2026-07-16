const { onDocumentCreated } = require('firebase-functions/v2/firestore');
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
