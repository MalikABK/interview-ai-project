const { Router } = require('express')
const authRouter = require('./auth/auth.routes')
const interviewRouter = require('./interview/interview.routes')

const v1Router = Router()

v1Router.use('/auth', authRouter)
v1Router.use('/interview', interviewRouter)

module.exports = v1Router
