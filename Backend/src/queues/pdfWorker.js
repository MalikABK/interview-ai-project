const { Worker } = require('bullmq');
const connection = require('../config/redis');
const { generateResumePdf } = require('../services/ai.service');
const interviewReportModel = require('../infrastructure/models/interviewReport.model');
const { QUEUE } = require('../config/constants');

const worker = new Worker('pdf-generation', async (job) => {
    const { interviewReportId, resume, jobDescription, selfDescription } = job.data;
    
    console.log(`Starting PDF generation for job ${job.id} (Report: ${interviewReportId})`);
    
    try {
        const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription });
        
        await interviewReportModel.findByIdAndUpdate(interviewReportId, {
            resumePdf: Buffer.from(pdfBuffer)
        });
        
        console.log(`PDF generated and saved for report ${interviewReportId}`);
        return { success: true };
    } catch (error) {
        console.error(`Error generating PDF for job ${job.id}:`, error);
        throw error;
    }
}, { 
    connection,
    concurrency: QUEUE.PDF_CONCURRENCY
});

worker.on('completed', job => {
    console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} has failed with ${err.message}`);
});

module.exports = worker;
