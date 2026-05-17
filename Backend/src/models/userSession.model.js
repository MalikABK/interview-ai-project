const mongoose = require("mongoose");

const userSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    refreshTokenHash: String,
    ipAddress: String,
    userAgent: String,
    deviceFingerprint: String,
    createdAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// TTL Index
userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

userSessionSchema.statics.revokeSession = async function(userId, sessionId) {
    return this.updateOne({ userId, sessionId }, { isActive: false });
};

userSessionSchema.statics.revokeAllForUser = async function(userId) {
    return this.updateMany({ userId, isActive: true }, { isActive: false });
};

const UserSession = mongoose.models.UserSession || mongoose.model("UserSession", userSessionSchema);
module.exports = UserSession;
