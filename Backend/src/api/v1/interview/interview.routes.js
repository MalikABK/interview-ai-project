const { Router } = require('express')
const interviewController = require('./interview.controller')
const authMiddleware = require('../../../middlewares/auth.middleware')
const upload = require('../../../middlewares/file.middleware')
const validate = require('../../../middlewares/validators/validate.middleware')
const { generateReportSchema, mongoIdSchema, interviewReportIdSchema, jobIdSchema } = require('../../../middlewares/validators/interview.validator')

const interviewRouter = Router()

interviewRouter.post('/', 
    authMiddleware.authUser, 
    upload.single('resume'), 
    validate(generateReportSchema), 
    interviewController.generateReport
)

interviewRouter.get('/report/:interviewId', 
    authMiddleware.authUser, 
    validate(mongoIdSchema), 
    interviewController.getReportById
)

interviewRouter.get('/', 
    authMiddleware.authUser, 
    interviewController.getAllReports
)

interviewRouter.post('/resume/pdf/:interviewReportId', 
    authMiddleware.authUser, 
    validate(interviewReportIdSchema), 
    interviewController.generateResumePdf
)

interviewRouter.get('/resume/status/:jobId', 
    authMiddleware.authUser, 
    validate(jobIdSchema), 
    interviewController.getPdfStatus
)

interviewRouter.get('/resume/download/:interviewReportId', 
    authMiddleware.authUser, 
    validate(interviewReportIdSchema), 
    interviewController.downloadResumePdf
)

module.exports = interviewRouter
