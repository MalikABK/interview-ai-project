const authService = require('../../../domain/auth/auth.service')
const asyncHandler = require('../../../shared/asyncHandler')
const { sendSuccess } = require('../../../shared/response')
const { HTTP_STATUS } = require('../../../shared/constants')

const register = asyncHandler(async (req, res) => {
    const user = await authService.register(req.body)
    sendSuccess(res, { 
        message: 'User registered successfully', 
        data: { user } 
    }, HTTP_STATUS.CREATED)
})

const login = asyncHandler(async (req, res) => {
    const { token, user } = await authService.login(req.body)
    
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    };

    res.cookie("token", token, cookieOptions)
    
    sendSuccess(res, { 
        message: 'User logged in successfully', 
        data: { user } 
    })
})

const logout = asyncHandler(async (req, res) => {
    await authService.logout(req.cookies.token)
    
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    })
    
    sendSuccess(res, { message: 'User logged out successfully' })
})

const getMe = asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user.id)
    sendSuccess(res, { 
        message: 'User details fetched successfully', 
        data: { user } 
    })
})

module.exports = { register, login, logout, getMe }
