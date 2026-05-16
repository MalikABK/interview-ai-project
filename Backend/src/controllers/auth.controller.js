const userModel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/blacklist.model")
const asyncHandler = require("../utils/asyncHandler")
const AppError = require("../utils/AppError")

/**
 * @name registerUserController
 * @description register a new user, expects username, email and password in the request body
 * @access Public
 */
const registerUserController = asyncHandler(async (req, res, next) => {

    const { username, email, password } = req.body

    if (!username || !email || !password) {
        throw new AppError("Please provide username, email and password", 400, "MISSING_FIELDS")
    }

    const isUserAlreadyExists = await userModel.findOne({
        $or: [ { username }, { email } ]
    })

    if (isUserAlreadyExists) {
        throw new AppError("Account already exists with this email address or username", 400, "USER_EXISTS")
    }

    const hash = await bcrypt.hash(password, 10)

    const user = await userModel.create({
        username,
        email,
        password: hash
    })

    res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        }
    })
})


/**
 * @name loginUserController
 * @description login a user, expects email and password in the request body
 * @access Public
 */
const loginUserController = asyncHandler(async (req, res, next) => {

    const { email, password } = req.body

    const user = await userModel.findOne({ email })

    if (!user) {
        throw new AppError("Invalid email or password", 400, "INVALID_CREDENTIALS")
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
        throw new AppError("Invalid email or password", 400, "INVALID_CREDENTIALS")
    }

    const token = jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    };

    res.cookie("token", token, cookieOptions)
    res.status(200).json({
        success: true,
        message: "User loggedIn successfully.",
        data: {
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        }
    })
})


/**
 * @name logoutUserController
 * @description clear token from user cookie and add the token in blacklist
 * @access public
 */
const logoutUserController = asyncHandler(async (req, res, next) => {
    const token = req.cookies.token

    if (token) {
        await tokenBlacklistModel.create({ token })
    }

    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    })

    res.status(200).json({
        success: true,
        message: "User logged out successfully"
    })
})

/**
 * @name getMeController
 * @description get the current logged in user details.
 * @access private
 */
const getMeController = asyncHandler(async (req, res, next) => {

    const user = await userModel.findById(req.user.id)

    if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND")
    }

    res.status(200).json({
        success: true,
        message: "User details fetched successfully",
        data: {
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        }
    })

})



module.exports = {
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController
}