const AuditLog = require('../infrastructure/models/auditLog.model')
const mongoose = require('mongoose')

class AuditLogService {
    /**
     * Log an event
     * @param {Object} eventData - Event details
     * @returns {Promise<Object>} - Created audit log
     */
    static async logEvent(eventData) {
        try {
            const {
                userId = null,
                username = null,
                email = null,
                action,
                resource,
                resourceId = null,
                details = {},
                ipAddress = null,
                userAgent = null,
                deviceFingerprint = null,
                location = null,
                riskLevel = 'low',
                status = 'success',
                statusCode = null,
                errorMessage = null,
                source = 'api',
                sessionId = null,
                correlationId = null,
                dataClassification = 'internal'
            } = eventData

            // Ensure required fields
            if (!action || !resource) {
                console.error('[AUDIT] Missing required fields:', { action, resource })
                return null
            }

            // Sanitize sensitive data from details
            const sanitizedDetails = this.sanitizeSensitiveData(details)

            // Build audit log document
            const auditLog = new AuditLog({
                userId,
                username,
                email,
                action,
                resource,
                resourceId,
                details: sanitizedDetails,
                ipAddress,
                userAgent,
                deviceFingerprint,
                location,
                riskLevel,
                status,
                statusCode,
                errorMessage,
                source,
                sessionId,
                correlationId,
                dataClassification,
                createdAt: new Date()
            })

            // Save to database
            const savedLog = await auditLog.save()

            // Log to console for immediate visibility (especially for critical events)
            if (riskLevel === 'critical' || riskLevel === 'high') {
                console.warn(`[AUDIT - ${riskLevel.toUpperCase()}] ${action} by ${username || userId || 'unknown'}`)
            }

            return savedLog
        } catch (error) {
            console.error('[AUDIT LOG ERROR]', error.message)
            return null
        }
    }

    /**
     * Log authentication event
     * @param {Object} authData
     * @returns {Promise<Object>}
     */
    static async logAuthEvent({
        userId,
        username,
        email,
        action, // 'login_success', 'login_failed', 'logout', etc.
        ipAddress,
        userAgent,
        deviceFingerprint,
        location,
        success = true,
        reason = null,
        sessionId = null
    }) {
        const riskLevel = (!success && action === 'login_failed') ? 'high' : 'low'
        
        return this.logEvent({
            userId,
            username,
            email,
            action,
            resource: 'authentication',
            details: {
                success,
                reason,
                attemptedEmail: email
            },
            ipAddress,
            userAgent,
            deviceFingerprint,
            location,
            riskLevel,
            status: success ? 'success' : 'failure',
            sessionId,
            source: 'web'
        })
    }

    /**
     * Log file operation
     * @param {Object} fileData
     * @returns {Promise<Object>}
     */
    static async logFileEvent({
        userId,
        username,
        action, // 'file_uploaded', 'file_deleted', etc.
        filename,
        fileSize,
        mimeType,
        fileHash,
        ipAddress,
        userAgent,
        status = 'success',
        reason = null
    }) {
        return this.logEvent({
            userId,
            username,
            action,
            resource: 'file',
            resourceId: fileHash,
            details: {
                filename,
                size: fileSize,
                mimeType,
                hash: fileHash,
                reason
            },
            ipAddress,
            userAgent,
            riskLevel: status === 'failure' ? 'high' : 'low',
            status: status === 'success' ? 'success' : 'failure'
        })
    }

    /**
     * Log security event (injections, suspicious activity, etc.)
     * @param {Object} securityData
     * @returns {Promise<Object>}
     */
    static async logSecurityEvent({
        userId,
        username,
        action,
        eventType = 'suspicious_activity',
        riskScore = 0.5,
        details = {},
        ipAddress,
        userAgent
    }) {
        // Determine risk level based on score
        let riskLevel = 'low'
        if (riskScore > 0.85) riskLevel = 'critical'
        else if (riskScore > 0.65) riskLevel = 'high'
        else if (riskScore > 0.40) riskLevel = 'medium'

        return this.logEvent({
            userId,
            username,
            action,
            resource: eventType === 'prompt' ? 'prompt' : 'authentication',
            details: {
                ...details,
                riskScore
            },
            ipAddress,
            userAgent,
            riskLevel,
            status: 'warning',
            dataClassification: 'confidential'
        })
    }

    /**
     * Query audit logs
     * @param {Object} filters
     * @param {Object} options - { limit, skip, sort }
     * @returns {Promise<Array>}
     */
    static async queryLogs(filters = {}, options = {}) {
        try {
            const {
                userId = null,
                action = null,
                resource = null,
                riskLevel = null,
                ipAddress = null,
                startDate = null,
                endDate = null,
                limit = 50,
                skip = 0,
                sort = { createdAt: -1 }
            } = { ...filters, ...options }

            const query = {}

            if (userId) query.userId = userId
            if (action) query.action = action
            if (resource) query.resource = resource
            if (riskLevel) query.riskLevel = riskLevel
            if (ipAddress) query.ipAddress = ipAddress

            if (startDate || endDate) {
                query.createdAt = {}
                if (startDate) query.createdAt.$gte = startDate
                if (endDate) query.createdAt.$lte = endDate
            }

            const logs = await AuditLog
                .find(query)
                .limit(limit)
                .skip(skip)
                .sort(sort)
                .lean()

            return logs
        } catch (error) {
            console.error('[AUDIT QUERY ERROR]', error.message)
            return []
        }
    }

    /**
     * Get audit summary for user
     * @param {String} userId
     * @param {Number} daysBack
     * @returns {Promise<Object>}
     */
    static async getUserSummary(userId, daysBack = 7) {
        try {
            const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

            const summary = await AuditLog.aggregate([
                {
                    $match: {
                        userId: new mongoose.Types.ObjectId(userId),
                        createdAt: { $gte: since }
                    }
                },
                {
                    $group: {
                        _id: '$action',
                        count: { $sum: 1 }
                    }
                }
            ])

            return summary
        } catch (error) {
            console.error('[AUDIT SUMMARY ERROR]', error.message)
            return []
        }
    }

    /**
     * Get security events summary
     * @param {Number} daysBack
     * @returns {Promise<Object>}
     */
    static async getSecuritySummary(daysBack = 7) {
        try {
            const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

            const summary = await AuditLog.aggregate([
                {
                    $match: {
                        riskLevel: { $in: ['high', 'critical'] },
                        createdAt: { $gte: since }
                    }
                },
                {
                    $group: {
                        _id: '$riskLevel',
                        count: { $sum: 1 }
                    }
                }
            ])

            return summary
        } catch (error) {
            console.error('[SECURITY SUMMARY ERROR]', error.message)
            return []
        }
    }

    /**
     * Sanitize sensitive data from audit logs
     * @param {Object} details
     * @returns {Object}
     */
    static sanitizeSensitiveData(details) {
        if (!details || typeof details !== 'object') return details

        const sanitized = { ...details }
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard']

        const sanitizeObject = (obj) => {
            for (const key in obj) {
                if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                    obj[key] = '[REDACTED]'
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitizeObject(obj[key])
                }
            }
        }

        sanitizeObject(sanitized)
        return sanitized
    }

    /**
     * Clean up old logs (called by scheduled task)
     * @param {Number} daysToKeep
     * @returns {Promise<Object>}
     */
    static async cleanupOldLogs(daysToKeep = 365) {
        try {
            const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)

            const result = await AuditLog.deleteMany({
                createdAt: { $lt: cutoffDate }
            })

            console.log(`[AUDIT] Cleaned up ${result.deletedCount} old logs`)
            return result
        } catch (error) {
            console.error('[AUDIT CLEANUP ERROR]', error.message)
            return { deletedCount: 0 }
        }
    }
}

module.exports = AuditLogService
