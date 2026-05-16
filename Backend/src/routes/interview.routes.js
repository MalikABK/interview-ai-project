const express = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
const interviewController = require("../controllers/interview.controller")
const upload = require("../middlewares/file.middleware")

const interviewRouter = express.Router()



/**
 * @route POST /api/interview/
 * @description generate new interview report on the basis of user self description,resume pdf and job description.
 * @access private
 */
interviewRouter.post("/", authMiddleware.authUser, upload.single("resume"), interviewController.generateInterViewReportController)

/**
 * @route GET /api/interview/report/:interviewId
 * @description get interview report by interviewId.
 * @access private
 */
interviewRouter.get("/report/:interviewId", authMiddleware.authUser, interviewController.getInterviewReportByIdController)


/**
 * @route GET /api/interview/
 * @description get all interview reports of logged in user.
 * @access private
 */
interviewRouter.get("/", authMiddleware.authUser, interviewController.getAllInterviewReportsController)


/**
 * @route POST /api/interview/resume/pdf/:interviewReportId
 * @description Start asynchronous resume PDF generation.
 * @access private
 */
interviewRouter.post("/resume/pdf/:interviewReportId", authMiddleware.authUser, interviewController.generateResumePdfController)

/**
 * @route GET /api/interview/resume/status/:jobId
 * @description Check the status of a PDF generation job.
 * @access private
 */
interviewRouter.get("/resume/status/:jobId", authMiddleware.authUser, interviewController.getPdfStatusController)

/**
 * @route GET /api/interview/resume/download/:interviewReportId
 * @description Download the generated resume PDF.
 * @access private
 */
interviewRouter.get("/resume/download/:interviewReportId", authMiddleware.authUser, interviewController.downloadResumePdfController)



module.exports = interviewRouter