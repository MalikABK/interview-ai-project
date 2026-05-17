const userModel = require("../infrastructure/models/user.model");
const loginAttemptModel = require("../models/loginAttempt.model");
const auditLog = require("./auditLog.service");

class AccountLockoutService {
    static getConfig() {
        return {
            maxAttempts: parseInt(process.env.LOCKOUT_ATTEMPTS) || 5,
            lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 30, // minutes
        };
    }

    static async recordFailedAttempt(email, context = {}) {
        try {
            const user = await userModel.findByEmail(email);
            if (!user) return null;

            await loginAttemptModel.create({
                userId: user._id,
                email,
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                success: false,
                reason: 'invalid_credentials'
            });

            const recentFailed = await loginAttemptModel.countRecentFailed(email);
            const config = this.getConfig();

            if (recentFailed >= config.maxAttempts) {
                const lockUntil = await user.lockAccount(config.lockoutDuration);

                await auditLog.logEvent({
                    userId: user._id,
                    username: user.username,
                    email,
                    action: 'account_locked',
                    resource: 'authentication',
                    details: { attempts: recentFailed, lockDuration: config.lockoutDuration },
                    ipAddress: context.ipAddress,
                    userAgent: context.userAgent,
                    riskLevel: 'high'
                });

                return { locked: true, lockUntil };
            }

            return { locked: false, attemptsRemaining: config.maxAttempts - recentFailed };
        } catch (error) {
            console.error('[LOCKOUT RECORD ERROR]', error);
            return null;
        }
    }

    static async checkAccountStatus(email) {
        try {
            const user = await userModel.findByEmail(email);
            if (!user) return { exists: false };

            if (user.isAccountLocked()) {
                const minutesRemaining = Math.ceil((user.lockUntil - new Date()) / 60000);
                return { locked: true, lockUntil: user.lockUntil, minutesRemaining };
            }
            return { locked: false };
        } catch (error) {
            console.error('[LOCKOUT STATUS ERROR]', error);
            return { error: true };
        }
    }

    static async resetOnSuccessfulLogin(email) {
        try {
            const user = await userModel.findByEmail(email);
            if (user) await user.resetFailedLoginAttempts();
        } catch (error) {
            console.error('[LOCKOUT RESET ERROR]', error);
        }
    }
}

module.exports = AccountLockoutService;
