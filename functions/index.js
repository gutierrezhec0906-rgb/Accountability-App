const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const nodemailer = require('nodemailer');

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

exports.sendWelcomeEmail = onDocumentCreated('users/{uid}', async (event) => {
  const data = event.data?.data();
  if (!data || !data.email) return;

  const { email, displayName, role, status } = data;
  const isFirst = status === 'approved';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e3a6e; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Leadership Flow Technologies</h1>
        <p style="color: #93c5fd; margin: 8px 0 0;">Accountability App</p>
      </div>
      <div style="padding: 32px; background: #f8fafc;">
        <h2 style="color: #1e3a6e;">Welcome, ${displayName}!</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Your account has been created successfully as a <strong>${role}</strong>.
        </p>
        ${isFirst
          ? `<p style="color: #475569; font-size: 16px; line-height: 1.6;">
               You are the first user and have been granted <strong>full admin access</strong> automatically.
             </p>`
          : `<p style="color: #475569; font-size: 16px; line-height: 1.6;">
               Your account is currently <strong>pending approval</strong>. An administrator will review and activate your account shortly.
             </p>`
        }
        <div style="margin: 32px 0; text-align: center;">
          <a href="https://www.accountability-app.com"
             style="background: #1e3a6e; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
            Go to App
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 14px;">
          If you have any questions, reply to this email and we'll be happy to help.
        </p>
      </div>
      <div style="background: #1e3a6e; padding: 16px; text-align: center;">
        <p style="color: #93c5fd; font-size: 12px; margin: 0;">
          © 2026 Leadership Flow Technologies. All rights reserved.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Leadership Flow Technologies" <${process.env.ZOHO_EMAIL}>`,
    to: email,
    subject: 'Welcome to the Accountability App',
    html,
  });

  console.log(`Welcome email sent to ${email}`);
});
