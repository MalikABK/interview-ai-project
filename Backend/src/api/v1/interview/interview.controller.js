const interviewService = require('../../../domain/interview/interview.service')
const asyncHandler = require('../../../shared/asyncHandler')
const { sendSuccess } = require('../../../shared/response')
const { HTTP_STATUS } = require('../../../shared/constants')
const { pdfQueue } = require('../../../queues/pdfQueue')

const generateReport = asyncHandler(async (req, res) => {
    const report = await interviewService.generateReport(req.user.id, req.file, req.body)
    sendSuccess(res, { 
        message: 'Interview report generated successfully.', 
        data: { interviewReport: report } 
    }, HTTP_STATUS.CREATED)
})

const getReportById = asyncHandler(async (req, res) => {
    const report = await interviewService.getReportById(req.params.interviewId, req.user.id)
    sendSuccess(res, { 
        message: 'Interview report fetched successfully.', 
        data: { interviewReport: report } 
    })
})

const getAllReports = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Number(req.query.limit) || 10)
    
    const result = await interviewService.getAllReports(req.user.id, page, limit)
    sendSuccess(res, { 
        message: 'Interview reports fetched successfully.', 
        ...result 
    })
})

const generateResumePdf = asyncHandler(async (req, res) => {
    // Note: In Phase 1 we moved this to a queue.
    // The service now returns the data needed for the job.
    const jobData = await interviewService.generateResumePdf(req.params.interviewReportId, req.user.id)
    
    const job = await pdfQueue.add('generate-pdf', jobData)
    
    sendSuccess(res, { 
        message: 'PDF generation started.', 
        data: { jobId: job.id } 
    }, HTTP_STATUS.ACCEPTED)
})

const getPdfStatus = asyncHandler(async (req, res) => {
    const { jobId } = req.params
    const job = await pdfQueue.getJob(jobId)
    
    if (!job) {
        const { AppError } = require('../../../utils/AppError')
        throw new AppError('Job not found.', HTTP_STATUS.NOT_FOUND, 'JOB_NOT_FOUND')
    }
    
    const status = await job.getState()
    sendSuccess(res, { 
        data: {
            jobId: job.id,
            status,
            progress: job.progress
        } 
    })
})

const downloadResumePdf = asyncHandler(async (req, res) => {
    const report = await interviewService.getReportById(req.params.interviewReportId, req.user.id)
    
    if (!report.resumePdf) {
        const AppError = require('../../../utils/AppError')
        throw new AppError('PDF not found or not yet generated.', HTTP_STATUS.NOT_FOUND, 'PDF_NOT_FOUND')
    }
    
    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${req.params.interviewReportId}.pdf`
    })
    
    res.send(report.resumePdf)
})

module.exports = { 
    generateReport, 
    getReportById, 
    getAllReports, 
    generateResumePdf, 
    getPdfStatus, 
    downloadResumePdf 
}
