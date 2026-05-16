const InterviewReport = require('../models/interviewReport.model')

const SUMMARY_FIELDS = '-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan'

class InterviewRepository {
    async create(data) {
        const doc = await InterviewReport.create(data)
        return doc.toObject()
    }

    async findByIdAndUser(id, userId) {
        return InterviewReport.findOne({ _id: id, user: userId }).lean()
    }

    async findAllByUser(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit
        const [docs, total] = await Promise.all([
            InterviewReport
                .find({ user: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select(SUMMARY_FIELDS)
                .lean(),
            InterviewReport.countDocuments({ user: userId })
        ])
        return {
            data: docs,
            pagination: {
                page,
                limit,
                total,
                hasMore: skip + docs.length < total
            }
        }
    }
}

module.exports = new InterviewRepository()
