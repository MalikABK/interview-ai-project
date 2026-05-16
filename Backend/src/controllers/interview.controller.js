const pdfParse = require("pdf-parse")
const mammoth = require("mammoth")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")
const { pdfQueue } = require("../queues/pdfQueue")
const asyncHandler = require("../utils/asyncHandler")
const AppError = require("../utils/AppError")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
const generateInterViewReportController = asyncHandler(async (req, res, next) => {

    let resumeText = ""

    if (!req.file) {
        throw new AppError("Please upload a resume", 400, "MISSING_FILE")
    }

    if (req.file.mimetype === "application/pdf") {
        console.log("Processing PDF...")
        const parser = new pdfParse.PDFParse({ data: req.file.buffer })
        const result = await parser.getText()
        resumeText = result.text
        await parser.destroy()
    } else if (req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        console.log("Processing DOCX...")
        const docxData = await mammoth.extractRawText({ buffer: req.file.buffer })
        resumeText = docxData.value
    } else {
        throw new AppError("Unsupported file type. Please upload a PDF or DOCX file.", 400, "INVALID_FILE_TYPE")
    }

    if (!resumeText || resumeText.trim().length === 0) {
        throw new AppError("Could not extract text from the uploaded document.", 400, "EXTRACT_ERROR")
    }

    const { selfDescription, jobDescription } = req.body
    console.log("Sending to AI...")

    const interViewReportByAi = await generateInterviewReport({
        resume: resumeText,
        selfDescription,
        jobDescription
    })

    const interviewReport = await interviewReportModel.create({
        user: req.user.id,
        resume: resumeText,
        selfDescription,
        jobDescription,
        ...interViewReportByAi
    })

    res.status(201).json({
        success: true,
        message: "Interview report generated successfully.",
        data: { interviewReport }
    })

})

/**
 * @description Controller to get interview report by interviewId.
 */
const getInterviewReportByIdController = asyncHandler(async (req, res, next) => {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        throw new AppError("Interview report not found.", 404, "REPORT_NOT_FOUND")
    }

    res.status(200).json({
        success: true,
        message: "Interview report fetched successfully.",
        data: { interviewReport }
    })
})


/** 
 * @description Controller to get all interview reports of logged in user.
 */
const getAllInterviewReportsController = asyncHandler(async (req, res, next) => {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        success: true,
        message: "Interview reports fetched successfully.",
        data: { interviewReports }
    })
})


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
const generateResumePdfController = asyncHandler(async (req, res, next) => {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findOne({
        _id: interviewReportId,
        user: req.user.id
    })

    if (!interviewReport) {
        throw new AppError("Interview report not found.", 404, "REPORT_NOT_FOUND")
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    const job = await pdfQueue.add('generate-pdf', {
        interviewReportId: interviewReport._id,
        resume,
        jobDescription,
        selfDescription
    });

    res.status(202).json({
        success: true,
        message: "PDF generation started.",
        data: { jobId: job.id }
    })
})

/**
 * @description Controller to check the status of a PDF generation job.
 */
const getPdfStatusController = asyncHandler(async (req, res, next) => {
    const { jobId } = req.params;

    const job = await pdfQueue.getJob(jobId);

    if (!job) {
        throw new AppError("Job not found.", 404, "JOB_NOT_FOUND")
    }

    const status = await job.getState();
    res.status(200).json({
        success: true,
        data: {
            jobId: job.id,
            status: status,
            progress: job.progress
        }
    });
})

/**
 * @description Controller to download the generated resume PDF.
 */
const downloadResumePdfController = asyncHandler(async (req, res, next) => {
    const { interviewReportId } = req.params;

    const interviewReport = await interviewReportModel.findOne({
        _id: interviewReportId,
        user: req.user.id
    });

    if (!interviewReport || !interviewReport.resumePdf) {
        throw new AppError("PDF not found or not yet generated.", 404, "PDF_NOT_FOUND")
    }

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    });

    res.send(interviewReport.resumePdf);
})

module.exports = { 
    generateInterViewReportController, 
    getInterviewReportByIdController, 
    getAllInterviewReportsController, 
    generateResumePdfController,
    getPdfStatusController,
    downloadResumePdfController
}