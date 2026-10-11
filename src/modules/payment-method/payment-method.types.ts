export type PaymentMethodType = 'COD' | 'STATIC_QR';

export interface ManagedPaymentMethod {
  id: string;
  code: string;
  type: PaymentMethodType;
  name: string;
  description: string | null;
  providerLabel: string | null;
  accountName: string | null;
  accountNumber: string | null;
  qrImageUrl: string | null;
  instructions: string | null;
  minAmount: string | null;
  maxAmount: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicPaymentMethod {
  id: string;
  code: string;
  type: PaymentMethodType;
  name: string;
  description: string | null;
  providerLabel: string | null;
  accountName: string | null;
  qrImageUrl: string | null;
  instructions: string | null;
  minAmount: string | null;
  maxAmount: string | null;
  displayOrder: number;
}

export interface CreatePaymentMethodInput {
  code: string;
  type: PaymentMethodType;
  name: string;
  description?: string | null;
  providerLabel?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  qrImageUrl?: string | null;
  instructions?: string | null;
  minAmount?: string | null;
  maxAmount?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdatePaymentMethodInput {
  name?: string;
  description?: string | null;
  providerLabel?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  qrImageUrl?: string | null;
  instructions?: string | null;
  minAmount?: string | null;
  maxAmount?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface PaymentMethodRepository {
  list(filter?: { isActive?: boolean }): Promise<ManagedPaymentMethod[]>;
  findById(id: string): Promise<ManagedPaymentMethod | null>;
  findByCode(code: string): Promise<ManagedPaymentMethod | null>;
  create(input: CreatePaymentMethodInput): Promise<ManagedPaymentMethod>;
  update(
    id: string,
    input: UpdatePaymentMethodInput,
  ): Promise<ManagedPaymentMethod>;
  setStatus(id: string, isActive: boolean): Promise<ManagedPaymentMethod>;
}
