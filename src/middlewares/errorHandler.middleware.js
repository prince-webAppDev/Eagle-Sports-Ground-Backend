const ApiError = require('../utils/ApiError');

/**
 * Global Express error handler.
 * Must have 4 parameters for Express to treat it as an error handler.
 *
 * Handles:
 *  - ApiError instances (operational, expected errors)
 *  - Mongoose ValidationError
 *  - Mongoose CastError (invalid ObjectId)
 *  - Mongoose duplicate key error (code 11000)
 *  - JWT errors
 *  - Generic unexpected errors
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];

  // --- Mongoose Validation Error ---
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => e.message);
  }

  // --- Mongoose CastError (e.g. invalid ObjectId format) ---
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field '${err.path}': ${err.value}`;
  }

  // --- MongoDB Duplicate Key (unique constraint violation) ---
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `A record with this ${field} already exists.`;
  }

  // --- JWT Errors (these shouldn't normally reach here, but as a safeguard) ---
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired.';
  }

  // Log unexpected server errors (not operational ApiErrors)
  if (!err.isOperational && statusCode === 500) {
    console.error('[ERROR] Unexpected server error:', err);
  }

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(errors.length > 0 && { errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
