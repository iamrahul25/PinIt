/**
 * Cloudinary URL transformation constants and helpers.
 * Base URLs are stored in DB; frontend applies these when loading images.
 */

// Transformation for full-size image: 1080px height, width auto
export const FULL_IMAGE_TRANSFORMATION = 'c_limit,f_auto,h_1080,q_auto:good';

// Transformation for thumbnail: 120px height, width auto
export const THUMBNAIL_TRANSFORMATION = 'c_limit,f_auto,h_120,q_auto:good';

const CLOUDINARY_UPLOAD_PREFIX = '/upload/';

/**
 * Insert transformation into a Cloudinary image URL.
 * Only transforms Cloudinary base URLs (upload/v...); returns others unchanged (e.g. legacy GridFS /api/images/:id or URLs that already have a transformation).
 * @param {string} baseUrl - Base Cloudinary URL or legacy image URL
 * @param {string} transformation - e.g. FULL_IMAGE_TRANSFORMATION or THUMBNAIL_TRANSFORMATION
 * @returns {string} Transformed URL or original if not Cloudinary base URL
 */
export function getCloudinaryUrl(baseUrl, transformation) {
  if (!baseUrl || typeof baseUrl !== 'string') return baseUrl;
  if (!baseUrl.includes('res.cloudinary.com') || !baseUrl.includes(CLOUDINARY_UPLOAD_PREFIX)) {
    return baseUrl;
  }
  // Only insert transformation for base URLs: /upload/v123... (version immediately after upload)
  const baseUploadWithVersion = '/upload/v';
  if (!baseUrl.includes(baseUploadWithVersion)) return baseUrl;
  return baseUrl.replace(baseUploadWithVersion, `${CLOUDINARY_UPLOAD_PREFIX}${transformation}/v`);
}

export function getFullImageUrl(baseUrl) {
  return getCloudinaryUrl(baseUrl, FULL_IMAGE_TRANSFORMATION);
}

export function getThumbnailUrl(baseUrl) {
  return getCloudinaryUrl(baseUrl, THUMBNAIL_TRANSFORMATION);
}
