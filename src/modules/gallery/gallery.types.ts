export interface GalleryItemRecord {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  publicId: string | null;
  category: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGalleryItemInput {
  title: string;
  description?: string | null;
  imageUrl: string;
  publicId?: string | null;
  category?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateGalleryItemInput {
  title?: string;
  description?: string | null;
  imageUrl?: string;
  publicId?: string | null;
  category?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface ListGalleryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  isActive?: boolean;
  sortBy?: 'displayOrder' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface GalleryRepository {
  create(data: CreateGalleryItemInput): Promise<GalleryItemRecord>;
  findById(id: string): Promise<GalleryItemRecord | null>;
  list(params?: ListGalleryParams): Promise<{
    items: GalleryItemRecord[];
    total: number;
  }>;
  listActive(category?: string): Promise<GalleryItemRecord[]>;
  update(id: string, data: UpdateGalleryItemInput): Promise<GalleryItemRecord>;
  delete(id: string): Promise<boolean>;
}
