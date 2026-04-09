// Load environment variables FIRST — before any other module reads process.env
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// Graceful shutdown helpers
// ---------------------------------------------------------------------------
const shutdown = (signal) => {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch any unhandled promise rejections (prevents silent failures)
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Promise Rejection:', reason);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const start = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  });
};

start();
