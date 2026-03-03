/**
 * Cloudinary delete helper: extract public_id from stored URLs and delete assets.
 * Use when deleting Pins, Events, Suggestions, NGOs that reference Cloudinary images.
 */
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const CLOUDINARY_HOST = 'res.cloudinary.com';

/**
 * Check if a URL is a Cloudinary URL (upload or fetch).
 * @param {string} url
 * @returns {boolean}
 */
function isCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes(CLOUDINARY_HOST);
}

/**
 * Extract public_id from a Cloudinary image URL.
 * Handles both base URLs (upload/v123/...) and transformed URLs (upload/.../v123/...).
 * @param {string} url - Full Cloudinary URL
 * @returns {string|null} public_id without extension, or null if not parseable
 */
function getPublicIdFromUrl(url) {
  if (!url || !isCloudinaryUrl(url)) return null;
  try {
    // Match /v<digits>/<rest> where rest is the public_id (may contain slashes) and optional extension
    const match = url.match(/\/v\d+\/(.+)$/);
    if (!match || !match[1]) return null;
    const withExt = match[1];
    // public_id in API must not include extension
    const lastDot = withExt.lastIndexOf('.');
    if (lastDot > 0) {
      return withExt.slice(0, lastDot);
    }
    return withExt;
  } catch {
    return null;
  }
}

/**
 * Delete a single image from Cloudinary by URL. Logs errors but does not throw.
 * @param {string} url - Cloudinary image URL
 * @returns {Promise<void>}
 */
async function deleteFromCloudinaryByUrl(url) {
  const publicId = getPublicIdFromUrl(url);
  if (!publicId) return;
  if (!process.env.CLOUDINARY_API_SECRET) {
    console.warn('Cloudinary not configured; skipping delete for', url);
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.error('Cloudinary delete failed for', publicId, err.message);
  }
}

/**
 * Delete multiple images from Cloudinary by URL. Skips non-Cloudinary URLs; logs errors.
 * @param {string[]} urls - Array of image URLs (Cloudinary or other)
 * @returns {Promise<void>}
 */
async function deleteFromCloudinaryByUrls(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return;
  const cloudinaryUrls = urls.filter(isCloudinaryUrl);
  await Promise.allSettled(cloudinaryUrls.map(deleteFromCloudinaryByUrl));
}

module.exports = {
  isCloudinaryUrl,
  getPublicIdFromUrl,
  deleteFromCloudinaryByUrl,
  deleteFromCloudinaryByUrls
};
