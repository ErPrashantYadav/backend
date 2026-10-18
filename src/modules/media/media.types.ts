export type UploadPurpose =
  | 'PRODUCT_IMAGE'
  | 'PAYMENT_QR'
  | 'BANNER_IMAGE'
  | 'GALLERY_IMAGE'
  | 'PAYMENT_PROOF';

export interface PurposeConfig {
  maxSizeBytes: number;
  allowedFormats: string[];
  allowedMimeTypes: string[];
  tag: string;
  defaultFolder: string;
}

export const UPLOAD_PURPOSE_CONFIG: Record<UploadPurpose, PurposeConfig> = {
  PRODUCT_IMAGE: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    tag: 'product_image',
    defaultFolder: 'liquor_shop/products',
  },
  PAYMENT_QR: {
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    tag: 'payment_qr',
    defaultFolder: 'liquor_shop/payment_qr',
  },
  BANNER_IMAGE: {
    maxSizeBytes: 8 * 1024 * 1024, // 8 MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    tag: 'banner_image',
    defaultFolder: 'liquor_shop/banners',
  },
  GALLERY_IMAGE: {
    maxSizeBytes: 8 * 1024 * 1024, // 8 MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    tag: 'gallery_image',
    defaultFolder: 'liquor_shop/gallery',
  },
  PAYMENT_PROOF: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    tag: 'payment_proof',
    defaultFolder: 'liquor_shop/payment_proofs',
  },
};

export interface SafeAssetMetadata {
  secureUrl: string;
  publicId: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  folder: string;
  purpose: UploadPurpose;
}

export interface UploadImageInput {
  buffer: Buffer;
  mimeType: string;
  purpose: UploadPurpose;
  originalFilename?: string;
}

export interface DeleteAssetInput {
  publicId: string;
  purpose?: UploadPurpose;
}

export interface CloudinaryUploadOptions {
  folder: string;
  tags: string[];
  public_id?: string;
  overwrite?: boolean;
  resource_type?: 'image';
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  created_at?: string;
}

export interface CloudinaryDestroyResult {
  result: 'ok' | 'not found' | string;
}

export interface CloudinaryClient {
  uploadStream(
    buffer: Buffer,
    options: CloudinaryUploadOptions,
  ): Promise<CloudinaryUploadResult>;
  destroy(
    publicId: string,
    options?: { resource_type?: 'image' },
  ): Promise<CloudinaryDestroyResult>;
}

export interface MediaReferenceCheckResult {
  referenced: boolean;
  reason?: string;
}

export interface MediaReferenceChecker {
  isAssetReferenced(
    publicId: string,
    secureUrl?: string,
  ): Promise<MediaReferenceCheckResult>;
}
