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

    console.log('[Email] Đang dùng SMTP:', host, '| User:', user);
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
        console.error('[Email] Lỗi gửi:', errorMessage);
        if (err.response) console.error('[Email] Response:', err.response);
        return { success: false, error: errorMessage };
    }
}

/**
 * Gửi email mã đặt lại mật khẩu. Chỉ dùng SMTP từ .env.
 */
async function sendResetCodeEmail(toEmail, code) {
    const resetPageUrl =
        process.env.FRONTEND_URI || process.env.FRONTED_URI || 'http://localhost:4321';
    const resetPasswordUrl = `${resetPageUrl.replace(/\/$/, '')}/reset-password`;

    const subject = 'Mã xác nhận đặt lại mật khẩu - Orbit';
    const text = [
        'Bạn đã yêu cầu đặt lại mật khẩu.',
        `Mã xác nhận của bạn: ${code}.`,
        
    ].join('\n');

    const html = `
      <div style="font-family: sans-serif; max-width: 480px;">
        <p>Bạn đã yêu cầu đặt lại mật khẩu.</p>
        <p><strong>Mã xác nhận của bạn:</strong></p>
        <p style="font-size: 24px; letter-spacing: 6px; font-weight: bold; margin: 16px 0;">${code}</p>
      </div>
    `;

    const result = await sendEmail(toEmail, subject, { text, html });

    if (result.success) return;

    // Không có SMTP hoặc lỗi gửi: log và throw để API trả lỗi rõ ràng
    console.log('--- Email không gửi được ---');
    console.log('To:', toEmail);
    console.log('Mã xác nhận:', code);
    console.log('Lỗi:', result.error);
    console.log('--------------------------------');
    throw new Error(result.error || 'Không gửi được email. Kiểm tra SMTP trong .env (Gmail cần App Password).');
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

module.exports = { sendEmail, sendResetCodeEmail, sendWelcomeEmail, getTransporter };
