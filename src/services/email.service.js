const { Resend } = require('resend');

/**
 * Creates a singleton Resend client using the API key
 * from environment variables.
 */
let resend = null;

const getResendClient = () => {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

/**
 * Sends a 6-digit OTP to the admin email address using Resend.
 *
 * @param {string} otp          - The plain-text OTP to send
 * @param {number} expiryMins   - How many minutes until OTP expires (for display)
 * @returns {Promise<void>}
 */
const sendOtpEmail = async (otp, expiryMins = 10) => {
  const client = getResendClient();
  const recipient = process.env.ADMIN_EMAIL;

  const { error } = await client.emails.send({
    from: 'Cricket Admin System <onboarding@resend.dev>',
    to: [recipient],
    subject: 'Your Admin Login OTP',
    text: `Your one-time password is: ${otp}\n\nThis OTP expires in ${expiryMins} minutes.\n\nIf you did not request this, please ignore.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a73e8;">Cricket Management - Admin Login</h2>
        <p>Your one-time password is:</p>
        <div style="font-size: 2rem; font-weight: bold; letter-spacing: 0.3rem;
                    background: #f4f6f8; padding: 16px 24px; border-radius: 8px;
                    display: inline-block; color: #202124;">
          ${otp}
        </div>
        <p style="color: #5f6368; margin-top: 16px;">
          This OTP expires in <strong>${expiryMins} minutes</strong>.
        </p>
        <p style="color: #5f6368;">If you did not request this login, please ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error('[Resend] Failed to send OTP email:', error);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

module.exports = { sendOtpEmail };
