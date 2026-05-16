const resumeParser = require('./resume-parser.service')
const aiService = require('../services/ai.service')
const interviewRepo = require('../../infrastructure/repositories/interview.repository')
const { ERROR_MESSAGES, AI, HTTP_STATUS } = require('../../shared/constants')
const AppError = require('../../utils/AppError')

class InterviewService {
    async generateReport(userId, file, { selfDescription, jobDescription }) {
        // 1. Parse resume
        const resumeText = await resumeParser.extractText(file)
        if (!resumeText?.trim()) {
            throw new AppError(ERROR_MESSAGES.EMPTY_RESUME, HTTP_STATUS.BAD_REQUEST, 'EMPTY_RESUME')
        }

        // 2. Prompt injection guard — truncate inputs
        const safeResume = resumeText.slice(0, AI.MAX_RESUME_CHARS)
        const safeSelfDesc = selfDescription.slice(0, AI.MAX_SELF_DESC_CHARS)
        const safeJobDesc = jobDescription.slice(0, AI.MAX_JOB_DESC_CHARS)

        // 3. Generate AI report
        const aiResult = await aiService.generateInterviewReport({
            resume: safeResume,
            selfDescription: safeSelfDesc,
            jobDescription: safeJobDesc
        })

        // 4. Persist and return
        return interviewRepo.create({
            user: userId,
            resume: resumeText,
            selfDescription,
            jobDescription,
            ...aiResult
        })
    }

    async getReportById(id, userId) {
        const report = await interviewRepo.findByIdAndUser(id, userId)
        if (!report) {
            throw new AppError(ERROR_MESSAGES.NOT_FOUND('Interview report'), HTTP_STATUS.NOT_FOUND, 'REPORT_NOT_FOUND')
        }
        return report
    }

    async getAllReports(userId, page, limit) {
        return interviewRepo.findAllByUser(userId, page, limit)
    }

    async generateResumePdf(reportId, userId) {
        const report = await this.getReportById(reportId, userId)
        const { resume, jobDescription, selfDescription } = report
        
        // This is synchronous in the old service, but we use BullMQ for the real async path.
        // The roadmap suggests this method for the direct generator (which we refactored to async queue in Phase 1).
        // Let's keep it aligned with the direct generator logic but returning a job ID or handled by the queue.
        // Actually, Phase 1 moved PDF generation to a queue. The controller adds to queue.
        // Let's adapt this to the current architecture.
        return { resume, jobDescription, selfDescription, interviewReportId: report._id }
    }
}

module.exports = new InterviewService()
