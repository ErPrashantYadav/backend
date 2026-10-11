export const KNOWN_SOCIAL_PLATFORMS = [
  'FACEBOOK',
  'INSTAGRAM',
  'YOUTUBE',
  'TIKTOK',
  'OTHER',
] as const;

export type KnownSocialPlatform = (typeof KNOWN_SOCIAL_PLATFORMS)[number];

export const SOCIAL_MEDIA_TYPES = ['video', 'profile'] as const;
export type SocialMediaType = (typeof SOCIAL_MEDIA_TYPES)[number];

export interface SocialMediaRecord {
  id: string;
  platform: string;
  url: string;
  type: string;
  label: string | null;
  thumbnailUrl: string | null;
  publicId: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSocialMediaInput {
  platform: string;
  url: string;
  type?: string;
  label?: string | null;
  thumbnailUrl?: string | null;
  publicId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateSocialMediaInput {
  platform?: string;
  url?: string;
  type?: string;
  label?: string | null;
  thumbnailUrl?: string | null;
  publicId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface ListSocialMediaParams {
  page?: number;
  limit?: number;
  platform?: string;
  type?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: 'displayOrder' | 'createdAt' | 'platform' | 'label';
  sortOrder?: 'asc' | 'desc';
}

export interface PlatformCounts {
  ALL: number;
  FACEBOOK: number;
  INSTAGRAM: number;
  YOUTUBE: number;
  TIKTOK: number;
  OTHER: number;
  [key: string]: number;
}

export interface SocialMediaRepository {
  create(data: CreateSocialMediaInput): Promise<SocialMediaRecord>;
  createMany(data: CreateSocialMediaInput[]): Promise<SocialMediaRecord[]>;
  findById(id: string): Promise<SocialMediaRecord | null>;
  list(params?: ListSocialMediaParams): Promise<{
    items: SocialMediaRecord[];
    total: number;
    platformCounts: PlatformCounts;
  }>;
  listActive(type?: string, platform?: string): Promise<SocialMediaRecord[]>;
  update(id: string, data: UpdateSocialMediaInput): Promise<SocialMediaRecord>;
  delete(id: string): Promise<boolean>;
}
