/**
 * Custom error class for operational API errors.
 * Allows controllers to throw meaningful HTTP errors that the
 * global error handler can format and send to the client.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (e.g. 400, 401, 404)
   * @param {string} message    - Human-readable error message
   * @param {string[]} [errors] - Optional array of field-level error details
   */
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true; // Distinguishes from unexpected programmer errors

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
