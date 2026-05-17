const mongoose = require('mongoose');
require('dotenv').config();
const LoginAttempt = require('../src/models/loginAttempt.model');
const UserSession = require('../src/models/userSession.model');

async function migrate() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        
        console.log('Creating new collections and indexes...');
        await LoginAttempt.createIndexes();
        await UserSession.createIndexes();
        
        console.log('✅ Migration successful: LoginAttempt and UserSession collections are ready.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
