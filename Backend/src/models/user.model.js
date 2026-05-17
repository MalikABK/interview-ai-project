// src/models/user.model.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true, trim: true, minlength: 3 },
    email: { type: String, unique: true, required: true, lowercase: true },
    password: { type: String, required: true, select: false },

    accountStatus: { type: String, enum: ['active', 'locked', 'suspended'], default: 'active' },
    isEmailVerified: { type: Boolean, default: false },

    // Lockout fields
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    lastFailedLogin: Date,

    // Core tracking
    lastLogin: Date,
    lastLoginIp: String,
    lastLoginUserAgent: String,

    passwordChangedAt: Date,

    // MFA & Security
    twoFactorEnabled: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ lockUntil: 1 });
userSchema.index({ accountStatus: 1 });

// Methods
userSchema.methods.isAccountLocked = function() {
    return this.lockUntil && this.lockUntil > new Date();
};

userSchema.methods.lockAccount = async function(durationMinutes = 30) {
    this.lockUntil = new Date(Date.now() + durationMinutes * 60000);
    this.accountStatus = 'locked';
    this.loginAttempts = 0;
    await this.save();
    return this.lockUntil;
};

userSchema.methods.resetFailedLoginAttempts = async function() {
    this.loginAttempts = 0;
    this.lockUntil = null;
    this.accountStatus = 'active';
    await this.save();
};

userSchema.methods.incFailedLoginAttempts = async function(options = {}) {
    this.loginAttempts = (this.loginAttempts || 0) + 1;
    this.lastFailedLogin = new Date();
    await this.save();
    return this.loginAttempts;
};

userSchema.methods.recordSuccessfulLogin = async function(options = {}) {
    await this.resetFailedLoginAttempts();
    this.lastLogin = new Date();
    this.lastLoginIp = options.ipAddress;
    this.lastLoginUserAgent = options.userAgent;
    await this.save();
};

userSchema.methods.createSession = async function(sessionData) {
    const UserSession = require('./userSession.model');
    return UserSession.create({
        userId: this._id,
        ...sessionData
    });
};

userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

const User = mongoose.models.users || mongoose.model("users", userSchema);
module.exports = User;
