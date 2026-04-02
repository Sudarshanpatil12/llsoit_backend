const axios = require('axios');

const isEmailConfigured = () => {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
};

const sendMail = async ({ to, subject, html, text }) => {
  if (!isEmailConfigured()) {
    console.warn('Email skipped: RESEND_API_KEY or MAIL_FROM is not configured.');
    return { sent: false, reason: 'email_not_configured' };
  }

  await axios.post(
    'https://api.resend.com/emails',
    {
      from: process.env.MAIL_FROM,
      to: [to],
      subject,
      html,
      text
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    }
  );

  return { sent: true };
};

const sendApprovalEmail = async (alumni) => {
  const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/alumni-portal`;
  const subject = 'Your SOIT Alumni account has been approved';
  const text = `Hello ${alumni.name}, your SOIT Alumni account has been approved. You can now sign in at ${portalUrl} using your enrollment number and password.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="color: #0a4a7a;">SOIT Alumni Approval</h2>
      <p>Hello ${alumni.name},</p>
      <p>Your alumni registration has been approved. You can now sign in to the alumni portal using your enrollment number and password.</p>
      <p>
        <a href="${portalUrl}" style="display: inline-block; background: #0a4a7a; color: #ffffff; padding: 10px 16px; border-radius: 6px; text-decoration: none;">
          Open Alumni Portal
        </a>
      </p>
      <p>If you did not request this account, please contact the administrator.</p>
    </div>
  `;

  return sendMail({ to: alumni.email, subject, html, text });
};

module.exports = {
  isEmailConfigured,
  sendApprovalEmail
};
