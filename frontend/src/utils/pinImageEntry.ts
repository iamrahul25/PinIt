import { API_BASE_URL } from '../config';
import { getFullImageUrl, getThumbnailUrl } from './cloudinaryUrls';

export type PinImageGps = { latitude: number; longitude: number };

export type PinImageEntry = {
  src: string;
  imageCreatedAt?: string | null;
  uploadedAt?: string | null;
  gps?: PinImageGps | null;
};

export type PinImageStored = string | PinImageEntry;

export function getPinImageSrc(entry: PinImageStored | null | undefined): string {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  return entry.src || '';
}

export function getPinImageDisplayUrl(entry: PinImageStored | null | undefined, size: 'full' | 'thumb' = 'full'): string {
  const src = getPinImageSrc(entry);
  if (!src) return '';
  const transformed = size === 'thumb' ? getThumbnailUrl(src) : getFullImageUrl(src);
  return src.startsWith('http') ? transformed : `${API_BASE_URL}/api/images/${src}`;
}

export function getPinImageMeta(entry: PinImageStored | null | undefined): {
  imageCreatedAt?: string | null;
  uploadedAt?: string | null;
  gps?: PinImageGps | null;
} | null {
  if (entry == null || typeof entry === 'string') return null;
  const m = entry as PinImageEntry;
  const hasGps =
    m.gps != null &&
    m.gps.latitude != null &&
    m.gps.longitude != null &&
    Number.isFinite(Number(m.gps.latitude)) &&
    Number.isFinite(Number(m.gps.longitude));
  const hasMeta =
    (m.imageCreatedAt != null && m.imageCreatedAt !== '') ||
    (m.uploadedAt != null && m.uploadedAt !== '') ||
    hasGps;
  if (!hasMeta) return null;
  return {
    imageCreatedAt: m.imageCreatedAt ?? null,
    uploadedAt: m.uploadedAt ?? null,
    gps: m.gps ?? null
  };
}

export function pinImageFromUploadResponse(data: {
  url: string;
  uploadedAt?: string;
  imageCreatedAt?: string | null;
  gps?: PinImageGps | null;
}): PinImageEntry {
  return {
    src: data.url,
    uploadedAt: data.uploadedAt || new Date().toISOString(),
    imageCreatedAt: data.imageCreatedAt ?? null,
    gps: data.gps ?? null
  };
}

/** Keep legacy strings; ensure objects are JSON-serializable for PUT/POST body. */
export function pinImageForApiBody(entry: PinImageStored): PinImageStored {
  if (typeof entry === 'string') return entry;
  return {
    src: entry.src,
    ...(entry.imageCreatedAt != null && entry.imageCreatedAt !== '' ? { imageCreatedAt: entry.imageCreatedAt } : {}),
    ...(entry.uploadedAt != null && entry.uploadedAt !== '' ? { uploadedAt: entry.uploadedAt } : {}),
    ...(entry.gps != null ? { gps: entry.gps } : {})
  };
}
