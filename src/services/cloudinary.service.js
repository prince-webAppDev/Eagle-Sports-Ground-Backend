const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

/**
 * Uploads a file buffer to Cloudinary via a readable stream.
 * Avoids writing temp files to disk — the buffer is streamed directly.
 *
 * @param {Buffer} buffer        - File buffer from multer's memoryStorage
 * @param {string} folder        - Cloudinary folder name (e.g. 'teams', 'players')
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );

    // Convert buffer to readable stream and pipe into Cloudinary
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/**
 * Deletes an asset from Cloudinary by its public_id.
 * Logs a warning but does NOT throw if deletion fails, so the main
 * operation (e.g. deleting a player) isn't blocked by Cloudinary errors.
 *
 * @param {string|null} publicId - Cloudinary public_id to delete
 * @returns {Promise<void>}
 */
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.warn(`[Cloudinary] Failed to delete asset ${publicId}: ${err.message}`);
  }
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };
