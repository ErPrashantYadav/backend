import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../../errors/app-error';
import type {
  CloudinaryClient,
  CloudinaryDestroyResult,
  CloudinaryUploadOptions,
  CloudinaryUploadResult,
} from './media.types';

export class RealCloudinaryClient implements CloudinaryClient {
  constructor(credentials: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  }) {
    cloudinary.config({
      cloud_name: credentials.cloudName,
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      secure: true,
    });
  }

  async uploadStream(
    buffer: Buffer,
    options: CloudinaryUploadOptions,
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          tags: options.tags,
          public_id: options.public_id,
          overwrite: options.overwrite ?? false,
          resource_type: options.resource_type ?? 'image',
        },
        (error, result) => {
          if (error || !result) {
            const safeMessage = error?.message
              ? error.message.replace(/[A-Za-z0-9_-]{20,}/g, '[REDACTED]')
              : 'Cloudinary upload stream failed';
            return reject(
              new AppError(502, 'CLOUDINARY_UPLOAD_FAILED', safeMessage),
            );
          }

          resolve({
            public_id: result.public_id,
            secure_url: result.secure_url,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            created_at: result.created_at,
          });
        },
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }

  async destroy(
    publicId: string,
    options: { resource_type?: 'image' } = {},
  ): Promise<CloudinaryDestroyResult> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: options.resource_type ?? 'image',
        invalidate: true,
      });
      return { result: result.result ?? 'ok' };
    } catch (error) {
      const safeMessage =
        error instanceof Error
          ? error.message.replace(/[A-Za-z0-9_-]{20,}/g, '[REDACTED]')
          : 'Failed to destroy asset in Cloudinary';
      throw new AppError(502, 'CLOUDINARY_DELETE_FAILED', safeMessage);
    }
  }
}

export class MemoryCloudinaryClient implements CloudinaryClient {
  public assets = new Map<string, CloudinaryUploadResult>();
  public uploadAttempts = 0;
  private nextError: Error | null = null;

  failNextUpload(error: Error): void {
    this.nextError = error;
  }

  async uploadStream(
    buffer: Buffer,
    options: CloudinaryUploadOptions,
  ): Promise<CloudinaryUploadResult> {
    this.uploadAttempts++;

    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }

    const publicId = options.public_id
      ? `${options.folder}/${options.public_id}`
      : `${options.folder}/mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result: CloudinaryUploadResult = {
      public_id: publicId,
      secure_url: `https://res.cloudinary.com/mock-cloud/image/upload/v1/${publicId}.webp`,
      format: 'webp',
      bytes: buffer.length,
      width: 800,
      height: 800,
      created_at: new Date().toISOString(),
    };

    this.assets.set(publicId, result);
    return result;
  }

  async destroy(
    publicId: string,
    _options: { resource_type?: 'image' } = {},
  ): Promise<CloudinaryDestroyResult> {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }

    const exists = this.assets.has(publicId);
    this.assets.delete(publicId);

    return {
      result: exists ? 'ok' : 'not found',
    };
  }
}

export class UnconfiguredCloudinaryClient implements CloudinaryClient {
  async uploadStream(): Promise<CloudinaryUploadResult> {
    throw new AppError(
      500,
      'CLOUDINARY_CONFIG_MISSING',
      'Cloudinary storage is not configured. Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET.',
    );
  }

  async destroy(): Promise<CloudinaryDestroyResult> {
    throw new AppError(
      500,
      'CLOUDINARY_CONFIG_MISSING',
      'Cloudinary storage is not configured. Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET.',
    );
  }
}
