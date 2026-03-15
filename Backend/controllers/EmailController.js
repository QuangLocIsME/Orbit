const emailService = require('../services/emailService');

/**
 * POST /api/send-email
 * Body: { to, subject, message }
 * message: string (text + html) hoặc { text?, html? }
 */
async function sendEmail(req, res) {
    try {
        const { to, subject, message } = req.body || {};

        if (!to || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: to, subject',
            });
        }

        if (message == null) {
            return res.status(400).json({
                success: false,
                message: 'Missing required field: message (string or { text?, html? })',
            });
        }

        const result = await emailService.sendEmail(to, subject, message);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send email',
                error: result.error,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            data: { messageId: result.messageId },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Send email error',
            error: error.message || String(error),
        });
    }
}

module.exports = { sendEmail };
