const { z } = require('zod');

const generateReportSchema = z.object({
    body: z.object({
        selfDescription: z.string({
            required_error: "Self description is required",
        }).min(10, "Self description must be at least 10 characters long").max(2000, "Self description is too long"),
        jobDescription: z.string({
            required_error: "Job description is required",
        }).min(10, "Job description must be at least 10 characters long").max(5000, "Job description is too long"),
    })
});

const mongoIdSchema = z.object({
    params: z.object({
        interviewId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Interview ID"),
    })
});

const interviewReportIdSchema = z.object({
    params: z.object({
        interviewReportId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Report ID"),
    })
});

const jobIdSchema = z.object({
    params: z.object({
        jobId: z.string().min(1, "Job ID is required"),
    })
});

module.exports = {
    generateReportSchema,
    mongoIdSchema,
    interviewReportIdSchema,
    jobIdSchema
};
