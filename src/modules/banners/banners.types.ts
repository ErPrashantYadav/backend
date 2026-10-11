export interface BannerRecord {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  publicId: string | null;
  linkUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBannerInput {
  title: string;
  description?: string | null;
  imageUrl: string;
  publicId?: string | null;
  linkUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface UpdateBannerInput {
  title?: string;
  description?: string | null;
  imageUrl?: string;
  publicId?: string | null;
  linkUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface ListBannersParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: 'displayOrder' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface BannerRepository {
  create(data: CreateBannerInput): Promise<BannerRecord>;
  findById(id: string): Promise<BannerRecord | null>;
  list(params?: ListBannersParams): Promise<{
    items: BannerRecord[];
    total: number;
  }>;
  listActive(now?: Date): Promise<BannerRecord[]>;
  update(id: string, data: UpdateBannerInput): Promise<BannerRecord>;
  delete(id: string): Promise<boolean>;
  reorder?(items: Array<{ id: string; displayOrder: number }>): Promise<void>;
}
