const nodemailer = require('nodemailer');

/**
 * Creates a reusable Nodemailer transporter using SMTP credentials
 * from environment variables. The transporter is created once and
 * reused across all email calls (singleton pattern).
 */
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // true for port 465, false for others
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

/**
 * Sends a 6-digit OTP to the admin email address.
 *
 * @param {string} otp          - The plain-text OTP to send
 * @param {number} expiryMins   - How many minutes until OTP expires (for display)
 * @returns {Promise<void>}
 */
const sendOtpEmail = async (otp, expiryMins = 10) => {
  const transport = getTransporter();
  const recipient = process.env.ADMIN_EMAIL;

  const mailOptions = {
    from: `"Cricket Admin System" <${process.env.SMTP_USER}>`,
    to: recipient,
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
  };

  await transport.sendMail(mailOptions);
};

module.exports = { sendOtpEmail };
