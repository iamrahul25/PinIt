import exifr from 'exifr';

/** Sent as multipart `exifMeta` JSON; fills gaps when compression strips EXIF from the uploaded blob. */
export type ImageUploadExifPayload = {
  imageCreatedAt?: string;
  gps?: { latitude: number; longitude: number };
};

export async function extractImageUploadMetaForForm(
  file: File | Blob | null | undefined
): Promise<ImageUploadExifPayload | null> {
  if (!file) return null;
  try {
    const data = await exifr.parse(file, { gps: true, reviveValues: true });
    if (!data) return null;
    const out: ImageUploadExifPayload = {};
    const rawDate = data.DateTimeOriginal || data.CreateDate || data.ModifyDate;
    if (rawDate != null) {
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if (!Number.isNaN(d.getTime())) out.imageCreatedAt = d.toISOString();
    }
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      if (Math.abs(data.latitude) <= 90 && Math.abs(data.longitude) <= 180) {
        out.gps = { latitude: data.latitude, longitude: data.longitude };
      }
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
