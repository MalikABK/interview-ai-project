const { Router } = require('express')
const authController = require('./auth.controller')
const authMiddleware = require('../../../middlewares/auth.middleware')
const validate = require('../../../middlewares/validators/validate.middleware')
const { registerSchema, loginSchema } = require('../../../middlewares/validators/auth.validator')

const authRouter = Router()

authRouter.post('/register', validate(registerSchema), authController.register)
authRouter.post('/login', validate(loginSchema), authController.login)
authRouter.post('/logout', authMiddleware.authUser, authController.logout)
authRouter.get('/get-me', authMiddleware.authUser, authController.getMe)

module.exports = authRouter
