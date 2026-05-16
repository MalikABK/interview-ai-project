const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const userRepo = require('../../infrastructure/repositories/user.repository')
const blacklistRepo = require('../../infrastructure/repositories/blacklist.repository')
const { JWT_SECRET } = require('../../config/env')
const AppError = require('../../utils/AppError')
const { HTTP_STATUS, ERROR_MESSAGES } = require('../../shared/constants')

class AuthService {
    async register({ username, email, password }) {
        const existing = await userRepo.findByEmailOrUsername(email, username)
        if (existing) {
            throw new AppError(ERROR_MESSAGES.USER_EXISTS, HTTP_STATUS.BAD_REQUEST, 'USER_EXISTS')
        }
        
        const hash = await bcrypt.hash(password, 10)
        const user = await userRepo.create({ username, email, password: hash })
        
        return { id: user._id, username: user.username, email: user.email }
    }

    async login({ email, password }) {
        const user = await userRepo.findByEmail(email)
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.BAD_REQUEST, 'INVALID_CREDENTIALS')
        }
        
        const token = jwt.sign(
            { id: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '1d' }
        )
        
        return {
            token,
            user: { id: user._id, username: user.username, email: user.email }
        }
    }

    async logout(token) {
        if (token) {
            // The existing model handles expiry automatically via createdAt index
            await blacklistRepo.add(token)
        }
    }

    async getMe(userId) {
        const user = await userRepo.findById(userId)
        if (!user) {
            throw new AppError(ERROR_MESSAGES.NOT_FOUND('User'), HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND')
        }
        
        return { id: user._id, username: user.username, email: user.email }
    }
}

module.exports = new AuthService()
