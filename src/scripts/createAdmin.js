require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin.model');

async function createAdmin() {
    const username = process.argv[2];
    const password = process.argv[3];
    const email = process.argv[4];

    if (!username || !password || !email) {
        console.log('Usage: node src/scripts/createAdmin.js <username> <password> <email>');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        const password_hash = await bcrypt.hash(password, 10);
        const admin = new Admin({
            username,
            password_hash,
            email
        });

        await admin.save();
        console.log(`Admin ${username} created successfully!`);
    } catch (err) {
        console.error('Error creating admin:', err.message);
    } finally {
        await mongoose.connection.close();
    }
}

createAdmin();
