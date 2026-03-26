const exifr = require('exifr');

/**
 * Parse creation time and GPS from image buffer (JPEG/TIFF/HEIC where supported).
 * @param {Buffer} buffer
 * @returns {Promise<{ date: Date|null, gps: { latitude: number, longitude: number }|null }>}
 */
async function extractExifFromBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { date: null, gps: null };
  }
  try {
    const data = await exifr.parse(buffer, { gps: true, reviveValues: true });
    if (!data) return { date: null, gps: null };
    const rawDate = data.DateTimeOriginal || data.CreateDate || data.ModifyDate || null;
    let date = null;
    if (rawDate != null) {
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
      date = !Number.isNaN(d.getTime()) ? d : null;
    }
    let gps = null;
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      if (Math.abs(data.latitude) <= 90 && Math.abs(data.longitude) <= 180) {
        gps = { latitude: data.latitude, longitude: data.longitude };
      }
    }
    return { date, gps };
  } catch {
    return { date: null, gps: null };
  }
}

/**
 * @param {string|undefined} jsonStr - multipart field from client (pre-compression EXIF)
 * @returns {{ imageCreatedAt?: string, gps?: { latitude: number, longitude: number } }|null}
 */
function parseClientExifMetaField(jsonStr) {
  if (!jsonStr || typeof jsonStr !== 'string') return null;
  const trimmed = jsonStr.trim();
  if (!trimmed) return null;
  try {
    const o = JSON.parse(trimmed);
    if (!o || typeof o !== 'object') return null;
    const out = {};
    if (o.imageCreatedAt != null) {
      const d = new Date(o.imageCreatedAt);
      if (!Number.isNaN(d.getTime())) out.imageCreatedAt = d.toISOString();
    }
    if (o.gps && typeof o.gps.latitude === 'number' && typeof o.gps.longitude === 'number') {
      if (Math.abs(o.gps.latitude) <= 90 && Math.abs(o.gps.longitude) <= 180) {
        out.gps = { latitude: o.gps.latitude, longitude: o.gps.longitude };
      }
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/**
 * Prefer buffer EXIF; fill gaps from client meta (compression often strips EXIF).
 */
function mergeExifForUpload(bufferResult, clientMeta) {
  const uploadedAt = new Date();
  let imageCreatedAt = bufferResult.date || null;
  let gps = bufferResult.gps || null;
  if (clientMeta) {
    if (!imageCreatedAt && clientMeta.imageCreatedAt) {
      const d = new Date(clientMeta.imageCreatedAt);
      if (!Number.isNaN(d.getTime())) imageCreatedAt = d;
    }
    if (!gps && clientMeta.gps) {
      gps = clientMeta.gps;
    }
  }
  return { uploadedAt, imageCreatedAt, gps };
}

module.exports = {
  extractExifFromBuffer,
  parseClientExifMetaField,
  mergeExifForUpload
};
