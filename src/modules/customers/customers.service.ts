import { AppError } from '../../errors/app-error';
import type {
  CustomerDetailView,
  CustomerListItem,
  CustomerOrderView,
  CustomerRepository,
  ListCustomerOrdersParams,
  ListCustomersParams,
} from './customers.types';
import type {
  OrderStatus,
  PaymentStatus,
} from '../order-management/order-management.types';

const VALID_ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
];

const VALID_PAYMENT_STATUSES: PaymentStatus[] = [
  'PENDING',
  'UNDER_REVIEW',
  'PAID',
  'FAILED',
  'REFUNDED',
];

export class CustomerService {
  constructor(private readonly repository: CustomerRepository) {}

  async listCustomers(query: {
    page?: unknown;
    limit?: unknown;
    search?: unknown;
    sortBy?: unknown;
    sortOrder?: unknown;
  }): Promise<{
    items: CustomerListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    let page = 1;
    if (query.page !== undefined) {
      const parsedPage = Number(query.page);
      if (isNaN(parsedPage) || parsedPage < 1) {
        throw new AppError(
          400,
          'INVALID_PAGINATION',
          'page must be a positive integer',
        );
      }
      page = Math.floor(parsedPage);
    }

    let limit = 20;
    if (query.limit !== undefined) {
      const parsedLimit = Number(query.limit);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        throw new AppError(
          400,
          'INVALID_PAGINATION',
          'limit must be between 1 and 100',
        );
      }
      limit = Math.min(100, Math.floor(parsedLimit));
    }

    const search =
      typeof query.search === 'string' && query.search.trim()
        ? query.search.trim()
        : undefined;

    let sortBy: ListCustomersParams['sortBy'] = 'createdAt';
    if (query.sortBy !== undefined) {
      const allowed = [
        'createdAt',
        'name',
        'orderCount',
        'totalSpent',
        'latestOrderAt',
      ];
      if (typeof query.sortBy !== 'string' || !allowed.includes(query.sortBy)) {
        throw new AppError(
          400,
          'INVALID_SORT_FIELD',
          `sortBy must be one of: ${allowed.join(', ')}`,
        );
      }
      sortBy = query.sortBy as ListCustomersParams['sortBy'];
    }

    let sortOrder: 'asc' | 'desc' = 'desc';
    if (query.sortOrder !== undefined) {
      if (query.sortOrder !== 'asc' && query.sortOrder !== 'desc') {
        throw new AppError(
          400,
          'INVALID_SORT_ORDER',
          "sortOrder must be 'asc' or 'desc'",
        );
      }
      sortOrder = query.sortOrder;
    }

    const result = await this.repository.listCustomers({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    });

    const totalPages = Math.ceil(result.total / limit);

    return {
      items: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
      },
    };
  }

  async getCustomerById(id: string): Promise<CustomerDetailView> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError(400, 'INVALID_CUSTOMER_ID', 'Customer ID is required');
    }

    const customer = await this.repository.findCustomerById(id.trim());
    if (!customer) {
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    }

    const [summary, recentOrdersResult] = await Promise.all([
      this.repository.getCustomerSummary(customer.id),
      this.repository.listCustomerOrders(customer.id, { page: 1, limit: 5 }),
    ]);

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      deliveryAddress: customer.deliveryAddress,
      email: customer.email,
      createdAt: new Date(customer.createdAt).toISOString(),
      updatedAt: new Date(customer.updatedAt).toISOString(),
      summary,
      recentOrders: recentOrdersResult.items,
    };
  }

  async getCustomerOrders(
    id: string,
    query: {
      page?: unknown;
      limit?: unknown;
      status?: unknown;
      paymentStatus?: unknown;
      startDate?: unknown;
      endDate?: unknown;
      sortBy?: unknown;
      sortOrder?: unknown;
    },
  ): Promise<{
    items: CustomerOrderView[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError(400, 'INVALID_CUSTOMER_ID', 'Customer ID is required');
    }

    const customer = await this.repository.findCustomerById(id.trim());
    if (!customer) {
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    }

    let page = 1;
    if (query.page !== undefined) {
      const parsedPage = Number(query.page);
      if (isNaN(parsedPage) || parsedPage < 1) {
        throw new AppError(
          400,
          'INVALID_PAGINATION',
          'page must be a positive integer',
        );
      }
      page = Math.floor(parsedPage);
    }

    let limit = 20;
    if (query.limit !== undefined) {
      const parsedLimit = Number(query.limit);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        throw new AppError(
          400,
          'INVALID_PAGINATION',
          'limit must be between 1 and 100',
        );
      }
      limit = Math.min(100, Math.floor(parsedLimit));
    }

    let status: OrderStatus | undefined;
    if (query.status !== undefined) {
      if (
        typeof query.status !== 'string' ||
        !VALID_ORDER_STATUSES.includes(query.status as OrderStatus)
      ) {
        throw new AppError(
          400,
          'INVALID_FILTER',
          `status must be one of: ${VALID_ORDER_STATUSES.join(', ')}`,
        );
      }
      status = query.status as OrderStatus;
    }

    let paymentStatus: PaymentStatus | undefined;
    if (query.paymentStatus !== undefined) {
      if (
        typeof query.paymentStatus !== 'string' ||
        !VALID_PAYMENT_STATUSES.includes(query.paymentStatus as PaymentStatus)
      ) {
        throw new AppError(
          400,
          'INVALID_FILTER',
          `paymentStatus must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`,
        );
      }
      paymentStatus = query.paymentStatus as PaymentStatus;
    }

    let startDate: string | undefined;
    if (query.startDate !== undefined) {
      if (
        typeof query.startDate !== 'string' ||
        isNaN(Date.parse(query.startDate))
      ) {
        throw new AppError(
          400,
          'INVALID_DATE',
          'startDate must be a valid ISO date',
        );
      }
      startDate = query.startDate;
    }

    let endDate: string | undefined;
    if (query.endDate !== undefined) {
      if (
        typeof query.endDate !== 'string' ||
        isNaN(Date.parse(query.endDate))
      ) {
        throw new AppError(
          400,
          'INVALID_DATE',
          'endDate must be a valid ISO date',
        );
      }
      endDate = query.endDate;
    }

    if (startDate && endDate) {
      if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
        throw new AppError(
          400,
          'INVALID_DATE_RANGE',
          'startDate must be before or equal to endDate',
        );
      }
    }

    let sortBy: ListCustomerOrdersParams['sortBy'] = 'createdAt';
    if (query.sortBy !== undefined) {
      if (query.sortBy !== 'createdAt' && query.sortBy !== 'total') {
        throw new AppError(
          400,
          'INVALID_SORT_FIELD',
          "sortBy must be either 'createdAt' or 'total'",
        );
      }
      sortBy = query.sortBy as ListCustomerOrdersParams['sortBy'];
    }

    let sortOrder: 'asc' | 'desc' = 'desc';
    if (query.sortOrder !== undefined) {
      if (query.sortOrder !== 'asc' && query.sortOrder !== 'desc') {
        throw new AppError(
          400,
          'INVALID_SORT_ORDER',
          "sortOrder must be 'asc' or 'desc'",
        );
      }
      sortOrder = query.sortOrder;
    }

    const result = await this.repository.listCustomerOrders(customer.id, {
      page,
      limit,
      status,
      paymentStatus,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    });

    const totalPages = Math.ceil(result.total / limit);

    return {
      items: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
      },
    };
  }
}
