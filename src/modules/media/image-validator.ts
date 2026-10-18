import { AppError } from '../../errors/app-error';
import { UPLOAD_PURPOSE_CONFIG, type UploadPurpose } from './media.types';

export function detectImageFormat(
  buffer: Buffer,
): 'jpeg' | 'png' | 'webp' | null {
  if (buffer.length < 12) {
    return null;
  }

  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP magic bytes: 'RIFF' at 0..3 and 'WEBP' at 8..11
  const isRiff =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46;
  const isWebp =
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  if (isRiff && isWebp) {
    return 'webp';
  }

  return null;
}

export function validateImageBuffer(
  buffer: Buffer,
  mimeType: string,
  purpose: UploadPurpose,
): { format: string; detectedMime: string } {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'No image file content provided');
  }

  const config = UPLOAD_PURPOSE_CONFIG[purpose];
  if (!config) {
    throw new AppError(
      400,
      'INVALID_UPLOAD_PURPOSE',
      `Upload purpose must be one of: ${Object.keys(UPLOAD_PURPOSE_CONFIG).join(', ')}`,
    );
  }

  // Check file size
  if (buffer.length > config.maxSizeBytes) {
    const maxMb = config.maxSizeBytes / (1024 * 1024);
    throw new AppError(
      400,
      'FILE_TOO_LARGE',
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of ${maxMb} MB for ${purpose}`,
    );
  }

  // Check declared MIME type
  const normalizedMime = mimeType.trim().toLowerCase();
  if (!config.allowedMimeTypes.includes(normalizedMime)) {
    const statusCode = purpose === 'PAYMENT_PROOF' ? 400 : 415;
    const errorCode =
      purpose === 'PAYMENT_PROOF'
        ? 'INVALID_IMAGE_CONTENT'
        : 'UNSUPPORTED_MEDIA_TYPE';
    throw new AppError(
      statusCode,
      errorCode,
      `MIME type '${mimeType}' is not allowed. Allowed types: ${config.allowedMimeTypes.join(', ')}`,
    );
  }

  // Verify real file content via magic bytes
  const detectedFormat = detectImageFormat(buffer);
  if (!detectedFormat) {
    throw new AppError(
      400,
      'INVALID_IMAGE_CONTENT',
      'File content does not match any allowed image format signature (JPEG, PNG, WebP)',
    );
  }

  const detectedMime =
    detectedFormat === 'jpeg' ? 'image/jpeg' : `image/${detectedFormat}`;

  // Ensure declared MIME type matches detected format
  if (
    normalizedMime !== detectedMime &&
    !(normalizedMime === 'image/jpg' && detectedFormat === 'jpeg')
  ) {
    throw new AppError(
      400,
      'MIME_MISMATCH',
      `Declared MIME type '${mimeType}' does not match detected image format '${detectedFormat}'`,
    );
  }

  return {
    format: detectedFormat,
    detectedMime,
  };
}
