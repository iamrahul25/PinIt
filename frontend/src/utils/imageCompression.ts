import imageCompression from 'browser-image-compression';
import type { Options } from 'browser-image-compression';

/**
 * Client-side WebP compression before upload: smaller payloads than JPEG/PNG at similar quality.
 * Pairs with backend Cloudinary `format: 'webp'` storage.
 */
const WEBP_COMPRESSION_BASE: Partial<Options> = {
  fileType: 'image/webp',
  useWebWorker: true,
  initialQuality: 0.62,
  alwaysKeepResolution: false,
  maxIteration: 14
};

/**
 * @param overrides — e.g. `{ maxWidthOrHeight: 1920, maxSizeMB: 0.5 }` for high-res pin photos
 */
export function webpCompressionOptions(overrides: Partial<Options> = {}): Options {
  return {
    maxSizeMB: 0.42,
    maxWidthOrHeight: 1200,
    ...WEBP_COMPRESSION_BASE,
    ...overrides
  };
}

/** Named presets — single place to tune compression per feature. */
export const IMAGE_COMPRESSION_PRESETS = {
  pin: webpCompressionOptions({ maxSizeMB: 0.5, maxWidthOrHeight: 1920 }),
  suggestion: webpCompressionOptions({ maxSizeMB: 0.45, maxWidthOrHeight: 1200 }),
  ngoLogo: webpCompressionOptions({ maxSizeMB: 0.38, maxWidthOrHeight: 800 }),
  eventBanner: webpCompressionOptions({ maxSizeMB: 0.45, maxWidthOrHeight: 1200 })
} as const;

export type ImageCompressionPreset = keyof typeof IMAGE_COMPRESSION_PRESETS;

export async function compressImageWithPreset(
  file: File,
  preset: ImageCompressionPreset
): Promise<File> {
  return imageCompression(file, IMAGE_COMPRESSION_PRESETS[preset]);
}

export async function compressImagesWithPreset(
  files: File[],
  preset: ImageCompressionPreset
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImageWithPreset(f, preset)));
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
