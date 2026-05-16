const { z } = require('zod');

const CreateReportDTO = z.object({
    selfDescription: z.string().min(10).max(2000),
    jobDescription: z.string().min(10).max(5000),
});

const ReportSummaryDTO = z.object({
    _id: z.any(),
    title: z.string(),
    matchScore: z.number().optional(),
    createdAt: z.date().optional(),
});

const PaginationDTO = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(50).default(10),
});

module.exports = {
    CreateReportDTO,
    ReportSummaryDTO,
    PaginationDTO
};
