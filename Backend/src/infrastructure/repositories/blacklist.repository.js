const BlacklistToken = require('../models/blacklist.model')

class BlacklistRepository {
    async add(token, expiresAt) {
        // Blacklist model uses 'expires' property on createdAt, but roadmap suggested manual expiresAt.
        // Let's stick to the roadmap's suggestion for a dedicated repository method.
        return BlacklistToken.create({ token, createdAt: expiresAt ? undefined : new Date() })
        // Note: The existing model has `expires: 86400` on `createdAt`.
    }

    async isBlacklisted(token) {
        const doc = await BlacklistToken.findOne({ token }).lean()
        return !!doc
    }
}

module.exports = new BlacklistRepository()
