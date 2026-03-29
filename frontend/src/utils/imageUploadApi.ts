import axios from 'axios';
import { API_BASE_URL } from '../config';
import { extractImageUploadMetaForForm } from './imageUploadMeta';
import type { PinImageGps } from './pinImageEntry';

export const IMAGE_UPLOAD_URL = `${API_BASE_URL}/api/images/upload`;

export type ImageUploadResponseBody = {
  url: string;
  fileId?: string;
  uploadedAt?: string;
  imageCreatedAt?: string | null;
  gps?: PinImageGps | null;
};

type GetAuthHeaders = (extra?: Record<string, string>) => Promise<Record<string, string>>;

/**
 * POST multipart `image` to Cloudinary-backed upload. Optionally sends EXIF from `exifSourceFile`
 * (use the original photo when the uploaded `file` is a compressed WebP without EXIF).
 */
export async function uploadImageFile(
  file: File,
  options: {
    getAuthHeaders: GetAuthHeaders;
    exifSourceFile?: File;
  }
): Promise<ImageUploadResponseBody> {
  const formData = new FormData();
  formData.append('image', file);
  if (options.exifSourceFile) {
    const exifMeta = await extractImageUploadMetaForForm(options.exifSourceFile);
    if (exifMeta) formData.append('exifMeta', JSON.stringify(exifMeta));
  }
  const headers = await options.getAuthHeaders({ 'Content-Type': 'multipart/form-data' });
  const res = await axios.post<ImageUploadResponseBody>(IMAGE_UPLOAD_URL, formData, { headers });
  return res.data;
}
