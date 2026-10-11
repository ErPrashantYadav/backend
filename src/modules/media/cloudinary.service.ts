import crypto from 'node:crypto';
import type { Logger } from 'pino';
import type { AppConfig } from '../../config/env';
import { AppError } from '../../errors/app-error';
import { validateImageBuffer } from './image-validator';
import type {
  CloudinaryClient,
  DeleteAssetInput,
  MediaReferenceChecker,
  SafeAssetMetadata,
  UploadImageInput,
} from './media.types';
import { UPLOAD_PURPOSE_CONFIG } from './media.types';

export class CloudinaryService {
  constructor(
    private readonly config: AppConfig,
    private readonly client: CloudinaryClient,
    private readonly referenceChecker?: MediaReferenceChecker,
    private readonly logger?: Logger,
  ) {}

  async upload(input: UploadImageInput): Promise<SafeAssetMetadata> {
    const purpose = input.purpose;
    const purposeConfig = UPLOAD_PURPOSE_CONFIG[purpose];
    if (!purposeConfig) {
      throw new AppError(
        400,
        'INVALID_UPLOAD_PURPOSE',
        'Upload purpose must be PRODUCT_IMAGE or PAYMENT_QR',
      );
    }

    // Validate image format, actual content via magic bytes, and file size limit
    validateImageBuffer(input.buffer, input.mimeType, purpose);

    const folder =
      purpose === 'PRODUCT_IMAGE'
        ? this.config.CLOUDINARY_PRODUCT_FOLDER || 'liquor_shop/products'
        : this.config.CLOUDINARY_PAYMENT_QR_FOLDER || 'liquor_shop/payment_qr';

    // Generate random asset ID to strictly prevent collisions and accidental overwriting
    const randomAssetId = crypto.randomUUID();

    // Retry policy: max 2 retries with exponential backoff on transient errors
    let lastError: unknown;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const uploadResult = await this.client.uploadStream(input.buffer, {
          folder,
          public_id: randomAssetId,
          tags: [purposeConfig.tag],
          overwrite: false,
          resource_type: 'image',
        });

        this.logger?.info(
          {
            purpose,
            publicId: uploadResult.public_id,
            bytes: uploadResult.bytes,
            format: uploadResult.format,
          },
          'Media asset uploaded successfully',
        );

        return {
          secureUrl: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          width: uploadResult.width,
          height: uploadResult.height,
          folder,
          purpose,
        };
      } catch (error) {
        if (
          error instanceof AppError &&
          (error.code === 'CLOUDINARY_CONFIG_MISSING' || error.statusCode < 500)
        ) {
          throw error;
        }
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 50;
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }

    const safeMessage =
      lastError instanceof AppError
        ? lastError.message
        : 'Failed to upload media asset after retries';

    throw new AppError(502, 'CLOUDINARY_UPLOAD_FAILED', safeMessage);
  }

  async delete(input: DeleteAssetInput): Promise<{ deleted: boolean }> {
    const trimmedId = input.publicId?.trim();
    if (!trimmedId) {
      throw new AppError(
        400,
        'INVALID_PUBLIC_ID',
        'Asset publicId is required',
      );
    }

    // Security check: ensure public ID starts with the allowed folders to prevent tampering with foreign assets
    const allowedFolders = [
      this.config.CLOUDINARY_PRODUCT_FOLDER || 'liquor_shop/products',
      this.config.CLOUDINARY_PAYMENT_QR_FOLDER || 'liquor_shop/payment_qr',
    ];

    const isAllowedFolder = allowedFolders.some(
      (folder) => trimmedId.startsWith(`${folder}/`) || trimmedId === folder,
    );

    if (!isAllowedFolder) {
      throw new AppError(
        403,
        'FORBIDDEN_ASSET_TARGET',
        'Asset public ID is outside the managed folders',
      );
    }

    // Check if asset is currently in use or historical evidence
    if (this.referenceChecker) {
      const check = await this.referenceChecker.isAssetReferenced(trimmedId);
      if (check.referenced) {
        throw new AppError(
          409,
          'ASSET_IN_USE',
          `Cannot delete asset: ${check.reason}`,
        );
      }
    }

    const result = await this.client.destroy(trimmedId);

    this.logger?.info(
      { publicId: trimmedId, result: result.result },
      'Media asset deleted',
    );

    return { deleted: true };
  }
}
