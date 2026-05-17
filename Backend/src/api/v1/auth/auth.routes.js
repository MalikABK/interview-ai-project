const { Router } = require('express')
const authController = require('./auth.controller')
const authMiddleware = require('../../../middlewares/auth.middleware')
const validate = require('../../../middlewares/validators/validate.middleware')
const { registerSchema, loginSchema } = require('../../../middlewares/validators/auth.validator')

const authRouter = Router()

authRouter.post('/register', validate(registerSchema), authController.registerUserController)
authRouter.post('/login', validate(loginSchema), authController.loginUserController)
authRouter.post('/logout', authMiddleware.authUser, authController.logoutUserController)
authRouter.get('/get-me', authMiddleware.authUser, authController.getMeController)

module.exports = authRouter
