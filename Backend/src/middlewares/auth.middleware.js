const jwt = require("jsonwebtoken")
const userRepo = require("../infrastructure/repositories/user.repository")
const blacklistRepo = require("../infrastructure/repositories/blacklist.repository")
const asyncHandler = require("../shared/asyncHandler")
const AppError = require("../utils/AppError")
const { HTTP_STATUS, ERROR_MESSAGES } = require("../shared/constants")

const authUser = asyncHandler(async (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

    if (!token) {
        throw new AppError(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, 'NO_TOKEN')
    }

    const isBlacklisted = await blacklistRepo.isBlacklisted(token)
    if (isBlacklisted) {
        throw new AppError(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, 'TOKEN_BLACKLISTED')
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await userRepo.findById(decoded.id)

        if (!user) {
            throw new AppError(ERROR_MESSAGES.NOT_FOUND('User'), HTTP_STATUS.UNAUTHORIZED, 'USER_NOT_FOUND')
        }

        req.user = user
        next()
    } catch (err) {
        throw new AppError(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, 'INVALID_TOKEN')
    }
})

module.exports = { authUser }
