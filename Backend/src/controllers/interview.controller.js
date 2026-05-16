const pdfParse = require("pdf-parse")
const mammoth = require("mammoth")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")
const { pdfQueue } = require("../queues/pdfQueue")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {

    try {

        let resumeText = ""

        if (req.file.mimetype === "application/pdf") {
            console.log("Processing PDF...")
            const parser = new pdfParse.PDFParse({ data: req.file.buffer })
            const result = await parser.getText()
            resumeText = result.text
            await parser.destroy()
            console.log("PDF parsed. Text length:", resumeText ? resumeText.length : 0)
        } else if (req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            console.log("Processing DOCX...")
            const docxData = await mammoth.extractRawText({ buffer: req.file.buffer })
            resumeText = docxData.value
            console.log("DOCX parsed. Text length:", resumeText ? resumeText.length : 0)
        } else {
            console.log("Unsupported mimetype:", req.file.mimetype)
            return res.status(400).json({
                message: "Unsupported file type. Please upload a PDF or DOCX file."
            })
        }

        if (!resumeText || resumeText.trim().length === 0) {
            return res.status(400).json({
                message: "Could not extract text from the uploaded document. Please ensure it is not an image-based PDF or encrypted."
            })
        }

        const { selfDescription, jobDescription } = req.body
        console.log("Sending to AI...")

        const interViewReportByAi = await generateInterviewReport({
            resume: resumeText,
            selfDescription,
            jobDescription
        })
        console.log("AI report generated.")

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeText,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        })

        res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({
            message: "Error processing document or generating report."
        })
    }

}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    try {
        const { interviewReportId } = req.params

        const interviewReport = await interviewReportModel.findOne({
            _id: interviewReportId,
            user: req.user.id
        })

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        const { resume, jobDescription, selfDescription } = interviewReport

        const job = await pdfQueue.add('generate-pdf', {
            interviewReportId: interviewReport._id,
            resume,
            jobDescription,
            selfDescription
        });

        res.status(202).json({
            message: "PDF generation started.",
            jobId: job.id
        })
    } catch (error) {
        console.error("Error queueing PDF job:", error);
        res.status(500).json({
            message: "Error starting PDF generation."
        })
    }
}

/**
 * @description Controller to check the status of a PDF generation job.
 */
async function getPdfStatusController(req, res) {
    const { jobId } = req.params;

    try {
        const job = await pdfQueue.getJob(jobId);

        if (!job) {
            return res.status(404).json({ message: "Job not found." });
        }

        const status = await job.getState();
        res.status(200).json({
            jobId: job.id,
            status: status, // 'waiting', 'active', 'completed', 'failed', 'delayed'
            progress: job.progress
        });
    } catch (error) {
        console.error("Error fetching job status:", error);
        res.status(500).json({ message: "Error fetching job status." });
    }
}

/**
 * @description Controller to download the generated resume PDF.
 */
async function downloadResumePdfController(req, res) {
    const { interviewReportId } = req.params;

    try {
        const interviewReport = await interviewReportModel.findOne({
            _id: interviewReportId,
            user: req.user.id
        });

        if (!interviewReport || !interviewReport.resumePdf) {
            return res.status(404).json({
                message: "PDF not found or not yet generated."
            });
        }

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        });

        res.send(interviewReport.resumePdf);
    } catch (error) {
        console.error("Error downloading PDF:", error);
        res.status(500).json({ message: "Error downloading PDF." });
    }
}

module.exports = { 
    generateInterViewReportController, 
    getInterviewReportByIdController, 
    getAllInterviewReportsController, 
    generateResumePdfController,
    getPdfStatusController,
    downloadResumePdfController
}