export interface AdminAuthRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isActive: boolean;
  role: {
    id: string;
    name: string;
    isActive: boolean;
    permissions: string[];
  };
}

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: {
    id: string;
    name: string;
  };
  permissions: string[];
}

export interface AdminAuthRepository {
  findByEmail(email: string): Promise<AdminAuthRecord | null>;
  findById(id: string): Promise<AdminAuthRecord | null>;
}

declare module 'express-serve-static-core' {
  interface Request {
    adminProfile?: AdminProfile;
  }
}
