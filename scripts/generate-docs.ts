import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const docsDir = path.resolve(process.cwd(), 'docs');
const postmanDir = path.resolve(docsDir, 'postman');

fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(postmanDir, { recursive: true });

// ============================================================================
// 1. OPENAPI 3.1 SPECIFICATION
// ============================================================================

const openapiSpec: Record<string, unknown> = {
  openapi: '3.1.0',
  info: {
    title: 'Liquor Shop E-Commerce Backend API',
    version: '1.0.0',
    description: `Complete, production-ready REST API documentation for the Liquor Shop backend.
Provides endpoints for guest cart and checkout, inventory control, catalog management (Categories, Brands, Products), order fulfillment, offline/QR payment verification, promotions, customer history, business settings, promotional banners, gallery showcases, and social media links.

### Key Architecture Features
- **Guest Checkout**: Fast guest checkout without requiring user accounts or registration passwords.
- **RBAC Security**: Bearer JWT tokens (HS256) with strict role/permission checks and Argon2id password hashing.
- **Display Ordering**: Persistent manual drag-and-drop ordering restricted strictly to **Brands** and **Banners**. Categories, Products, Gallery, and Social Media deliberately omit reordering endpoints (returning HTTP 404).
- **Audit Trails**: Financial transactions, fulfillment status changes, and administrative actions create immutable audit logs.
- **Media Safety**: Cloudinary integration enforces reference protection, preventing deletion of assets currently in use.`,
    contact: {
      name: 'Liquor Shop Engineering Team',
      email: 'engineering@oldliquor.test',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development server' },
    { url: 'https://api.oldliquor.com', description: 'Production server' },
  ],
  tags: [
    { name: 'Health & System', description: 'Readiness and liveness probes' },
    {
      name: 'Admin Auth',
      description: 'Administrator authentication and identity',
    },
    {
      name: 'Admin Management',
      description: 'Admin user accounts, roles, and permissions',
    },
    {
      name: 'Categories',
      description: 'Product categories (Storefront & Admin)',
    },
    {
      name: 'Brands',
      description: 'Product brands and brand display reordering',
    },
    { name: 'Products', description: 'Products, variants, and product images' },
    {
      name: 'Inventory',
      description: 'Stock adjustments and movement audit trail',
    },
    { name: 'Cart', description: 'Guest session cart management' },
    {
      name: 'Checkout & Orders',
      description: 'Guest checkout and public tokenized order lookup',
    },
    {
      name: 'Payment Methods',
      description: 'Store payment options (COD, Static QR)',
    },
    {
      name: 'Payment Submissions',
      description: 'Customer payment proof submission and admin verification',
    },
    {
      name: 'Order Management',
      description: 'Admin order fulfillment pipeline and status history',
    },
    { name: 'Audit Logs', description: 'Immutable administrative audit trail' },
    {
      name: 'Dashboard & Analytics',
      description: 'Sales charts, operational metrics, and best-sellers',
    },
    {
      name: 'Customers',
      description: 'Customer profiles and guest order histories',
    },
    {
      name: 'Contact Inquiries',
      description: 'Storefront inquiries and admin response workflow',
    },
    {
      name: 'Banners',
      description: 'Promotional storefront banners and banner reordering',
    },
    { name: 'Gallery', description: 'Store visual gallery items' },
    {
      name: 'Store Settings',
      description:
        'Public storefront details, business hours, and announcements',
    },
    {
      name: 'Social Media',
      description:
        'Social platform links, video showcases, and profile handles',
    },
    {
      name: 'Promo Codes',
      description: 'Discount coupons and promotional codes',
    },
    {
      name: 'Media Uploads',
      description: 'Cloudinary media upload and reference-safe deletion',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Provide admin access token obtained from `POST /api/admin/auth/login`.',
      },
    },
    schemas: {
      SuccessEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: {
            type: 'string',
            example: 'Operation completed successfully',
          },
          data: { type: 'object' },
        },
        required: ['success', 'message', 'data'],
      },
      ErrorEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid request payload' },
              details: { type: 'object' },
              requestId: {
                type: 'string',
                example: 'c0a80101-0000-0000-0000-000000000001',
              },
            },
            required: ['code', 'message'],
          },
        },
        required: ['success', 'error'],
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          pageSize: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 45 },
          totalPages: { type: 'integer', example: 3 },
        },
        required: ['page', 'pageSize', 'total', 'totalPages'],
      },
      AdminLoginRequest: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'superadmin@liquor.test',
          },
          password: {
            type: 'string',
            minLength: 1,
            example: 'SuperAdminSecret123!',
          },
        },
        required: ['email', 'password'],
      },
      AdminLoginResponse: {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
          admin: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                example: '10000000-0000-4000-8000-000000000001',
              },
              email: { type: 'string', example: 'superadmin@liquor.test' },
              name: { type: 'string', example: 'System Administrator' },
              role: { type: 'string', example: 'Super Administrator' },
              permissions: {
                type: 'array',
                items: { type: 'string' },
                example: ['admin.system.manage'],
              },
            },
            required: ['id', 'email', 'name', 'role', 'permissions'],
          },
        },
        required: ['token', 'admin'],
      },
      Category: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '20000000-0000-4000-8000-000000000001',
          },
          name: { type: 'string', example: 'Single Malt Whisky' },
          slug: { type: 'string', example: 'single-malt-whisky' },
          description: {
            type: 'string',
            nullable: true,
            example: 'Distilled single malt selection',
          },
          imageUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            example: 'https://res.cloudinary.com/demo/image/upload/cat.jpg',
          },
          displayOrder: { type: 'integer', example: 0 },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: [
          'id',
          'name',
          'slug',
          'displayOrder',
          'isActive',
          'createdAt',
          'updatedAt',
        ],
      },
      Brand: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '30000000-0000-4000-8000-000000000001',
          },
          name: { type: 'string', example: 'The Macallan' },
          slug: { type: 'string', example: 'the-macallan' },
          logoUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            example:
              'https://res.cloudinary.com/demo/image/upload/macallan.png',
          },
          displayOrder: { type: 'integer', example: 0 },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: [
          'id',
          'name',
          'slug',
          'displayOrder',
          'isActive',
          'createdAt',
          'updatedAt',
        ],
      },
      ReorderPayload: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid',
                  example: '30000000-0000-4000-8000-000000000001',
                },
                displayOrder: { type: 'integer', minimum: 0, example: 0 },
              },
              required: ['id', 'displayOrder'],
            },
            minItems: 1,
          },
        },
        required: ['items'],
      },
      Product: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '40000000-0000-4000-8000-000000000001',
          },
          name: { type: 'string', example: 'Macallan 12 Year Double Cask' },
          slug: { type: 'string', example: 'macallan-12-year-double-cask' },
          categoryId: { type: 'string', format: 'uuid' },
          brandId: { type: 'string', format: 'uuid' },
          description: {
            type: 'string',
            nullable: true,
            example: 'Rich honey, citrus and ginger notes.',
          },
          discountType: {
            type: 'string',
            enum: ['PERCENTAGE', 'FIXED'],
            nullable: true,
            example: 'PERCENTAGE',
          },
          discountValue: { type: 'string', nullable: true, example: '10.00' },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: [
          'id',
          'name',
          'slug',
          'categoryId',
          'brandId',
          'isActive',
          'createdAt',
          'updatedAt',
        ],
      },
      ProductVariant: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '50000000-0000-4000-8000-000000000001',
          },
          productId: { type: 'string', format: 'uuid' },
          sku: { type: 'string', example: 'MAC-12-750ML' },
          sizeLabel: { type: 'string', example: '750 ml' },
          sizeMilliliters: { type: 'integer', example: 750 },
          purchasePrice: { type: 'string', example: '12000.00' },
          sellingPrice: { type: 'string', example: '15500.00' },
          stock: { type: 'integer', example: 45 },
          lowStockThreshold: { type: 'integer', example: 5 },
          isActive: { type: 'boolean', example: true },
        },
        required: [
          'id',
          'productId',
          'sku',
          'sizeLabel',
          'sizeMilliliters',
          'sellingPrice',
          'stock',
          'lowStockThreshold',
          'isActive',
        ],
      },
      Cart: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'cart_9b1deb4d3b7d4e89' },
          itemCount: { type: 'integer', example: 2 },
          subtotal: { type: 'string', example: '31000.00' },
          discountTotal: { type: 'string', example: '3100.00' },
          total: { type: 'string', example: '27900.00' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                variantId: { type: 'string', format: 'uuid' },
                productId: { type: 'string', format: 'uuid' },
                name: {
                  type: 'string',
                  example: 'Macallan 12 Year Double Cask',
                },
                sizeLabel: { type: 'string', example: '750 ml' },
                unitPrice: { type: 'string', example: '15500.00' },
                effectiveUnitPrice: { type: 'string', example: '13950.00' },
                quantity: { type: 'integer', example: 2 },
                subtotal: { type: 'string', example: '27900.00' },
              },
            },
          },
        },
        required: ['token', 'itemCount', 'subtotal', 'total', 'items'],
      },
      CheckoutRequest: {
        type: 'object',
        properties: {
          customer: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Bikash Adhikari' },
              phone: { type: 'string', example: '+977-9841234567' },
              deliveryAddress: {
                type: 'string',
                example: 'House 42, Thamel Ward 26, Kathmandu',
              },
              email: {
                type: 'string',
                format: 'email',
                nullable: true,
                example: 'bikash@example.com',
              },
              coordinates: {
                type: 'object',
                nullable: true,
                properties: {
                  latitude: { type: 'number', example: 27.7172 },
                  longitude: { type: 'number', example: 85.324 },
                },
              },
            },
            required: ['name', 'phone', 'deliveryAddress'],
          },
          cartId: {
            type: 'string',
            nullable: true,
            example: 'cart_9b1deb4d3b7d4e89',
          },
          paymentMethodCode: { type: 'string', example: 'CASH_ON_DELIVERY' },
          promoCode: { type: 'string', nullable: true, example: 'WELCOME10' },
          idempotencyKey: {
            type: 'string',
            nullable: true,
            example: 'idem-20261012-001',
          },
        },
        required: ['customer'],
      },
      OrderSummary: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderNumber: { type: 'string', example: 'ORD-20261012-A1B2C3' },
          orderLookupToken: {
            type: 'string',
            example: 'sec_tok_b92f7e4a1c6e8...',
          },
          customerName: { type: 'string', example: 'Bikash Adhikari' },
          customerPhone: { type: 'string', example: '+977-9841234567' },
          deliveryAddress: {
            type: 'string',
            example: 'House 42, Thamel Ward 26, Kathmandu',
          },
          subtotal: { type: 'string', example: '31000.00' },
          discountTotal: { type: 'string', example: '3100.00' },
          deliveryFee: { type: 'string', example: '100.00' },
          total: { type: 'string', example: '28000.00' },
          status: { type: 'string', example: 'PENDING' },
          paymentStatus: { type: 'string', example: 'UNPAID' },
        },
        required: [
          'id',
          'orderNumber',
          'orderLookupToken',
          'subtotal',
          'total',
          'status',
        ],
      },
      Banner: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Dashain Festive Offer' },
          description: {
            type: 'string',
            nullable: true,
            example: 'Enjoy up to 20% off on premium whiskies',
          },
          imageUrl: {
            type: 'string',
            format: 'uri',
            example:
              'https://res.cloudinary.com/demo/image/upload/festive_banner.jpg',
          },
          linkUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            example: 'https://oldliquor.com/promo',
          },
          displayOrder: { type: 'integer', example: 0 },
          isActive: { type: 'boolean', example: true },
          startDate: { type: 'string', format: 'date-time', nullable: true },
          endDate: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'title', 'imageUrl', 'displayOrder', 'isActive'],
      },
      PaymentMethod: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string', example: 'STATIC_QR' },
          type: {
            type: 'string',
            enum: ['COD', 'STATIC_QR'],
            example: 'STATIC_QR',
          },
          name: { type: 'string', example: 'Fonepay / eSewa QR' },
          providerLabel: { type: 'string', nullable: true, example: 'Fonepay' },
          accountName: {
            type: 'string',
            nullable: true,
            example: 'Old Liquor Shop Pvt Ltd',
          },
          accountNumber: {
            type: 'string',
            nullable: true,
            example: '9841234567',
          },
          qrImageUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            example:
              'https://res.cloudinary.com/demo/image/upload/fonepay_qr.png',
          },
          instructions: {
            type: 'string',
            nullable: true,
            example: 'Scan QR and submit payment screenshot',
          },
          minAmount: { type: 'string', nullable: true, example: '100.00' },
          maxAmount: { type: 'string', nullable: true, example: '100000.00' },
          displayOrder: { type: 'integer', example: 0 },
          isActive: { type: 'boolean', example: true },
        },
        required: ['id', 'code', 'type', 'name', 'isActive'],
      },
      PaymentSubmission: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderId: { type: 'string', format: 'uuid' },
          orderNumber: { type: 'string', example: 'ORD-20261012-A1B2C3' },
          proofImageUrl: {
            type: 'string',
            format: 'uri',
            example:
              'https://res.cloudinary.com/demo/image/upload/receipt_123.jpg',
          },
          transactionReference: {
            type: 'string',
            nullable: true,
            example: 'FPAY-982341',
          },
          customerNotes: {
            type: 'string',
            nullable: true,
            example: 'Paid via Nabil Mobile Banking',
          },
          status: {
            type: 'string',
            enum: ['PENDING', 'APPROVED', 'REJECTED'],
            example: 'PENDING',
          },
          rejectionReason: { type: 'string', nullable: true },
          reviewedAt: { type: 'string', format: 'date-time', nullable: true },
          reviewedByAdminId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: [
          'id',
          'orderId',
          'orderNumber',
          'proofImageUrl',
          'status',
          'createdAt',
        ],
      },
      StoreSettings: {
        type: 'object',
        properties: {
          storeName: { type: 'string', example: 'Old Liquor Shop' },
          storeTagline: {
            type: 'string',
            nullable: true,
            example: 'Premium Wines & Spirits in Kathmandu',
          },
          primaryPhone: { type: 'string', example: '+977-9841234567' },
          secondaryPhone: {
            type: 'string',
            nullable: true,
            example: '+977-1-4412345',
          },
          supportEmail: {
            type: 'string',
            format: 'email',
            example: 'support@oldliquor.com',
          },
          address: { type: 'string', example: 'Tridevi Marg, Thamel Ward 26' },
          city: { type: 'string', example: 'Kathmandu' },
          locationUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            example: 'https://maps.google.com/?q=27.7172,85.3240',
          },
          timezone: { type: 'string', example: 'Asia/Kathmandu' },
          businessHours: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: {
                  type: 'string',
                  enum: [
                    'MONDAY',
                    'TUESDAY',
                    'WEDNESDAY',
                    'THURSDAY',
                    'FRIDAY',
                    'SATURDAY',
                    'SUNDAY',
                  ],
                },
                isOpen: { type: 'boolean', example: true },
                openTime: { type: 'string', nullable: true, example: '10:00' },
                closeTime: { type: 'string', nullable: true, example: '22:00' },
              },
            },
          },
          announcementText: {
            type: 'string',
            nullable: true,
            example:
              'Same-day delivery available across Kathmandu valley until 9 PM.',
          },
          announcementActive: { type: 'boolean', example: true },
          announcementStartDate: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          announcementEndDate: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
        required: [
          'storeName',
          'primaryPhone',
          'supportEmail',
          'address',
          'city',
          'timezone',
        ],
      },
      SocialMediaItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          platform: { type: 'string', example: 'INSTAGRAM' },
          type: {
            type: 'string',
            enum: ['video', 'profile'],
            example: 'video',
          },
          url: {
            type: 'string',
            format: 'uri',
            example: 'https://instagram.com/reel/C8xyz123',
          },
          label: {
            type: 'string',
            nullable: true,
            example: 'Cocktail Masterclass Reel',
          },
          thumbnailUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            example: 'https://res.cloudinary.com/demo/image/upload/thumb.jpg',
          },
          displayOrder: { type: 'integer', example: 0 },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: [
          'id',
          'platform',
          'type',
          'url',
          'displayOrder',
          'isActive',
          'createdAt',
          'updatedAt',
        ],
      },
      PromoCode: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string', example: 'WELCOME10' },
          description: {
            type: 'string',
            nullable: true,
            example: 'Flat 10 dollars off for welcome orders',
          },
          discountType: {
            type: 'string',
            enum: ['PERCENTAGE', 'FIXED'],
            example: 'FIXED',
          },
          discountValue: { type: 'string', example: '10.00' },
          minimumOrderAmount: {
            type: 'string',
            nullable: true,
            example: '50.00',
          },
          maxDiscountAmount: { type: 'string', nullable: true },
          startDate: { type: 'string', format: 'date-time', nullable: true },
          endDate: { type: 'string', format: 'date-time', nullable: true },
          usageLimit: { type: 'integer', nullable: true, example: 100 },
          usedCount: { type: 'integer', example: 12 },
          isActive: { type: 'boolean', example: true },
        },
        required: ['id', 'code', 'discountType', 'discountValue', 'isActive'],
      },
      ContactInquiry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Prakash Sharma' },
          phone: { type: 'string', example: '+977-9841234567' },
          email: {
            type: 'string',
            format: 'email',
            nullable: true,
            example: 'prakash@example.com',
          },
          subject: { type: 'string', example: 'Corporate Order Inquiry' },
          message: {
            type: 'string',
            example:
              'Requesting quotation for 50 cases of single malt for corporate event.',
          },
          status: {
            type: 'string',
            enum: ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
            example: 'NEW',
          },
          adminNote: { type: 'string', nullable: true },
          resolvedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: [
          'id',
          'name',
          'phone',
          'subject',
          'message',
          'status',
          'createdAt',
        ],
      },
    },
  },
  paths: {},
};

function okResponse(schemaRef: string, description = 'Operation successful') {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/SuccessEnvelope' },
            {
              type: 'object',
              properties: {
                data: { $ref: schemaRef },
              },
            },
          ],
        },
      },
    },
  };
}

function genericOkResponse(
  dataSchema: unknown,
  description = 'Operation successful',
) {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/SuccessEnvelope' },
            {
              type: 'object',
              properties: {
                data: dataSchema,
              },
            },
          ],
        },
      },
    },
  };
}

function errorResponse(status: number, code: string, message: string) {
  return {
    description: message,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        example: {
          success: false,
          error: {
            code,
            message,
            requestId: 'req-20261012-001',
          },
        },
      },
    },
  };
}

const p = openapiSpec.paths;

// System & Probes
p['/api/health/live'] = {
  get: {
    tags: ['Health & System'],
    summary: 'Liveness probe',
    description: 'Returns HTTP 200 if Node.js process is responsive.',
    responses: {
      '200': genericOkResponse({
        type: 'object',
        properties: { status: { type: 'string', example: 'ok' } },
      }),
    },
  },
};
p['/api/health/ready'] = {
  get: {
    tags: ['Health & System'],
    summary: 'Readiness probe',
    description:
      'Queries PostgreSQL database. Returns 200 when ready, 503 if database check fails.',
    responses: {
      '200': genericOkResponse({
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ready' },
          database: { type: 'string', example: 'connected' },
        },
      }),
      '503': errorResponse(
        503,
        'DATABASE_UNAVAILABLE',
        'Database is not available',
      ),
    },
  },
};

// Admin Auth
p['/api/admin/auth/login'] = {
  post: {
    tags: ['Admin Auth'],
    summary: 'Administrator login',
    description:
      'Authenticates administrator via email and password. Protected by login rate limiter (5 requests / 15 min).',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/AdminLoginRequest' },
        },
      },
    },
    responses: {
      '200': okResponse(
        '#/components/schemas/AdminLoginResponse',
        'Login successful',
      ),
      '400': errorResponse(
        400,
        'VALIDATION_ERROR',
        'Validation error in email or password',
      ),
      '401': errorResponse(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      ),
      '429': errorResponse(
        429,
        'RATE_LIMITED',
        'Too many login attempts; try again later',
      ),
    },
  },
};
p['/api/admin/auth/me'] = {
  get: {
    tags: ['Admin Auth'],
    summary: 'Get current admin identity and permissions',
    security: [{ BearerAuth: [] }],
    responses: {
      '200': genericOkResponse({
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string' },
          permissions: { type: 'array', items: { type: 'string' } },
        },
      }),
      '401': errorResponse(
        401,
        'UNAUTHORIZED',
        'Missing or invalid bearer token',
      ),
    },
  },
};

// Admin Management
p['/api/admin/users'] = {
  get: {
    tags: ['Admin Management'],
    summary: 'List admin users',
    description: 'Requires `admin.users.read`.',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      {
        name: 'pageSize',
        in: 'query',
        schema: { type: 'integer', default: 20 },
      },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  post: {
    tags: ['Admin Management'],
    summary: 'Create new administrator',
    description: 'Requires `admin.users.create`.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              name: { type: 'string' },
              password: { type: 'string', minLength: 16 },
              roleId: { type: 'string', format: 'uuid' },
            },
            required: ['email', 'name', 'password', 'roleId'],
          },
        },
      },
    },
    responses: { '201': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/users/{id}'] = {
  get: {
    tags: ['Admin Management'],
    summary: 'Get admin user by ID',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  patch: {
    tags: ['Admin Management'],
    summary: 'Update admin user',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/users/{id}/status'] = {
  patch: {
    tags: ['Admin Management'],
    summary: 'Set admin active status',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { isActive: { type: 'boolean' } },
            required: ['isActive'],
          },
        },
      },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/users/{id}/password'] = {
  patch: {
    tags: ['Admin Management'],
    summary: 'Reset admin password',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { password: { type: 'string', minLength: 16 } },
            required: ['password'],
          },
        },
      },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/roles'] = {
  get: {
    tags: ['Admin Management'],
    summary: 'List admin roles',
    security: [{ BearerAuth: [] }],
    responses: {
      '200': genericOkResponse({ type: 'array', items: { type: 'object' } }),
    },
  },
  post: {
    tags: ['Admin Management'],
    summary: 'Create admin role',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              isActive: { type: 'boolean' },
            },
            required: ['name', 'isActive'],
          },
        },
      },
    },
    responses: { '201': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/roles/{id}'] = {
  get: {
    tags: ['Admin Management'],
    summary: 'Get role by ID',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  patch: {
    tags: ['Admin Management'],
    summary: 'Update role details',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/roles/{id}/permissions'] = {
  put: {
    tags: ['Admin Management'],
    summary: 'Replace all permissions assigned to a role',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              permissionKeys: { type: 'array', items: { type: 'string' } },
            },
            required: ['permissionKeys'],
          },
        },
      },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/roles/{id}/permissions/{permissionKey}'] = {
  delete: {
    tags: ['Admin Management'],
    summary: 'Remove specific permission from role',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'permissionKey',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/permissions'] = {
  get: {
    tags: ['Admin Management'],
    summary: 'List all available system permissions',
    security: [{ BearerAuth: [] }],
    responses: {
      '200': genericOkResponse({ type: 'array', items: { type: 'object' } }),
    },
  },
};

// Categories
p['/api/catalog/categories'] = {
  get: {
    tags: ['Categories'],
    summary: 'List active storefront categories',
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      {
        name: 'pageSize',
        in: 'query',
        schema: { type: 'integer', default: 20 },
      },
      { name: 'q', in: 'query', schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/categories'] = {
  get: {
    tags: ['Categories'],
    summary: 'Admin list categories with filters',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      {
        name: 'pageSize',
        in: 'query',
        schema: { type: 'integer', default: 20 },
      },
      { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
      { name: 'q', in: 'query', schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  post: {
    tags: ['Categories'],
    summary: 'Create category',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              slug: { type: 'string' },
              description: { type: 'string', nullable: true },
              imageUrl: { type: 'string', format: 'uri', nullable: true },
              displayOrder: { type: 'integer', default: 0 },
              isActive: { type: 'boolean', default: true },
            },
            required: ['name', 'slug'],
          },
        },
      },
    },
    responses: { '201': okResponse('#/components/schemas/Category') },
  },
};
p['/api/admin/categories/{id}'] = {
  get: {
    tags: ['Categories'],
    summary: 'Get category details',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': okResponse('#/components/schemas/Category') },
  },
  put: {
    tags: ['Categories'],
    summary: 'Update category (replace)',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': okResponse('#/components/schemas/Category') },
  },
  patch: {
    tags: ['Categories'],
    summary: 'Update category (partial)',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': okResponse('#/components/schemas/Category') },
  },
  delete: {
    tags: ['Categories'],
    summary: 'Delete category',
    description: 'Rejects with 409 if active products reference this category.',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};

// Brands
p['/api/catalog/brands'] = {
  get: {
    tags: ['Brands'],
    summary: 'List active storefront brands',
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/brands'] = {
  get: {
    tags: ['Brands'],
    summary: 'Admin list brands',
    security: [{ BearerAuth: [] }],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  post: {
    tags: ['Brands'],
    summary: 'Create brand',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              slug: { type: 'string' },
              logoUrl: { type: 'string', format: 'uri', nullable: true },
              displayOrder: { type: 'integer', default: 0 },
              isActive: { type: 'boolean', default: true },
            },
            required: ['name', 'slug'],
          },
        },
      },
    },
    responses: { '201': okResponse('#/components/schemas/Brand') },
  },
};
p['/api/admin/brands/reorder'] = {
  put: {
    tags: ['Brands'],
    summary: 'Persist drag-and-drop brand display order',
    description:
      'Requires `catalog.brands.update`. Persists displayOrder atomically in a transaction and creates an audit log.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ReorderPayload' },
        },
      },
    },
    responses: {
      '200': genericOkResponse({
        type: 'object',
        properties: { reordered: { type: 'boolean', example: true } },
      }),
      '400': errorResponse(
        400,
        'VALIDATION_ERROR',
        'Duplicate IDs or negative displayOrder',
      ),
      '404': errorResponse(404, 'NOT_FOUND', 'One or more brand IDs not found'),
    },
  },
};
p['/api/admin/brands/{id}'] = {
  get: {
    tags: ['Brands'],
    summary: 'Get brand details',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': okResponse('#/components/schemas/Brand') },
  },
  put: {
    tags: ['Brands'],
    summary: 'Update brand (replace)',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': okResponse('#/components/schemas/Brand') },
  },
  patch: {
    tags: ['Brands'],
    summary: 'Update brand (partial)',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': okResponse('#/components/schemas/Brand') },
  },
  delete: {
    tags: ['Brands'],
    summary: 'Delete brand',
    description: 'Rejects with 409 if products reference this brand.',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};

// Products
p['/api/catalog/products'] = {
  get: {
    tags: ['Products'],
    summary: 'Public storefront product list',
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      {
        name: 'pageSize',
        in: 'query',
        schema: { type: 'integer', default: 20 },
      },
      { name: 'q', in: 'query', schema: { type: 'string' } },
      {
        name: 'categoryId',
        in: 'query',
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'brandId',
        in: 'query',
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'sortBy',
        in: 'query',
        schema: {
          type: 'string',
          enum: ['name_asc', 'name_desc', 'newest', 'price_asc', 'price_desc'],
        },
      },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/catalog/products/{id}'] = {
  get: {
    tags: ['Products'],
    summary: 'Public storefront product detail (by ID or Slug)',
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': okResponse('#/components/schemas/Product') },
  },
};
p['/api/admin/products'] = {
  get: {
    tags: ['Products'],
    summary: 'Admin list products with inventory counts',
    security: [{ BearerAuth: [] }],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  post: {
    tags: ['Products'],
    summary: 'Create product',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              categoryId: { type: 'string', format: 'uuid' },
              brandId: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              slug: { type: 'string' },
              description: { type: 'string', nullable: true },
              discountType: {
                type: 'string',
                enum: ['PERCENTAGE', 'FIXED'],
                nullable: true,
              },
              discountValue: { type: 'string', nullable: true },
              isActive: { type: 'boolean', default: true },
            },
            required: ['categoryId', 'brandId', 'name', 'slug'],
          },
        },
      },
    },
    responses: { '201': okResponse('#/components/schemas/Product') },
  },
};
p['/api/admin/products/{id}'] = {
  get: {
    tags: ['Products'],
    summary: 'Admin get product details',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': okResponse('#/components/schemas/Product') },
  },
  patch: {
    tags: ['Products'],
    summary: 'Update product',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': okResponse('#/components/schemas/Product') },
  },
  delete: {
    tags: ['Products'],
    summary: 'Deactivate product safely',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/products/{id}/variants'] = {
  get: {
    tags: ['Products'],
    summary: 'List variants of a product',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      '200': genericOkResponse({
        type: 'array',
        items: { $ref: '#/components/schemas/ProductVariant' },
      }),
    },
  },
  post: {
    tags: ['Products'],
    summary: 'Add product variant',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              sku: { type: 'string' },
              size: { type: 'string', example: '750 ml' },
              purchasePrice: { type: 'number' },
              sellingPrice: { type: 'number' },
              stock: { type: 'integer', default: 0 },
              lowStockThreshold: { type: 'integer', default: 5 },
              isActive: { type: 'boolean', default: true },
            },
            required: ['sku', 'size', 'purchasePrice', 'sellingPrice'],
          },
        },
      },
    },
    responses: { '201': okResponse('#/components/schemas/ProductVariant') },
  },
};
p['/api/admin/products/{id}/variants/{variantId}'] = {
  get: {
    tags: ['Products'],
    summary: 'Get variant details',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'variantId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': okResponse('#/components/schemas/ProductVariant') },
  },
  patch: {
    tags: ['Products'],
    summary: 'Update variant',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'variantId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': okResponse('#/components/schemas/ProductVariant') },
  },
  delete: {
    tags: ['Products'],
    summary: 'Deactivate variant safely',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'variantId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/products/{id}/images'] = {
  get: {
    tags: ['Products'],
    summary: 'List product images',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      '200': genericOkResponse({ type: 'array', items: { type: 'object' } }),
    },
  },
  post: {
    tags: ['Products'],
    summary: 'Attach image metadata to product',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              imageUrl: { type: 'string', format: 'uri' },
              publicId: { type: 'string', nullable: true },
              altText: { type: 'string', nullable: true },
              sortOrder: { type: 'integer', default: 0 },
            },
            required: ['imageUrl'],
          },
        },
      },
    },
    responses: { '201': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/products/{id}/images/{imageId}'] = {
  patch: {
    tags: ['Products'],
    summary: 'Update product image sortOrder / alt text',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'imageId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  delete: {
    tags: ['Products'],
    summary: 'Remove product image reference',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'imageId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};

// Inventory
p['/api/admin/inventory/adjustments'] = {
  post: {
    tags: ['Inventory'],
    summary: 'Record stock adjustment and inventory movement',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              variantId: { type: 'string', format: 'uuid' },
              quantityDelta: { type: 'integer', example: 10 },
              type: {
                type: 'string',
                enum: [
                  'RESTOCK',
                  'DAMAGE',
                  'RETURN_RESTOCK',
                  'CORRECTION',
                  'INTERNAL_USE',
                ],
              },
              reason: {
                type: 'string',
                example: 'Shipment received from distributor',
              },
            },
            required: ['variantId', 'quantityDelta', 'type', 'reason'],
          },
        },
      },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/inventory/movements'] = {
  get: {
    tags: ['Inventory'],
    summary: 'Audit log of stock movements (SALE, RESTOCK, etc.)',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'variantId',
        in: 'query',
        schema: { type: 'string', format: 'uuid' },
      },
      { name: 'type', in: 'query', schema: { type: 'string' } },
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/inventory/low-stock'] = {
  get: {
    tags: ['Inventory'],
    summary: 'List variants at or below low-stock threshold',
    security: [{ BearerAuth: [] }],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};

// Cart
p['/api/cart'] = {
  get: {
    tags: ['Cart'],
    summary: 'Get or initialize guest session cart',
    parameters: [
      { name: 'X-Cart-Id', in: 'header', schema: { type: 'string' } },
    ],
    responses: {
      '200': genericOkResponse({ $ref: '#/components/schemas/Cart' }),
    },
  },
  delete: {
    tags: ['Cart'],
    summary: 'Clear guest cart',
    parameters: [
      {
        name: 'X-Cart-Id',
        in: 'header',
        required: true,
        schema: { type: 'string' },
      },
    ],
    responses: {
      '200': genericOkResponse({ $ref: '#/components/schemas/Cart' }),
    },
  },
};
p['/api/cart/items'] = {
  post: {
    tags: ['Cart'],
    summary: 'Add item to guest cart',
    parameters: [
      { name: 'X-Cart-Id', in: 'header', schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              variantId: { type: 'string', format: 'uuid' },
              quantity: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 1,
              },
            },
            required: ['variantId'],
          },
        },
      },
    },
    responses: {
      '200': genericOkResponse({ $ref: '#/components/schemas/Cart' }),
    },
  },
};
p['/api/cart/items/{variantId}'] = {
  patch: {
    tags: ['Cart'],
    summary: 'Update item quantity in cart',
    parameters: [
      {
        name: 'X-Cart-Id',
        in: 'header',
        required: true,
        schema: { type: 'string' },
      },
      {
        name: 'variantId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              quantity: { type: 'integer', minimum: 0, maximum: 100 },
            },
            required: ['quantity'],
          },
        },
      },
    },
    responses: {
      '200': genericOkResponse({ $ref: '#/components/schemas/Cart' }),
    },
  },
  delete: {
    tags: ['Cart'],
    summary: 'Remove item from cart',
    parameters: [
      {
        name: 'X-Cart-Id',
        in: 'header',
        required: true,
        schema: { type: 'string' },
      },
      {
        name: 'variantId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      '200': genericOkResponse({ $ref: '#/components/schemas/Cart' }),
    },
  },
};

// Checkout & Orders
p['/api/checkout'] = {
  post: {
    tags: ['Checkout & Orders'],
    summary: 'Place order via guest checkout',
    parameters: [
      { name: 'X-Cart-Id', in: 'header', schema: { type: 'string' } },
      { name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CheckoutRequest' },
        },
      },
    },
    responses: {
      '201': okResponse('#/components/schemas/OrderSummary'),
      '400': errorResponse(
        400,
        'INSUFFICIENT_STOCK',
        'Insufficient stock or inactive variant',
      ),
    },
  },
};
p['/api/orders/{orderNumber}'] = {
  get: {
    tags: ['Checkout & Orders'],
    summary: 'Public guest order status lookup (requires token)',
    parameters: [
      {
        name: 'orderNumber',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      { name: 'token', in: 'query', schema: { type: 'string' } },
      { name: 'x-order-token', in: 'header', schema: { type: 'string' } },
    ],
    responses: {
      '200': genericOkResponse({ type: 'object' }),
      '404': errorResponse(
        404,
        'NOT_FOUND',
        'Order not found or invalid lookup token',
      ),
    },
  },
};

// Payment Methods
p['/api/payment-methods'] = {
  get: {
    tags: ['Payment Methods'],
    summary: 'Public list active payment methods',
    responses: {
      '200': genericOkResponse({
        type: 'array',
        items: { $ref: '#/components/schemas/PaymentMethod' },
      }),
    },
  },
};
p['/api/admin/payment-methods'] = {
  get: {
    tags: ['Payment Methods'],
    summary: 'Admin list payment methods',
    security: [{ BearerAuth: [] }],
    responses: {
      '200': genericOkResponse({
        type: 'array',
        items: { $ref: '#/components/schemas/PaymentMethod' },
      }),
    },
  },
  post: {
    tags: ['Payment Methods'],
    summary: 'Create payment method',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '201': okResponse('#/components/schemas/PaymentMethod') },
  },
};
p['/api/admin/payment-methods/{id}'] = {
  get: {
    tags: ['Payment Methods'],
    summary: 'Get payment method detail',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': okResponse('#/components/schemas/PaymentMethod') },
  },
  patch: {
    tags: ['Payment Methods'],
    summary: 'Update payment method',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': okResponse('#/components/schemas/PaymentMethod') },
  },
};
p['/api/admin/payment-methods/{id}/status'] = {
  patch: {
    tags: ['Payment Methods'],
    summary: 'Toggle active status of payment method',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { isActive: { type: 'boolean' } },
            required: ['isActive'],
          },
        },
      },
    },
    responses: { '200': okResponse('#/components/schemas/PaymentMethod') },
  },
};

// Payment Submissions
p['/api/orders/{orderNumber}/payment-proof'] = {
  post: {
    tags: ['Payment Submissions'],
    summary: 'Submit payment proof for order',
    parameters: [
      {
        name: 'orderNumber',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              proofImageUrl: { type: 'string', format: 'uri' },
              transactionReference: { type: 'string', nullable: true },
              customerNotes: { type: 'string', nullable: true },
              orderLookupToken: { type: 'string' },
            },
            required: ['proofImageUrl'],
          },
        },
      },
    },
    responses: { '201': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/payment-submissions'] = {
  get: {
    tags: ['Payment Submissions'],
    summary: 'Admin list payment submissions for verification',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'status',
        in: 'query',
        schema: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
      },
      { name: 'orderNumber', in: 'query', schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/payment-submissions/{id}'] = {
  get: {
    tags: ['Payment Submissions'],
    summary: 'Get submission detail by ID',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': okResponse('#/components/schemas/PaymentSubmission') },
  },
};
p['/api/admin/payment-submissions/{id}/approve'] = {
  post: {
    tags: ['Payment Submissions'],
    summary: 'Approve payment submission (marks order PAID)',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/payment-submissions/{id}/reject'] = {
  post: {
    tags: ['Payment Submissions'],
    summary: 'Reject payment submission with reason',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { reason: { type: 'string', minLength: 3 } },
            required: ['reason'],
          },
        },
      },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/payment-submissions/{id}/review'] = {
  post: {
    tags: ['Payment Submissions'],
    summary: 'Review payment submission (APPROVE or REJECT)',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['APPROVE', 'REJECT'] },
              reason: { type: 'string' },
            },
            required: ['action'],
          },
        },
      },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};

// Order Management
p['/api/admin/orders'] = {
  get: {
    tags: ['Order Management'],
    summary: 'List admin orders with status & date filters',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'status', in: 'query', schema: { type: 'string' } },
      { name: 'paymentStatus', in: 'query', schema: { type: 'string' } },
      { name: 'orderNumber', in: 'query', schema: { type: 'string' } },
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/orders/{id}'] = {
  get: {
    tags: ['Order Management'],
    summary: 'Get full admin order details, snapshot items and pricing',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/orders/{id}/history'] = {
  get: {
    tags: ['Order Management'],
    summary: 'Get order fulfillment status history and audit events',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/orders/{id}/status'] = {
  patch: {
    tags: ['Order Management'],
    summary: 'Transition order fulfillment status',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: [
                  'PENDING',
                  'CONFIRMED',
                  'PROCESSING',
                  'OUT_FOR_DELIVERY',
                  'DELIVERED',
                  'CANCELLED',
                  'RETURNED',
                ],
              },
              reason: { type: 'string', nullable: true },
              expectedPreviousStatus: { type: 'string', nullable: true },
            },
            required: ['status'],
          },
        },
      },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};

// Audit Logs
p['/api/admin/audit-logs'] = {
  get: {
    tags: ['Audit Logs'],
    summary: 'Query immutable administrative audit logs',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      {
        name: 'pageSize',
        in: 'query',
        schema: { type: 'integer', default: 20 },
      },
      { name: 'action', in: 'query', schema: { type: 'string' } },
      { name: 'resourceType', in: 'query', schema: { type: 'string' } },
      { name: 'resourceId', in: 'query', schema: { type: 'string' } },
      {
        name: 'actorAdminId',
        in: 'query',
        schema: { type: 'string', format: 'uuid' },
      },
      { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
      { name: 'dateTo', in: 'query', schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};

// Dashboard & Analytics
p['/api/admin/dashboard/summary'] = {
  get: {
    tags: ['Dashboard & Analytics'],
    summary:
      'High-level operational metrics (total orders, revenue, today orders)',
    security: [{ BearerAuth: [] }],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/dashboard/sales'] = {
  get: {
    tags: ['Dashboard & Analytics'],
    summary: 'Sales time series grouped by day, week, or month',
    security: [{ BearerAuth: [] }],
    parameters: [
      {
        name: 'groupBy',
        in: 'query',
        schema: {
          type: 'string',
          enum: ['day', 'week', 'month'],
          default: 'day',
        },
      },
      { name: 'startDate', in: 'query', schema: { type: 'string' } },
      { name: 'endDate', in: 'query', schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/dashboard/order-status-breakdown'] = {
  get: {
    tags: ['Dashboard & Analytics'],
    summary: 'Order distribution across statuses',
    security: [{ BearerAuth: [] }],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/dashboard/top-products'] = {
  get: {
    tags: ['Dashboard & Analytics'],
    summary: 'Best selling products ranked by volume and revenue',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/dashboard/low-stock'] = {
  get: {
    tags: ['Dashboard & Analytics'],
    summary: 'Low-stock catalog alert summary',
    security: [{ BearerAuth: [] }],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};

// Customers
p['/api/admin/customers'] = {
  get: {
    tags: ['Customers'],
    summary: 'Paginated customer list with aggregated order count and spend',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'search', in: 'query', schema: { type: 'string' } },
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/customers/{id}'] = {
  get: {
    tags: ['Customers'],
    summary: 'Get customer profile and recent order summary',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/customers/{id}/orders'] = {
  get: {
    tags: ['Customers'],
    summary: 'Get full order history for a specific customer',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};

// Contact Inquiries
p['/api/contact'] = {
  post: {
    tags: ['Contact Inquiries'],
    summary: 'Submit public customer inquiry',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              phone: { type: 'string' },
              email: { type: 'string', format: 'email', nullable: true },
              subject: { type: 'string' },
              message: { type: 'string' },
            },
            required: ['name', 'phone', 'subject', 'message'],
          },
        },
      },
    },
    responses: { '201': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/contact-inquiries'] = {
  get: {
    tags: ['Contact Inquiries'],
    summary: 'Admin list contact inquiries',
    security: [{ BearerAuth: [] }],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/contact-inquiries/{id}'] = {
  get: {
    tags: ['Contact Inquiries'],
    summary: 'Get inquiry details',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': okResponse('#/components/schemas/ContactInquiry') },
  },
  delete: {
    tags: ['Contact Inquiries'],
    summary: 'Delete inquiry',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/contact-inquiries/{id}/status'] = {
  patch: {
    tags: ['Contact Inquiries'],
    summary: 'Update inquiry status and admin note',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
              },
              adminNote: { type: 'string', nullable: true },
            },
            required: ['status'],
          },
        },
      },
    },
    responses: { '200': okResponse('#/components/schemas/ContactInquiry') },
  },
};

// Banners
p['/api/banners'] = {
  get: {
    tags: ['Banners'],
    summary: 'Public list active scheduled banners',
    responses: {
      '200': genericOkResponse({
        type: 'array',
        items: { $ref: '#/components/schemas/Banner' },
      }),
    },
  },
};
p['/api/admin/banners'] = {
  get: {
    tags: ['Banners'],
    summary: 'Admin list banners',
    security: [{ BearerAuth: [] }],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  post: {
    tags: ['Banners'],
    summary: 'Create promotional banner',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '201': okResponse('#/components/schemas/Banner') },
  },
};
p['/api/admin/banners/reorder'] = {
  put: {
    tags: ['Banners'],
    summary: 'Persist drag-and-drop banner display order',
    description:
      'Requires `banners.update`. Persists displayOrder atomically in a transaction and records an audit log.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ReorderPayload' },
        },
      },
    },
    responses: {
      '200': genericOkResponse({
        type: 'object',
        properties: { reordered: { type: 'boolean', example: true } },
      }),
      '400': errorResponse(
        400,
        'VALIDATION_ERROR',
        'Duplicate IDs or negative displayOrder',
      ),
    },
  },
};
p['/api/admin/banners/{id}'] = {
  get: {
    tags: ['Banners'],
    summary: 'Get banner detail',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': okResponse('#/components/schemas/Banner') },
  },
  patch: {
    tags: ['Banners'],
    summary: 'Update banner',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': okResponse('#/components/schemas/Banner') },
  },
  delete: {
    tags: ['Banners'],
    summary: 'Delete banner safely',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/banners/{id}/status'] = {
  patch: {
    tags: ['Banners'],
    summary: 'Activate or deactivate banner',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { isActive: { type: 'boolean' } },
            required: ['isActive'],
          },
        },
      },
    },
    responses: { '200': okResponse('#/components/schemas/Banner') },
  },
};

// Gallery
p['/api/gallery'] = {
  get: {
    tags: ['Gallery'],
    summary: 'Public list active gallery items',
    responses: {
      '200': genericOkResponse({ type: 'array', items: { type: 'object' } }),
    },
  },
};
p['/api/admin/gallery'] = {
  get: {
    tags: ['Gallery'],
    summary: 'Admin list gallery items',
    security: [{ BearerAuth: [] }],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  post: {
    tags: ['Gallery'],
    summary: 'Create gallery item',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '201': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/gallery/{id}'] = {
  get: {
    tags: ['Gallery'],
    summary: 'Get gallery item detail',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  patch: {
    tags: ['Gallery'],
    summary: 'Update gallery item',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  delete: {
    tags: ['Gallery'],
    summary: 'Delete gallery item',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/gallery/{id}/status'] = {
  patch: {
    tags: ['Gallery'],
    summary: 'Activate or deactivate gallery item',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { isActive: { type: 'boolean' } },
            required: ['isActive'],
          },
        },
      },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};

// Store Settings
p['/api/settings'] = {
  get: {
    tags: ['Store Settings'],
    summary:
      'Get public storefront settings, contact details, business hours, and active announcement',
    responses: {
      '200': genericOkResponse({ $ref: '#/components/schemas/StoreSettings' }),
    },
  },
};
p['/api/admin/settings'] = {
  get: {
    tags: ['Store Settings'],
    summary: 'Get complete admin store configuration',
    security: [{ BearerAuth: [] }],
    responses: { '200': okResponse('#/components/schemas/StoreSettings') },
  },
  patch: {
    tags: ['Store Settings'],
    summary:
      'Update store configuration, business hours, and announcement schedule',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': okResponse('#/components/schemas/StoreSettings') },
  },
};

// Social Media
p['/api/social-media'] = {
  get: {
    tags: ['Social Media'],
    summary: 'Public list active social media entries (videos, profiles)',
    parameters: [
      {
        name: 'type',
        in: 'query',
        schema: { type: 'string', enum: ['video', 'profile'] },
      },
      { name: 'platform', in: 'query', schema: { type: 'string' } },
    ],
    responses: {
      '200': genericOkResponse({
        type: 'array',
        items: { $ref: '#/components/schemas/SocialMediaItem' },
      }),
    },
  },
};
p['/api/social-media-link'] = {
  get: {
    tags: ['Social Media'],
    summary: 'Public list profile handles grouped by platform key',
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/social-media'] = {
  get: {
    tags: ['Social Media'],
    summary: 'Admin list social media with platform pill summary counts',
    security: [{ BearerAuth: [] }],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
  post: {
    tags: ['Social Media'],
    summary: 'Create social media entry',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '201': okResponse('#/components/schemas/SocialMediaItem') },
  },
};
p['/api/admin/social-media/batch'] = {
  post: {
    tags: ['Social Media'],
    summary: 'Batch create social media entries',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      '201': genericOkResponse({
        type: 'array',
        items: { $ref: '#/components/schemas/SocialMediaItem' },
      }),
    },
  },
};
p['/api/admin/social-media/{id}'] = {
  get: {
    tags: ['Social Media'],
    summary: 'Get social media item detail',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': okResponse('#/components/schemas/SocialMediaItem') },
  },
  patch: {
    tags: ['Social Media'],
    summary: 'Update social media item',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': okResponse('#/components/schemas/SocialMediaItem') },
  },
  delete: {
    tags: ['Social Media'],
    summary: 'Delete social media entry',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/social-media/{id}/status'] = {
  patch: {
    tags: ['Social Media'],
    summary: 'Toggle active status of social media item',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { isActive: { type: 'boolean' } },
            required: ['isActive'],
          },
        },
      },
    },
    responses: { '200': okResponse('#/components/schemas/SocialMediaItem') },
  },
};

// Promo Codes
p['/api/promo-codes/active'] = {
  get: {
    tags: ['Promo Codes'],
    summary: 'List active public promo codes',
    responses: {
      '200': genericOkResponse({ type: 'array', items: { type: 'object' } }),
    },
  },
};
p['/api/promo-codes/validate'] = {
  post: {
    tags: ['Promo Codes'],
    summary: 'Validate promo code against order subtotal',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'WELCOME10' },
              subtotal: { type: 'string', example: '1500.00' },
            },
            required: ['code', 'subtotal'],
          },
        },
      },
    },
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/promo-codes'] = {
  get: {
    tags: ['Promo Codes'],
    summary: 'Admin list promo codes',
    security: [{ BearerAuth: [] }],
    responses: {
      '200': genericOkResponse({
        type: 'array',
        items: { $ref: '#/components/schemas/PromoCode' },
      }),
    },
  },
  post: {
    tags: ['Promo Codes'],
    summary: 'Create promo code',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '201': okResponse('#/components/schemas/PromoCode') },
  },
};
p['/api/admin/promo-codes/{id}'] = {
  get: {
    tags: ['Promo Codes'],
    summary: 'Get promo code detail',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': okResponse('#/components/schemas/PromoCode') },
  },
  patch: {
    tags: ['Promo Codes'],
    summary: 'Update promo code',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: { '200': okResponse('#/components/schemas/PromoCode') },
  },
  delete: {
    tags: ['Promo Codes'],
    summary: 'Delete promo code',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: { '200': genericOkResponse({ type: 'object' }) },
  },
};
p['/api/admin/promo-codes/{id}/status'] = {
  patch: {
    tags: ['Promo Codes'],
    summary: 'Toggle active status of promo code',
    security: [{ BearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { isActive: { type: 'boolean' } },
            required: ['isActive'],
          },
        },
      },
    },
    responses: { '200': okResponse('#/components/schemas/PromoCode') },
  },
};

// Media
p['/api/admin/media/upload'] = {
  post: {
    tags: ['Media Uploads'],
    summary: 'Upload image asset to Cloudinary',
    description:
      'Supports multipart/form-data or JSON fileBase64. Validates purpose: PRODUCT_IMAGE, PAYMENT_QR, BANNER_IMAGE, GALLERY_IMAGE.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              file: { type: 'string', format: 'binary' },
              purpose: {
                type: 'string',
                enum: [
                  'PRODUCT_IMAGE',
                  'PAYMENT_QR',
                  'BANNER_IMAGE',
                  'GALLERY_IMAGE',
                ],
              },
            },
            required: ['file', 'purpose'],
          },
        },
      },
    },
    responses: {
      '201': genericOkResponse({
        type: 'object',
        properties: {
          publicId: { type: 'string', example: 'liquor_shop/banners/b123' },
          secureUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://res.cloudinary.com/demo/image/upload/b123.jpg',
          },
        },
      }),
    },
  },
};
p['/api/admin/media'] = {
  delete: {
    tags: ['Media Uploads'],
    summary: 'Delete Cloudinary media asset with reference protection',
    description:
      'Rejects deletion if asset is actively referenced by products, payment methods, banners, gallery items, or social media thumbnails.',
    security: [{ BearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { publicId: { type: 'string' } },
            required: ['publicId'],
          },
        },
      },
    },
    responses: {
      '200': genericOkResponse({
        type: 'object',
        properties: { deleted: { type: 'boolean' } },
      }),
    },
  },
};

// Write openapi.json and openapi.yaml
fs.writeFileSync(
  path.resolve(docsDir, 'openapi.json'),
  JSON.stringify(openapiSpec, null, 2),
  'utf8',
);
fs.writeFileSync(
  path.resolve(docsDir, 'openapi.yaml'),
  yaml.dump(openapiSpec, { indent: 2, lineWidth: -1 }),
  'utf8',
);
console.log('✓ Successfully wrote docs/openapi.json and docs/openapi.yaml');

// ============================================================================
// 2. POSTMAN COLLECTION & ENVIRONMENT GENERATION
// ============================================================================

const postmanCollection: Record<string, unknown> = {
  info: {
    _postman_id: 'a8b1c2d3-e4f5-4000-8000-123456789abc',
    name: 'Liquor Shop E-Commerce Backend API',
    description:
      'Comprehensive Postman Collection v2.1 covering all public storefront and RBAC-protected administrative endpoints with automated token/ID variable chaining and positive/negative test scripts.',
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000', type: 'string' },
  ],
  item: [
    {
      name: '1. Health & System',
      item: [
        {
          name: 'Liveness Probe (GET /api/health/live)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/health/live',
              host: ['{{baseUrl}}'],
              path: ['api', 'health', 'live'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status code is 200", () => pm.response.to.have.status(200));',
                  'pm.test("Service is alive", () => pm.expect(pm.response.json().data.status).to.eql("ok"));',
                ],
              },
            },
          ],
        },
        {
          name: 'Readiness Probe (GET /api/health/ready)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/health/ready',
              host: ['{{baseUrl}}'],
              path: ['api', 'health', 'ready'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status code is 200", () => pm.response.to.have.status(200));',
                  'pm.test("Database connected", () => pm.expect(pm.response.json().data.database).to.eql("connected"));',
                ],
              },
            },
          ],
        },
      ],
    },
    {
      name: '2. Admin Authentication',
      item: [
        {
          name: 'Admin Login (POST /api/admin/auth/login)',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                { email: '{{adminEmail}}', password: '{{adminPassword}}' },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/admin/auth/login',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'auth', 'login'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 200", () => pm.response.to.have.status(200));',
                  'var json = pm.response.json();',
                  'if (json.data && json.data.token) { pm.environment.set("adminToken", json.data.token); }',
                ],
              },
            },
          ],
        },
        {
          name: 'Get Current Profile (GET /api/admin/auth/me)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/auth/me',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'auth', 'me'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 200", () => pm.response.to.have.status(200));',
                ],
              },
            },
          ],
        },
      ],
    },
    {
      name: '3. Admin Management',
      item: [
        {
          name: 'List Admin Users (GET /api/admin/users)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/users',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'users'],
            },
          },
        },
        {
          name: 'List Roles (GET /api/admin/roles)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/roles',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'roles'],
            },
          },
        },
        {
          name: 'List Permissions (GET /api/admin/permissions)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/permissions',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'permissions'],
            },
          },
        },
      ],
    },
    {
      name: '4. Categories',
      item: [
        {
          name: 'Public List Categories (GET /api/catalog/categories)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/catalog/categories',
              host: ['{{baseUrl}}'],
              path: ['api', 'catalog', 'categories'],
            },
          },
        },
        {
          name: 'Admin List Categories (GET /api/admin/categories)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/categories',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'categories'],
            },
          },
        },
        {
          name: 'Admin Create Category (POST /api/admin/categories)',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  name: 'Single Malt Whisky',
                  slug: 'single-malt-whisky-' + Date.now(),
                  description: 'Single malt scotch and world whiskies',
                  isActive: true,
                  displayOrder: 1,
                },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/admin/categories',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'categories'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 201", () => pm.response.to.have.status(201));',
                  'var json = pm.response.json();',
                  'if (json.data && json.data.id) pm.environment.set("categoryId", json.data.id);',
                ],
              },
            },
          ],
        },
      ],
    },
    {
      name: '5. Brands (With Reordering)',
      item: [
        {
          name: 'Public List Brands (GET /api/catalog/brands)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/catalog/brands',
              host: ['{{baseUrl}}'],
              path: ['api', 'catalog', 'brands'],
            },
          },
        },
        {
          name: 'Admin Create Brand (POST /api/admin/brands)',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  name: 'The Macallan',
                  slug: 'the-macallan-' + Date.now(),
                  isActive: true,
                  displayOrder: 1,
                },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/admin/brands',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'brands'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 201", () => pm.response.to.have.status(201));',
                  'var json = pm.response.json();',
                  'if (json.data && json.data.id) pm.environment.set("brandId", json.data.id);',
                ],
              },
            },
          ],
        },
        {
          name: 'Admin Reorder Brands (PUT /api/admin/brands/reorder)',
          request: {
            method: 'PUT',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  items: [{ id: '{{brandId}}', displayOrder: 0 }],
                },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/admin/brands/reorder',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'brands', 'reorder'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Brand reordering succeeds", () => pm.response.to.have.status(200));',
                ],
              },
            },
          ],
        },
      ],
    },
    {
      name: '6. Products & Variants',
      item: [
        {
          name: 'Public List Products (GET /api/catalog/products)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/catalog/products',
              host: ['{{baseUrl}}'],
              path: ['api', 'catalog', 'products'],
            },
          },
        },
        {
          name: 'Admin Create Product (POST /api/admin/products)',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  name: 'Macallan 12 Year Double Cask',
                  slug: 'macallan-12-double-cask-' + Date.now(),
                  categoryId: '{{categoryId}}',
                  brandId: '{{brandId}}',
                  discountType: 'PERCENTAGE',
                  discountValue: '10.00',
                  isActive: true,
                },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/admin/products',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'products'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 201", () => pm.response.to.have.status(201));',
                  'var json = pm.response.json();',
                  'if (json.data && json.data.id) pm.environment.set("productId", json.data.id);',
                ],
              },
            },
          ],
        },
        {
          name: 'Admin Create Variant (POST /api/admin/products/:id/variants)',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  sku: 'MAC-12-750ML-' + Math.floor(Math.random() * 1000),
                  size: '750 ml',
                  purchasePrice: 12000,
                  sellingPrice: 15500,
                  stock: 50,
                  lowStockThreshold: 5,
                  isActive: true,
                },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/admin/products/{{productId}}/variants',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'products', '{{productId}}', 'variants'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 201", () => pm.response.to.have.status(201));',
                  'var json = pm.response.json();',
                  'if (json.data && json.data.id) pm.environment.set("variantId", json.data.id);',
                ],
              },
            },
          ],
        },
      ],
    },
    {
      name: '7. Inventory Management',
      item: [
        {
          name: 'Adjust Stock (POST /api/admin/inventory/adjustments)',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  variantId: '{{variantId}}',
                  quantityDelta: 20,
                  type: 'RESTOCK',
                  reason: 'Stock shipment received',
                },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/admin/inventory/adjustments',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'inventory', 'adjustments'],
            },
          },
        },
        {
          name: 'List Movements (GET /api/admin/inventory/movements)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/inventory/movements',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'inventory', 'movements'],
            },
          },
        },
        {
          name: 'List Low Stock (GET /api/admin/inventory/low-stock)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/inventory/low-stock',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'inventory', 'low-stock'],
            },
          },
        },
      ],
    },
    {
      name: '8. Guest Cart & Checkout Flow',
      item: [
        {
          name: '1. Init Cart (GET /api/cart)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/cart',
              host: ['{{baseUrl}}'],
              path: ['api', 'cart'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 200", () => pm.response.to.have.status(200));',
                  'var cartId = pm.response.headers.get("X-Cart-Id") || pm.response.json().data.token;',
                  'if (cartId) pm.environment.set("cartToken", cartId);',
                ],
              },
            },
          ],
        },
        {
          name: '2. Add Item to Cart (POST /api/cart/items)',
          request: {
            method: 'POST',
            header: [
              { key: 'X-Cart-Id', value: '{{cartToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                { variantId: '{{variantId}}', quantity: 2 },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/cart/items',
              host: ['{{baseUrl}}'],
              path: ['api', 'cart', 'items'],
            },
          },
        },
        {
          name: '3. Execute Checkout (POST /api/checkout)',
          request: {
            method: 'POST',
            header: [
              { key: 'X-Cart-Id', value: '{{cartToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  customer: {
                    name: 'Prakash Sharma',
                    phone: '+977-9841234567',
                    deliveryAddress: 'House 12, Thamel, Kathmandu',
                    email: 'prakash@example.test',
                  },
                  paymentMethodCode: 'CASH_ON_DELIVERY',
                },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/checkout',
              host: ['{{baseUrl}}'],
              path: ['api', 'checkout'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 201", () => pm.response.to.have.status(201));',
                  'var json = pm.response.json();',
                  'if (json.data) {',
                  '  pm.environment.set("orderNumber", json.data.orderNumber);',
                  '  pm.environment.set("orderLookupToken", json.data.orderLookupToken);',
                  '}',
                ],
              },
            },
          ],
        },
        {
          name: '4. Public Order Lookup (GET /api/orders/:orderNumber)',
          request: {
            method: 'GET',
            header: [{ key: 'x-order-token', value: '{{orderLookupToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/orders/{{orderNumber}}',
              host: ['{{baseUrl}}'],
              path: ['api', 'orders', '{{orderNumber}}'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 200", () => pm.response.to.have.status(200));',
                ],
              },
            },
          ],
        },
      ],
    },
    {
      name: '9. Payment Methods & QR Proof Verification',
      item: [
        {
          name: 'Public List Payment Methods (GET /api/payment-methods)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/payment-methods',
              host: ['{{baseUrl}}'],
              path: ['api', 'payment-methods'],
            },
          },
        },
        {
          name: 'Submit Payment Proof (POST /api/orders/:orderNumber/payment-proof)',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  proofImageUrl:
                    'https://res.cloudinary.com/demo/image/upload/sample_receipt.jpg',
                  transactionReference: 'FPAY-TX-123456',
                  customerNotes: 'Transferred via Nabil Mobile Banking',
                  orderLookupToken: '{{orderLookupToken}}',
                },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/orders/{{orderNumber}}/payment-proof',
              host: ['{{baseUrl}}'],
              path: ['api', 'orders', '{{orderNumber}}', 'payment-proof'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 201", () => pm.response.to.have.status(201));',
                  'var json = pm.response.json();',
                  'if (json.data && json.data.id) pm.environment.set("paymentSubmissionId", json.data.id);',
                ],
              },
            },
          ],
        },
        {
          name: 'Admin List Payment Submissions (GET /api/admin/payment-submissions)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/payment-submissions',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'payment-submissions'],
            },
          },
        },
        {
          name: 'Admin Approve Payment Submission (POST /api/admin/payment-submissions/:id/approve)',
          request: {
            method: 'POST',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/payment-submissions/{{paymentSubmissionId}}/approve',
              host: ['{{baseUrl}}'],
              path: [
                'api',
                'admin',
                'payment-submissions',
                '{{paymentSubmissionId}}',
                'approve',
              ],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 200", () => pm.response.to.have.status(200));',
                ],
              },
            },
          ],
        },
      ],
    },
    {
      name: '10. Order Management & Status Transitions',
      item: [
        {
          name: 'List Orders (GET /api/admin/orders)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/orders',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'orders'],
            },
          },
        },
        {
          name: 'Update Order Status (PATCH /api/admin/orders/:id/status)',
          request: {
            method: 'PATCH',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  status: 'CONFIRMED',
                  reason: 'Order confirmed and verified',
                },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/admin/orders/{{orderNumber}}/status',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'orders', '{{orderNumber}}', 'status'],
            },
          },
        },
      ],
    },
    {
      name: '11. Dashboard & Analytics',
      item: [
        {
          name: 'Dashboard Summary (GET /api/admin/dashboard/summary)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/dashboard/summary',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'dashboard', 'summary'],
            },
          },
        },
        {
          name: 'Sales Analytics (GET /api/admin/dashboard/sales?groupBy=day)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/dashboard/sales?groupBy=day',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'dashboard', 'sales'],
              query: [{ key: 'groupBy', value: 'day' }],
            },
          },
        },
        {
          name: 'Best Selling Products (GET /api/admin/dashboard/top-products)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/dashboard/top-products',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'dashboard', 'top-products'],
            },
          },
        },
      ],
    },
    {
      name: '12. Customers Management',
      item: [
        {
          name: 'List Customers (GET /api/admin/customers)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/customers',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'customers'],
            },
          },
        },
      ],
    },
    {
      name: '13. Banners (With Reordering)',
      item: [
        {
          name: 'Public List Banners (GET /api/banners)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/banners',
              host: ['{{baseUrl}}'],
              path: ['api', 'banners'],
            },
          },
        },
        {
          name: 'Admin Create Banner (POST /api/admin/banners)',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  title: 'Weekend Spirits Sale',
                  imageUrl:
                    'https://res.cloudinary.com/demo/image/upload/banner_sample.jpg',
                  linkUrl: 'https://oldliquor.com/promo',
                  isActive: true,
                  displayOrder: 1,
                },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/admin/banners',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'banners'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Status is 201", () => pm.response.to.have.status(201));',
                  'var json = pm.response.json();',
                  'if (json.data && json.data.id) pm.environment.set("bannerId", json.data.id);',
                ],
              },
            },
          ],
        },
        {
          name: 'Admin Reorder Banners (PUT /api/admin/banners/reorder)',
          request: {
            method: 'PUT',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                {
                  items: [{ id: '{{bannerId}}', displayOrder: 0 }],
                },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/admin/banners/reorder',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'banners', 'reorder'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Banner reordering succeeds", () => pm.response.to.have.status(200));',
                ],
              },
            },
          ],
        },
      ],
    },
    {
      name: '14. Gallery',
      item: [
        {
          name: 'Public List Gallery (GET /api/gallery)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/gallery',
              host: ['{{baseUrl}}'],
              path: ['api', 'gallery'],
            },
          },
        },
      ],
    },
    {
      name: '15. Store Settings',
      item: [
        {
          name: 'Get Public Store Settings (GET /api/settings)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/settings',
              host: ['{{baseUrl}}'],
              path: ['api', 'settings'],
            },
          },
        },
        {
          name: 'Admin Get Store Settings (GET /api/admin/settings)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/admin/settings',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'settings'],
            },
          },
        },
      ],
    },
    {
      name: '16. Social Media',
      item: [
        {
          name: 'Public List Social Media (GET /api/social-media)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/social-media',
              host: ['{{baseUrl}}'],
              path: ['api', 'social-media'],
            },
          },
        },
        {
          name: 'Public List Profile Handles (GET /api/social-media-link)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/social-media-link',
              host: ['{{baseUrl}}'],
              path: ['api', 'social-media-link'],
            },
          },
        },
      ],
    },
    {
      name: '17. Promo Codes',
      item: [
        {
          name: 'Public List Active Promo Codes (GET /api/promo-codes/active)',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/promo-codes/active',
              host: ['{{baseUrl}}'],
              path: ['api', 'promo-codes', 'active'],
            },
          },
        },
        {
          name: 'Validate Promo Code (POST /api/promo-codes/validate)',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: JSON.stringify(
                { code: 'WELCOME10', subtotal: '1500.00' },
                null,
                2,
              ),
            },
            url: {
              raw: '{{baseUrl}}/api/promo-codes/validate',
              host: ['{{baseUrl}}'],
              path: ['api', 'promo-codes', 'validate'],
            },
          },
        },
      ],
    },
    {
      name: '18. Negative Cases & Forbidden Reorder Endpoints',
      item: [
        {
          name: 'Negative: Categories Reorder Returns 404 (PUT /api/admin/categories/reorder)',
          request: {
            method: 'PUT',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: { mode: 'raw', raw: JSON.stringify({ items: [] }) },
            url: {
              raw: '{{baseUrl}}/api/admin/categories/reorder',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'categories', 'reorder'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Categories reorder strictly returns 404", () => pm.response.to.have.status(404));',
                ],
              },
            },
          ],
        },
        {
          name: 'Negative: Products Reorder Returns 404 (PUT /api/admin/products/reorder)',
          request: {
            method: 'PUT',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: { mode: 'raw', raw: JSON.stringify({ items: [] }) },
            url: {
              raw: '{{baseUrl}}/api/admin/products/reorder',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'products', 'reorder'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Products reorder strictly returns 404", () => pm.response.to.have.status(404));',
                ],
              },
            },
          ],
        },
        {
          name: 'Negative: Gallery Reorder Returns 404 (PUT /api/admin/gallery/reorder)',
          request: {
            method: 'PUT',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: { mode: 'raw', raw: JSON.stringify({ items: [] }) },
            url: {
              raw: '{{baseUrl}}/api/admin/gallery/reorder',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'gallery', 'reorder'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Gallery reorder strictly returns 404", () => pm.response.to.have.status(404));',
                ],
              },
            },
          ],
        },
        {
          name: 'Negative: Social Media Reorder Returns 404 (PUT /api/admin/social-media/reorder)',
          request: {
            method: 'PUT',
            header: [
              { key: 'Authorization', value: 'Bearer {{adminToken}}' },
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: { mode: 'raw', raw: JSON.stringify({ items: [] }) },
            url: {
              raw: '{{baseUrl}}/api/admin/social-media/reorder',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'social-media', 'reorder'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Social media reorder strictly returns 404", () => pm.response.to.have.status(404));',
                ],
              },
            },
          ],
        },
        {
          name: 'Negative: Unauthenticated Admin Call Returns 401',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/api/admin/orders',
              host: ['{{baseUrl}}'],
              path: ['api', 'admin', 'orders'],
            },
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'pm.test("Unauthenticated returns 401", () => pm.response.to.have.status(401));',
                ],
              },
            },
          ],
        },
      ],
    },
  ],
};

const postmanEnv = {
  id: 'b2c3d4e5-f6a7-4000-8000-987654321def',
  name: 'Liquor Shop Backend (Local Environment)',
  values: [
    {
      key: 'baseUrl',
      value: 'http://localhost:3000',
      type: 'default',
      enabled: true,
    },
    {
      key: 'adminEmail',
      value: 'superadmin@liquor.test',
      type: 'default',
      enabled: true,
    },
    {
      key: 'adminPassword',
      value: 'SuperAdminSecret123!',
      type: 'secret',
      enabled: true,
    },
    { key: 'adminToken', value: '', type: 'secret', enabled: true },
    { key: 'cartToken', value: '', type: 'default', enabled: true },
    { key: 'orderNumber', value: '', type: 'default', enabled: true },
    { key: 'orderLookupToken', value: '', type: 'secret', enabled: true },
    { key: 'categoryId', value: '', type: 'default', enabled: true },
    { key: 'brandId', value: '', type: 'default', enabled: true },
    { key: 'productId', value: '', type: 'default', enabled: true },
    { key: 'variantId', value: '', type: 'default', enabled: true },
    { key: 'bannerId', value: '', type: 'default', enabled: true },
    { key: 'galleryId', value: '', type: 'default', enabled: true },
    { key: 'socialMediaId', value: '', type: 'default', enabled: true },
    { key: 'paymentMethodId', value: '', type: 'default', enabled: true },
    { key: 'paymentSubmissionId', value: '', type: 'default', enabled: true },
    { key: 'promoCodeId', value: '', type: 'default', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};

fs.writeFileSync(
  path.resolve(postmanDir, 'liquor-shop-backend.postman_collection.json'),
  JSON.stringify(postmanCollection, null, 2),
  'utf8',
);
fs.writeFileSync(
  path.resolve(postmanDir, 'liquor-shop-backend.postman_environment.json'),
  JSON.stringify(postmanEnv, null, 2),
  'utf8',
);
console.log('✓ Successfully wrote Postman collection and environment files');
