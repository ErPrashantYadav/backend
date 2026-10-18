export const ADMIN_SYSTEM_PERMISSION = 'admin.system.manage';

export const ADMIN_PERMISSION_KEYS = [
  ADMIN_SYSTEM_PERMISSION,
  'admin.users.read',
  'admin.users.create',
  'admin.users.update',
  'admin.users.status',
  'admin.users.password',
  'admin.roles.read',
  'admin.roles.create',
  'admin.roles.update',
  'admin.roles.permissions',
  'catalog.categories.read',
  'catalog.categories.create',
  'catalog.categories.update',
  'catalog.categories.delete',
  'catalog.brands.read',
  'catalog.brands.create',
  'catalog.brands.update',
  'catalog.brands.delete',
  'catalog.products.read',
  'catalog.products.create',
  'catalog.products.update',
  'catalog.products.delete',
  'catalog.product-images.read',
  'catalog.product-images.create',
  'catalog.product-images.update',
  'catalog.product-images.delete',
  'catalog.variants.read',
  'catalog.variants.create',
  'catalog.variants.update',
  'catalog.variants.delete',
  'inventory.movements.read',
  'inventory.adjust',
  'inventory.low-stock.read',
  'payment-methods.read',
  'payment-methods.create',
  'payment-methods.update',
  'payment-methods.status',
  'payment-submissions.read',
  'payment-submissions.review',
  'orders.read',
  'orders.status',
  'orders.update',
  'promo-codes.read',
  'promo-codes.create',
  'promo-codes.update',
  'promo-codes.delete',
  'audit-logs.read',
  'dashboard.read',
  'customers.read',
  'contact-inquiries.read',
  'contact-inquiries.update',
  'banners.read',
  'banners.create',
  'banners.update',
  'banners.delete',
  'gallery.read',
  'gallery.create',
  'gallery.update',
  'gallery.delete',
  'settings.read',
  'settings.update',
  'social-media.read',
  'social-media.create',
  'social-media.update',
  'social-media.delete',
  'newsletter.read',
  'newsletter.delete',
] as const;

export interface ManagedAdmin {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  role: { id: string; name: string; isActive: boolean };
}

export interface ManagedRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions: string[];
}

export interface ManagedPermission {
  id: string;
  key: string;
  description: string | null;
}

export interface AdminManagementRepository {
  listAdmins(skip: number, take: number): Promise<ManagedAdmin[]>;
  countAdmins(): Promise<number>;
  findAdmin(id: string): Promise<ManagedAdmin | null>;
  createAdmin(input: {
    email: string;
    name: string;
    passwordHash: string;
    roleId: string;
  }): Promise<ManagedAdmin>;
  updateAdmin(
    id: string,
    input: { email?: string; name?: string; roleId?: string },
  ): Promise<ManagedAdmin>;
  setAdminActive(id: string, isActive: boolean): Promise<ManagedAdmin>;
  setAdminPassword(id: string, passwordHash: string): Promise<void>;
  listRoles(): Promise<ManagedRole[]>;
  findRole(id: string): Promise<ManagedRole | null>;
  createRole(input: {
    name: string;
    description?: string;
    isActive: boolean;
  }): Promise<ManagedRole>;
  updateRole(
    id: string,
    input: { name?: string; description?: string | null; isActive?: boolean },
  ): Promise<ManagedRole>;
  listPermissions(): Promise<ManagedPermission[]>;
  replaceRolePermissions(roleId: string, keys: string[]): Promise<ManagedRole>;
  removeRolePermission(roleId: string, key: string): Promise<ManagedRole>;
}

export interface ProvisioningRepository {
  provisionInitialAdmin(input: {
    email: string;
    name: string;
    passwordHash: string;
    roleName: string;
    permissionKeys: readonly string[];
  }): Promise<void>;
}
