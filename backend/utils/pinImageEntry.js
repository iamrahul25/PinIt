/**
 * Pin image entries: legacy string URL, or { src, imageCreatedAt?, uploadedAt?, gps? }.
 */

function getImageSrc(entry) {
  if (entry == null) return null;
  if (typeof entry === 'string') {
    const s = entry.trim();
    return s || null;
  }
  if (typeof entry === 'object' && typeof entry.src === 'string') {
    const s = entry.src.trim();
    return s || null;
  }
  return null;
}

/**
 * Normalize one image from API body into a storable object (always object shape for new writes).
 * @param {string|object} item
 * @returns {object|null}
 */
function normalizePinImageFromBody(item) {
  if (item == null) return null;
  if (typeof item === 'string') {
    const src = item.trim();
    if (!src) return null;
    return { src, uploadedAt: new Date() };
  }
  if (typeof item === 'object' && typeof item.src === 'string') {
    const src = item.src.trim();
    if (!src) return null;
    const out = { src };
    if (item.imageCreatedAt != null) {
      const d = new Date(item.imageCreatedAt);
      if (!Number.isNaN(d.getTime())) out.imageCreatedAt = d;
    }
    if (item.uploadedAt != null) {
      const du = new Date(item.uploadedAt);
      if (!Number.isNaN(du.getTime())) out.uploadedAt = du;
    }
    if (!out.uploadedAt) out.uploadedAt = new Date();
    if (item.gps && typeof item.gps.latitude === 'number' && typeof item.gps.longitude === 'number') {
      if (Math.abs(item.gps.latitude) <= 90 && Math.abs(item.gps.longitude) <= 180) {
        out.gps = { latitude: item.gps.latitude, longitude: item.gps.longitude };
      }
    }
    return out;
  }
  return null;
}

/**
 * @param {unknown[]} arr
 * @returns {object[]}
 */
function normalizePinImagesArrayFromBody(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr) {
    const n = normalizePinImageFromBody(item);
    if (n) out.push(n);
  }
  return out;
}

module.exports = {
  getImageSrc,
  normalizePinImageFromBody,
  normalizePinImagesArrayFromBody
};
