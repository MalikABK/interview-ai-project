const nodemailer = require('nodemailer');

/**
 * Gmail/SMTP Configuration
 * Note: Use an App Password if using Gmail (not your regular account password)
 */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

class EmailService {
    static async sendVerificationEmail(email, token) {
        const verificationUrl = `${process.env.APP_URL}/api/v1/auth/verify-email?token=${token}`;
        
        await transporter.sendMail({
            from: `"Interview AI Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify your Interview AI account',
            html: `
                <h1>Welcome to Interview AI!</h1>
                <p>Please verify your account by clicking the link below:</p>
                <a href="${verificationUrl}">Verify Account</a>
                <p>This link expires in 24 hours.</p>
            `
        });
    }

    static async sendLockoutNotification(email) {
        await transporter.sendMail({
            from: `"Interview AI Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Security Alert: Account Locked',
            text: 'Your account has been locked due to multiple failed login attempts. Please contact support or wait 30 minutes to try again.'
        });
    }
}

module.exports = EmailService;
