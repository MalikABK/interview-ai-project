const User = require('../models/user.model')

class UserRepository {
    async findById(id) {
        return User.findById(id).lean()
    }

    async findByEmail(email) {
        return User.findOne({ email }).lean()
    }

    async findByEmailOrUsername(email, username) {
        return User.findOne({ $or: [{ email }, { username }] }).lean()
    }

    async create({ username, email, password }) {
        const user = await User.create({ username, email, password })
        return user.toObject()
    }
}

module.exports = new UserRepository()
