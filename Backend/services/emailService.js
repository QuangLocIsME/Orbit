/**
 * Email service với Nodemailer.
 * Chỉ dùng SMTP cấu hình trong .env (SMTP_USER, SMTP_PASS, ...). Không dùng Ethereal.
 */
const nodemailer = require('nodemailer');

/**
 * Transporter từ .env (Gmail SMTP hoặc SMTP khác).
 * @returns {nodemailer.Transporter|null}
 */
function getTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASS || '').trim();

    if (!user || !pass) {
        console.warn('[Email] SMTP chưa cấu hình: SMTP_USER hoặc SMTP_PASS trống trong .env');
        return null;
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log('[Email] Đang dùng SMTP:', host, '| User:', user);
    }
    return nodemailer.createTransport({
        host,
        port,
        secure: false,
        auth: { user, pass },
    });
}

/**
 * Gửi email (plain text + HTML). Chỉ dùng SMTP từ .env.
 */
async function sendEmail(to, subject, message) {
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@orbit.com';

    let text = '';
    let html = '';

    if (typeof message === 'string') {
        text = message;
        html = message.replace(/\n/g, '<br>');
    } else if (message && typeof message === 'object') {
        text = message.text ?? '';
        html = message.html ?? message.text ?? '';
    } else {
        return { success: false, error: 'Invalid message: must be string or { text?, html? }' };
    }

    if (!to || !subject) {
        return { success: false, error: 'Missing required: to, subject' };
    }

    const transporter = getTransporter();
    if (!transporter) {
        return {
            success: false,
            error: 'SMTP chưa cấu hình. Thêm SMTP_USER và SMTP_PASS vào file .env.',
        };
    }

    try {
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            text: text || undefined,
            html: html || undefined,
        });
        return { success: true, messageId: info.messageId };
    } catch (err) {
        const errorMessage = err.message || String(err);
        console.error('[Email] Lỗi gửi.');
        return { success: false, error: errorMessage };
    }
}

/**
 * Gửi email mã đặt lại mật khẩu kèm link reset trong HTML.
 * Link dẫn tới frontend /reset-password?token=xxx (dùng secure token, không dùng 6-digit code)
 */
async function sendResetCodeEmail(toEmail, resetToken) {
    const resetPageUrl =
        process.env.FRONTEND_URI || process.env.FRONTED_URI || 'http://localhost:4321';
    const baseUrl = resetPageUrl.replace(/\/$/, '');
    const emailParam = Buffer.from(toEmail).toString('base64');
    const resetPasswordUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${emailParam}`;

    const subject = 'Reset your ORBIT password';
    const text = [
        'You requested a password reset for your ORBIT account.',
        '',
        `Click the button below to reset your password:`,
        resetPasswordUrl,
        '',
        'This link expires in 15 minutes.',
        'If you did not request this, you can safely ignore this email.',
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your ORBIT password</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid #E5E7EB;">
              <p style="margin:0 0 16px;">
                <svg width="48" height="48" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="22" cy="22" r="16" stroke="#1F4CB1" stroke-width="5" fill="none"/>
                  <path d="M24.5 13C30.5 15.5 33 18.5 32 20.5C31 22.5 26 23 20 25.5C14 28 10.5 31 11.5 33C12.5 35 17.5 34.5 24.5 30.5" stroke="#1F4CB1" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                </svg>
              </p>
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#111827;">Reset your password</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#6B7280;line-height:1.5;">
                You requested a password reset for your ORBIT account.
              </p>
            </td>
          </tr>

          <!-- Button -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <a href="${resetPasswordUrl}"
                 style="display:block;text-align:center;background:#2563EB;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 24px;border-radius:8px;">
                Reset Password
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;text-align:center;">
                This link expires in <strong>15 minutes</strong>.<br>
                If you did not request a password reset, ignore this email.
              </p>
            </td>
          </tr>

        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">
          &copy; ${new Date().getFullYear()} ORBIT. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const result = await sendEmail(toEmail, subject, { text, html });

    if (result.success) return;

    console.log('--- Email khong gui duoc ---');
    console.log('Loi:', result.error);
    console.log('--------------------------------');
    throw new Error(result.error || 'Khong gui duoc email. Kiem tra SMTP trong .env (Gmail can App Password).');
}

/**
 * Gửi email chào mừng khi tạo tài khoản bằng Google.
 */
async function sendWelcomeEmail(toEmail, userName) {
    const subject = 'Your Account Has Been Successfully Created';
    const text = [
        `Hello ${userName || 'User'},`,
        '',
        'Your account has been successfully created using your Google account.',
        '',
        'You can now access the system using Google Sign-In without needing a password.',
        '',
        'If you did not authorize this action, please contact support immediately.',
        '',
        'Best regards,',
        'System Administration',
    ].join('\n');
    const html = `
      <div style="font-family: sans-serif; max-width: 560px;">
        <p>Hello ${(userName || 'User').replace(/</g, '&lt;')},</p>
        <p>Your account has been successfully created using your Google account.</p>
        <p>You can now access the system using Google Sign-In without needing a password.</p>
        <p>If you did not authorize this action, please contact support immediately.</p>
        <p>Best regards,<br/>System Administration</p>
      </div>
    `;
    const result = await sendEmail(toEmail, subject, { text, html });
    if (!result.success) {
        console.error('[Email] Welcome email failed:', result.error);
    }
    return result;
}

async function sendInviteEmail({ toEmail, inviterName, projectName, role, acceptUrl }) {
    const subject = `You've been invited to join ${projectName} on ORBIT`;
    const text = [
        `${inviterName} has invited you to join "${projectName}" as ${role}.`,
        `Click the link below to accept your invitation:`,
        acceptUrl,
        '',
        'This invite expires in 7 days.',
    ].join('\n\n');
    const html = `<div style="font-family: sans-serif; max-width: 560px;">
  <p>${inviterName} has invited you to join <strong>${projectName}</strong> on ORBIT.</p>
  <p>You have been invited as <strong>${role}</strong>.</p>
  <p><a href="${acceptUrl}" style="display:inline-block;background:#155DFC;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Accept Invitation →</a></p>
  <p style="color:#6B7280;font-size:13px;margin-top:16px;">This invitation expires in 7 days. If you did not expect this, you can safely ignore this email.</p>
</div>`;
    return sendEmail(toEmail, subject, { text, html });
}

async function sendAccountLockedEmail(toEmail, userName, lockUntil) {
    const subject = '⚠️ Security Alert: Your ORBIT Account Has Been Temporarily Locked';
    const lockTime = lockUntil instanceof Date ? lockUntil.toLocaleString() : '15 minutes from now';
    const text = [
        `Hello ${userName || 'User'},`,
        '',
        'Your ORBIT account has been temporarily locked due to multiple failed login attempts.',
        '',
        `Your account will be unlocked at: ${lockTime}`,
        '',
        'If this was you:',
        '- Please wait until the lockout period expires',
        '- Then try logging in with the correct credentials',
        '',
        'If this was NOT you:',
        '- Someone may be trying to access your account',
        '- Consider enabling Two-Factor Authentication for extra security',
        '- Contact support if you need further assistance',
        '',
        'Best regards,',
        'ORBIT Security Team',
    ].join('\n');
    const html = `<div style="font-family: sans-serif; max-width: 560px;">
  <h2 style="color:#DC2626;">🔒 Account Temporarily Locked</h2>
  <p>Hello <strong>${userName || 'User'}</strong>,</p>
  <p>Your ORBIT account has been temporarily locked due to multiple failed login attempts.</p>
  <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 16px;margin:16px 0;border-radius:4px;">
    <strong>🔓 Account will be unlocked:</strong> ${lockTime}
  </div>
  <p><strong>If this was you:</strong> Please wait until the lockout period expires, then try logging in with the correct credentials.</p>
  <p><strong>If this was NOT you:</strong> Someone may be attempting to access your account. We recommend enabling Two-Factor Authentication and contacting support if needed.</p>
  <p style="color:#6B7280;font-size:13px;margin-top:16px;">If you did not attempt to log in, please secure your account immediately.</p>
  <p>Best regards,<br><strong>ORBIT Security Team</strong></p>
</div>`;
    return sendEmail(toEmail, subject, { text, html });
}

module.exports = { sendEmail, sendResetCodeEmail, sendWelcomeEmail, sendInviteEmail, sendAccountLockedEmail, getTransporter };
