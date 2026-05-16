const InterviewReport = require('../models/interviewReport.model')

const SUMMARY_FIELDS = 'title matchScore createdAt'

class InterviewRepository {
    async create(data) {
        const doc = await InterviewReport.create(data)
        const obj = doc.toObject()
        delete obj.__v
        return obj
    }

    async findByIdAndUser(id, userId) {
        return InterviewReport.findOne({ _id: id, user: userId }).select('-__v').lean()
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
        
        // Ensure strictly only summary fields are returned
        const data = docs.map(doc => ({
            id: doc._id,
            title: doc.title,
            matchScore: doc.matchScore,
            createdAt: doc.createdAt
        }))

        return {
            data,
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
