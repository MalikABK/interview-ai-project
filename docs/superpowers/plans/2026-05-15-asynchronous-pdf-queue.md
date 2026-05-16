# Asynchronous PDF Job Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move heavy PDF generation tasks to a background queue using BullMQ/Redis to prevent blocking the API server and crashing under load.

**Architecture:** 
- The API server will push a job to Redis via BullMQ.
- A separate Worker process will consume jobs and use Puppeteer to generate the PDF.
- A polling endpoint will be added for the frontend to check the status of the job.

**Tech Stack:** Node.js, Redis, BullMQ, Express.

---

### Task 1: Setup BullMQ & Redis

**Files:**
- Modify: `Backend/package.json`

- [ ] **Step 1: Install dependencies**
```bash
npm install bullmq ioredis
```

---

### Task 2: Define Job Queue & Worker

**Files:**
- Create: `Backend/src/queues/pdfQueue.js`
- Create: `Backend/src/queues/pdfWorker.js`

- [ ] **Step 1: Define queue**
```javascript
// Backend/src/queues/pdfQueue.js
const { Queue } = require('bullmq');
const connection = { host: 'localhost', port: 6379 };
const pdfQueue = new Queue('pdf-generation', { connection });
module.exports = { pdfQueue, connection };
```

- [ ] **Step 2: Define worker**
```javascript
// Backend/src/queues/pdfWorker.js
const { Worker } = require('bullmq');
const { connection } = require('./pdfQueue');
const { generateResumePdf } = require('../services/ai.service');

const worker = new Worker('pdf-generation', async (job) => {
    const { resume, jobDescription, selfDescription } = job.data;
    return await generateResumePdf({ resume, jobDescription, selfDescription });
}, { connection });

worker.on('completed', job => console.log(`Job ${job.id} completed!`));
```

---

### Task 3: Update Controller to Queue Jobs

**Files:**
- Modify: `Backend/src/controllers/interview.controller.js`

- [ ] **Step 1: Update controller to dispatch jobs**
```javascript
// Replace generateResumePdfController logic
const { pdfQueue } = require('../queues/pdfQueue');

async function generateResumePdfController(req, res) {
    const job = await pdfQueue.add('generate', { ...interviewReport });
    res.status(202).json({ jobId: job.id, message: "PDF generation started." });
}
```

---

### Task 4: Polling Endpoint

**Files:**
- Modify: `Backend/src/routes/interview.routes.js`
- Modify: `Backend/src/controllers/interview.controller.js`

- [ ] **Step 1: Add status endpoint**
```javascript
// GET /api/interview/status/:jobId
// Returns 'completed' or 'waiting'
```
