/**
 * One-time Admin Seeder
 * ---------------------
 * Run once to create the initial admin account:
 *
 *   node src/utils/seedAdmin.js
 *
 * This script is intentionally separate from the main app bootstrap.
 * It reads credentials from environment variables so nothing sensitive
 * is ever hardcoded.
 *
 * Required env vars:
 *   MONGODB_URI, ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD
 */

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin.model');

const seed = async () => {
  const { MONGODB_URI, ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

  if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error(
      '[Seed] Missing required env vars: MONGODB_URI, ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD'
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[Seed] Connected to MongoDB.');

    const existing = await Admin.findOne({ username: ADMIN_USERNAME });
    if (existing) {
      console.log('[Seed] Admin already exists. Aborting.');
      process.exit(0);
    }

    const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    await Admin.create({
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password_hash,
    });

    console.log(`[Seed] Admin "${ADMIN_USERNAME}" created successfully.`);
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
  }
};

seed();
