const mongoose = require("mongoose");

const loginAttemptSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', index: true },
    email: { type: String, required: true, index: true },
    ipAddress: String,
    userAgent: String,
    success: { type: Boolean, default: false },
    reason: String,
    createdAt: { type: Date, default: Date.now, expires: '30d' } // TTL
});

loginAttemptSchema.statics.countRecentFailed = async function(email) {
    const since = new Date(Date.now() - 15 * 60 * 1000); // 15 min window
    return this.countDocuments({
        email,
        success: false,
        createdAt: { $gte: since }
    });
};

const LoginAttempt = mongoose.models.LoginAttempt || mongoose.model("LoginAttempt", loginAttemptSchema);
module.exports = LoginAttempt;
