import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Logger } from 'pino';
import type { AppConfig } from './config/env';
import { AppError } from './errors/app-error';
import { createLogger } from './lib/logger';
import { checkDatabaseConnection } from './lib/prisma';
import { createAdminAuthRouter } from './modules/auth/auth.routes';
import type { AdminAuthRepository } from './modules/auth/auth.types';
import { AdminAuthService } from './modules/auth/auth.service';
import { createAdminManagementRouter } from './modules/admin-management/admin-management.routes';
import { PrismaAdminAuthRepository } from './modules/auth/auth.repository';
import { PrismaAdminManagementRepository } from './modules/admin-management/admin-management.repository';
import type { AdminManagementRepository } from './modules/admin-management/admin-management.types';
import {
  createAdminCategoryRouter,
  createPublicCategoryRouter,
} from './modules/categories/categories.routes';
import { PrismaCategoryRepository } from './modules/categories/categories.repository';
import type { CategoryRepository } from './modules/categories/categories.types';
import {
  createAdminBrandRouter,
  createPublicBrandRouter,
} from './modules/brands/brands.routes';
import { PrismaBrandRepository } from './modules/brands/brands.repository';
import type { BrandRepository } from './modules/brands/brands.types';
import {
  createAdminProductRouter,
  createPublicProductRouter,
} from './modules/products/products.routes';
import { PrismaProductRepository } from './modules/products/products.repository';
import type { ProductRepository } from './modules/products/products.types';
import { createInventoryRouter } from './modules/inventory/inventory.routes';
import { PrismaInventoryRepository } from './modules/inventory/inventory.repository';
import { MemoryInventoryRepository } from './modules/inventory/memory-inventory.repository';
import { InventoryService } from './modules/inventory/inventory.service';
import type { InventoryRepository } from './modules/inventory/inventory.types';
import { createCartRouter } from './modules/cart/cart.routes';
import { PrismaCartRepository } from './modules/cart/cart.repository';
import type { CartRepository } from './modules/cart/cart.types';
import {
  createCheckoutRouter,
  extractOrderLookupToken,
} from './modules/checkout/checkout.routes';
import { CheckoutService } from './modules/checkout/checkout.service';
import { PrismaCheckoutRepository } from './modules/checkout/checkout.repository';
import type { CheckoutRepository } from './modules/checkout/checkout.types';
import {
  createAdminPaymentMethodRouter,
  createPublicPaymentMethodRouter,
} from './modules/payment-method/payment-method.routes';
import { PrismaPaymentMethodRepository } from './modules/payment-method/payment-method.repository';
import type { PaymentMethodRepository } from './modules/payment-method/payment-method.types';
import { PrismaPaymentSubmissionRepository } from './modules/payment-submission/payment-submission.repository';
import {
  createAdminPaymentSubmissionRouter,
  createPublicPaymentSubmissionRouter,
} from './modules/payment-submission/payment-submission.routes';
import { PaymentSubmissionService } from './modules/payment-submission/payment-submission.service';
import type { PaymentSubmissionRepository } from './modules/payment-submission/payment-submission.types';
import { PrismaAuditLogRepository } from './modules/audit/audit.repository';
import { MemoryAuditLogRepository } from './modules/audit/memory-audit.repository';
import { createAdminAuditRouter } from './modules/audit/audit.routes';
import { AuditService } from './modules/audit/audit.service';
import type { AuditLogRepository } from './modules/audit/audit.types';
import { PrismaOrderManagementRepository } from './modules/order-management/order-management.repository';
import { MemoryOrderManagementRepository } from './modules/order-management/memory-order-management.repository';
import { createAdminOrderManagementRouter } from './modules/order-management/order-management.routes';
import { OrderManagementService } from './modules/order-management/order-management.service';
import type { OrderManagementRepository } from './modules/order-management/order-management.types';
import { MemoryPaymentSubmissionRepository } from './modules/payment-submission/memory-payment-submission.repository';
import type { CloudinaryClient } from './modules/media/media.types';
import { CloudinaryService } from './modules/media/cloudinary.service';
import { createAdminMediaRouter } from './modules/media/media.routes';
import {
  RealCloudinaryClient,
  MemoryCloudinaryClient,
  UnconfiguredCloudinaryClient,
} from './modules/media/cloudinary.client';
import {
  PrismaMediaReferenceChecker,
  MemoryMediaReferenceChecker,
} from './modules/media/media-reference-checker';
import type { RoutingProvider } from './modules/routing/routing.types';
import { GoogleMapsRoutingProvider } from './modules/routing/google-maps.provider';
import { MemoryRoutingProvider } from './modules/routing/memory-routing.provider';
import { RoutingService } from './modules/routing/routing.service';
import type { DeliveryFeePolicy } from './modules/delivery/delivery-fee.types';
import { ConfigurableDeliveryFeePolicy } from './modules/delivery/delivery-fee.policy';
import { RoutingDeliveryFeeEstimator } from './modules/delivery/routing-delivery-fee.estimator';
import type { DeliveryFeeEstimator } from './modules/checkout/checkout.types';
import type {
  EmailProvider,
  NotificationOutboxRepository,
  WhatsAppProvider,
} from './modules/notifications/notification.types';
import { PrismaNotificationOutboxRepository } from './modules/notifications/notification-outbox.repository';
import { MemoryNotificationOutboxRepository } from './modules/notifications/memory-notification-outbox.repository';
import {
  createEmailProvider,
  createWhatsAppProvider,
} from './modules/notifications/providers/provider-factory';
import { NotificationOutboxService } from './modules/notifications/notification-outbox.service';
import { PrismaPromoCodeRepository } from './modules/promo-code/promo-code.repository';
import { MemoryPromoCodeRepository } from './modules/promo-code/memory-promo-code.repository';
import { PromoCodeService } from './modules/promo-code/promo-code.service';
import type { PromoCodeRepository } from './modules/promo-code/promo-code.types';
import {
  createAdminPromoCodeRouter,
  createPublicPromoCodeRouter,
} from './modules/promo-code/promo-code.routes';
import { PrismaDashboardRepository } from './modules/dashboard/dashboard.repository';
import { MemoryDashboardRepository } from './modules/dashboard/memory-dashboard.repository';
import { DashboardService } from './modules/dashboard/dashboard.service';
import type { DashboardRepository } from './modules/dashboard/dashboard.types';
import { createAdminDashboardRouter } from './modules/dashboard/dashboard.routes';
import { PrismaCustomerRepository } from './modules/customers/customers.repository';
import { MemoryCustomerRepository } from './modules/customers/memory-customers.repository';
import { CustomerService } from './modules/customers/customers.service';
import type { CustomerRepository } from './modules/customers/customers.types';
import { createAdminCustomerRouter } from './modules/customers/customers.routes';
import { PrismaContactInquiryRepository } from './modules/contact-inquiry/contact-inquiry.repository';
import { MemoryContactInquiryRepository } from './modules/contact-inquiry/memory-contact-inquiry.repository';
import { ContactInquiryService } from './modules/contact-inquiry/contact-inquiry.service';
import type { ContactInquiryRepository } from './modules/contact-inquiry/contact-inquiry.types';
import {
  createAdminContactInquiryRouter,
  createPublicContactInquiryRouter,
} from './modules/contact-inquiry/contact-inquiry.routes';
import { PrismaBannerRepository } from './modules/banners/banners.repository';
import { MemoryBannerRepository } from './modules/banners/memory-banners.repository';
import { BannerService } from './modules/banners/banners.service';
import type { BannerRepository } from './modules/banners/banners.types';
import {
  createAdminBannerRouter,
  createPublicBannerRouter,
} from './modules/banners/banners.routes';
import { PrismaGalleryRepository } from './modules/gallery/gallery.repository';
import { MemoryGalleryRepository } from './modules/gallery/memory-gallery.repository';
import { GalleryService } from './modules/gallery/gallery.service';
import type { GalleryRepository } from './modules/gallery/gallery.types';
import {
  createAdminGalleryRouter,
  createPublicGalleryRouter,
} from './modules/gallery/gallery.routes';
import { PrismaStoreSettingsRepository } from './modules/store-settings/store-settings.repository';
import { MemoryStoreSettingsRepository } from './modules/store-settings/memory-store-settings.repository';
import { StoreSettingsService } from './modules/store-settings/store-settings.service';
import type { StoreSettingsRepository } from './modules/store-settings/store-settings.types';
import {
  createAdminStoreSettingsRouter,
  createPublicStoreSettingsRouter,
} from './modules/store-settings/store-settings.routes';
import { PrismaSocialMediaRepository } from './modules/social-media/social-media.repository';
import { MemorySocialMediaRepository } from './modules/social-media/memory-social-media.repository';
import { SocialMediaService } from './modules/social-media/social-media.service';
import type { SocialMediaRepository } from './modules/social-media/social-media.types';
import {
  createAdminSocialMediaRouter,
  createPublicSocialMediaRouter,
  createPublicSocialMediaLinkRouter,
} from './modules/social-media/social-media.routes';
import { createErrorHandler } from './middleware/error-handler';

import { notFoundHandler } from './middleware/not-found';
import { createRequestLogger } from './middleware/request-logger';
import { successResponse } from './utils/response';

export type DatabaseReadinessCheck = () => Promise<void>;

export interface LegacyCatalogRepository
  extends
    Partial<CategoryRepository>,
    Partial<BrandRepository>,
    Partial<ProductRepository> {}

export interface AppDependencies {
  adminAuthRepository?: AdminAuthRepository;
  adminManagementRepository?: AdminManagementRepository;
  categoryRepository?: CategoryRepository;
  brandRepository?: BrandRepository;
  productRepository?: ProductRepository;
  catalogRepository?: LegacyCatalogRepository;
  inventoryRepository?: InventoryRepository;
  cartRepository?: CartRepository;
  checkoutRepository?: CheckoutRepository;
  paymentMethodRepository?: PaymentMethodRepository;
  paymentSubmissionRepository?: PaymentSubmissionRepository;
  auditRepository?: AuditLogRepository;
  orderManagementRepository?: OrderManagementRepository;
  promoCodeRepository?: PromoCodeRepository;
  promoCodeService?: PromoCodeService;
  dashboardRepository?: DashboardRepository;
  dashboardService?: DashboardService;
  customerRepository?: CustomerRepository;
  customerService?: CustomerService;
  contactInquiryRepository?: ContactInquiryRepository;
  contactInquiryService?: ContactInquiryService;
  bannerRepository?: BannerRepository;
  bannerService?: BannerService;
  galleryRepository?: GalleryRepository;
  galleryService?: GalleryService;
  storeSettingsRepository?: StoreSettingsRepository;
  storeSettingsService?: StoreSettingsService;
  socialMediaRepository?: SocialMediaRepository;
  socialMediaService?: SocialMediaService;
  cloudinaryClient?: CloudinaryClient;

  cloudinaryService?: CloudinaryService;
  routingProvider?: RoutingProvider;
  routingService?: RoutingService;
  deliveryFeePolicy?: DeliveryFeePolicy;
  deliveryFeeEstimator?: DeliveryFeeEstimator;
  notificationOutboxRepository?: NotificationOutboxRepository;
  emailProvider?: EmailProvider;
  whatsappProvider?: WhatsAppProvider;
  notificationOutboxService?: NotificationOutboxService;
  logger?: Logger;
}

export function createApp(
  config: AppConfig,
  databaseReadinessCheck: DatabaseReadinessCheck = checkDatabaseConnection,
  dependencies: AppDependencies = {},
): Express {
  const app = express();
  const logger = dependencies.logger ?? createLogger(config.LOG_LEVEL);
  const adminAuthRepository =
    dependencies.adminAuthRepository ?? new PrismaAdminAuthRepository();
  const authService = new AdminAuthService(config, adminAuthRepository);

  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(createRequestLogger(logger));
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(
          new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed'),
        );
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-Id',
        'X-Cart-Id',
        'X-Cart-Token',
        'Idempotency-Key',
        'X-Idempotency-Key',
        'X-Order-Token',
      ],
      exposedHeaders: ['X-Cart-Id'],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: config.REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.get('/api/health/live', (_request, response) => {
    response
      .status(200)
      .json(successResponse('Service is alive', { status: 'ok' }));
  });

  app.get('/api/health/ready', async (_request, response, next) => {
    try {
      await databaseReadinessCheck();
      response.status(200).json(
        successResponse('Service is ready', {
          status: 'ready',
          database: 'connected',
        }),
      );
    } catch (error) {
      logger.error(
        { errorName: error instanceof Error ? error.name : 'UnknownError' },
        'Database readiness probe failed',
      );
      next(
        new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is not available'),
      );
    }
  });

  const apiLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(
        new AppError(429, 'RATE_LIMITED', 'Too many requests; try again later'),
      );
    },
  });

  app.use('/api', apiLimiter);
  app.use(
    '/api/admin/auth',
    createAdminAuthRouter(config, adminAuthRepository, authService),
  );
  app.use(
    '/api/admin',
    createAdminManagementRouter(
      authService,
      dependencies.adminManagementRepository ??
        new PrismaAdminManagementRepository(),
    ),
  );
  const isMemoryMode =
    Boolean(
      dependencies.checkoutRepository &&
      'orders' in dependencies.checkoutRepository,
    ) || config.NODE_ENV === 'test';

  const auditRepository =
    dependencies.auditRepository ??
    (isMemoryMode
      ? new MemoryAuditLogRepository()
      : new PrismaAuditLogRepository());
  const auditService = new AuditService(auditRepository, logger);

  const categoryRepository =
    dependencies.categoryRepository ??
    (dependencies.catalogRepository as CategoryRepository | undefined) ??
    new PrismaCategoryRepository();

  const brandRepository =
    dependencies.brandRepository ??
    (dependencies.catalogRepository as BrandRepository | undefined) ??
    new PrismaBrandRepository();

  const productRepository =
    dependencies.productRepository ??
    (dependencies.catalogRepository as ProductRepository | undefined) ??
    new PrismaProductRepository();

  const inventoryRepository =
    dependencies.inventoryRepository ??
    (productRepository && 'variants' in productRepository
      ? new MemoryInventoryRepository(
          (productRepository as unknown as { variants: [] }).variants,
        )
      : new PrismaInventoryRepository());
  const inventoryService = new InventoryService(inventoryRepository);

  app.use(
    '/api/catalog/categories',
    createPublicCategoryRouter(categoryRepository),
  );
  app.use('/api/catalog/brands', createPublicBrandRouter(brandRepository));
  app.use(
    '/api/catalog/products',
    createPublicProductRouter(productRepository, inventoryService),
  );

  app.use(
    '/api/admin/categories',
    createAdminCategoryRouter(authService, categoryRepository),
  );
  app.use(
    '/api/admin/brands',
    createAdminBrandRouter(authService, brandRepository, auditService),
  );
  app.use(
    '/api/admin/products',
    createAdminProductRouter(authService, productRepository, inventoryService),
  );

  app.use(
    '/api/admin/inventory',
    createInventoryRouter(authService, inventoryRepository),
  );

  const paymentMethodRepository =
    dependencies.paymentMethodRepository ?? new PrismaPaymentMethodRepository();

  app.use(
    '/api/admin/payment-methods',
    createAdminPaymentMethodRouter(authService, paymentMethodRepository),
  );
  app.use(
    '/api/payment-methods',
    createPublicPaymentMethodRouter(paymentMethodRepository),
  );

  const promoCodeRepository =
    dependencies.promoCodeRepository ??
    (isMemoryMode
      ? new MemoryPromoCodeRepository()
      : new PrismaPromoCodeRepository());
  const promoCodeService =
    dependencies.promoCodeService ??
    new PromoCodeService(promoCodeRepository, auditService);

  app.use(
    '/api/admin/promo-codes',
    createAdminPromoCodeRouter(
      authService,
      promoCodeRepository,
      promoCodeService,
    ),
  );
  app.use(
    '/api/promo-codes',
    createPublicPromoCodeRouter(promoCodeRepository, promoCodeService),
  );

  const routingProvider =
    dependencies.routingProvider ??
    (config.GOOGLE_MAPS_API_KEY && !isMemoryMode
      ? new GoogleMapsRoutingProvider(config.GOOGLE_MAPS_API_KEY)
      : new MemoryRoutingProvider());

  const routingService =
    dependencies.routingService ??
    new RoutingService(
      routingProvider,
      {
        latitude: config.STORE_ORIGIN_LATITUDE,
        longitude: config.STORE_ORIGIN_LONGITUDE,
      },
      config.DELIVERY_MAX_DISTANCE_KM,
    );

  const deliveryFeePolicy =
    dependencies.deliveryFeePolicy ??
    new ConfigurableDeliveryFeePolicy({
      mode: config.DELIVERY_FEE_MODE,
      baseAmount: config.DELIVERY_FEE_BASE_AMOUNT,
      perKmAmount: config.DELIVERY_FEE_PER_KM_AMOUNT,
      freeDeliveryThreshold: config.DELIVERY_FEE_FREE_THRESHOLD,
      maxDistanceKm: config.DELIVERY_MAX_DISTANCE_KM,
      fallbackAmount: config.DELIVERY_FALLBACK_AMOUNT,
    });

  const deliveryFeeEstimator =
    dependencies.deliveryFeeEstimator ??
    new RoutingDeliveryFeeEstimator(routingService, deliveryFeePolicy);

  const notificationOutboxRepository =
    dependencies.notificationOutboxRepository ??
    (isMemoryMode
      ? new MemoryNotificationOutboxRepository()
      : new PrismaNotificationOutboxRepository());

  const emailProvider =
    dependencies.emailProvider ?? createEmailProvider(config, isMemoryMode);

  const whatsappProvider =
    dependencies.whatsappProvider ??
    createWhatsAppProvider(config, isMemoryMode);

  const notificationOutboxService =
    dependencies.notificationOutboxService ??
    new NotificationOutboxService(
      notificationOutboxRepository,
      emailProvider,
      whatsappProvider,
      config.STORE_OWNER_WHATSAPP_NUMBER,
      config.EMAIL_FROM,
      logger,
    );

  const cartRepository =
    dependencies.cartRepository ?? new PrismaCartRepository();
  const checkoutRepository =
    dependencies.checkoutRepository ?? new PrismaCheckoutRepository();

  if (
    'setNotificationOutboxService' in checkoutRepository &&
    typeof (checkoutRepository as { setNotificationOutboxService?: unknown })
      .setNotificationOutboxService === 'function'
  ) {
    (
      checkoutRepository as {
        setNotificationOutboxService: (
          s: typeof notificationOutboxService,
        ) => void;
      }
    ).setNotificationOutboxService(notificationOutboxService);
  }

  if (
    'setPromoCodeRepository' in checkoutRepository &&
    typeof (checkoutRepository as { setPromoCodeRepository?: unknown })
      .setPromoCodeRepository === 'function'
  ) {
    (
      checkoutRepository as {
        setPromoCodeRepository: (repo: PromoCodeRepository) => void;
      }
    ).setPromoCodeRepository(promoCodeRepository);
  }

  const checkoutService = new CheckoutService(
    checkoutRepository,
    productRepository,
    cartRepository,
    deliveryFeeEstimator,
    undefined,
    paymentMethodRepository,
    promoCodeRepository,
    promoCodeService,
  );

  app.use('/api/cart', createCartRouter(cartRepository, productRepository));
  app.use(
    '/api/checkout',
    createCheckoutRouter(
      checkoutRepository,
      productRepository,
      cartRepository,
      paymentMethodRepository,
      deliveryFeeEstimator,
      promoCodeRepository,
      promoCodeService,
    ),
  );
  const orderLookupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Too many order lookup requests; try again later',
        ),
      );
    },
  });

  app.get(
    '/api/orders/:orderNumber',
    orderLookupLimiter,
    async (request, response, next) => {
      try {
        const token = extractOrderLookupToken(request);
        const order = await checkoutService.getPublicOrderByNumber(
          request.params.orderNumber as string,
          token,
        );
        response
          .status(200)
          .json(successResponse('Order retrieved successfully', order));
      } catch (error) {
        next(error);
      }
    },
  );

  const paymentSubmissionRepository =
    dependencies.paymentSubmissionRepository ??
    (isMemoryMode
      ? new MemoryPaymentSubmissionRepository(
          checkoutRepository,
          [],
          auditRepository,
        )
      : new PrismaPaymentSubmissionRepository());

  if (
    'setAuditRepository' in paymentSubmissionRepository &&
    typeof (paymentSubmissionRepository as { setAuditRepository?: unknown })
      .setAuditRepository === 'function'
  ) {
    (
      paymentSubmissionRepository as {
        setAuditRepository: (repo: typeof auditRepository) => void;
      }
    ).setAuditRepository(auditRepository);
  }

  const paymentSubmissionService = new PaymentSubmissionService(
    paymentSubmissionRepository,
    checkoutRepository,
    paymentMethodRepository,
    logger,
    auditService,
  );

  app.use(
    '/api/orders',
    createPublicPaymentSubmissionRouter(paymentSubmissionService),
  );
  app.use(
    '/api/checkout/orders',
    createPublicPaymentSubmissionRouter(paymentSubmissionService),
  );
  app.use(
    '/api/admin/payment-submissions',
    createAdminPaymentSubmissionRouter(authService, paymentSubmissionService),
  );

  const orderManagementRepository =
    dependencies.orderManagementRepository ??
    (isMemoryMode
      ? new MemoryOrderManagementRepository(
          checkoutRepository,
          [],
          paymentSubmissionRepository,
          auditRepository,
        )
      : new PrismaOrderManagementRepository());

  if (
    'setAuditRepository' in orderManagementRepository &&
    typeof (orderManagementRepository as { setAuditRepository?: unknown })
      .setAuditRepository === 'function'
  ) {
    (
      orderManagementRepository as {
        setAuditRepository: (repo: typeof auditRepository) => void;
      }
    ).setAuditRepository(auditRepository);
  }

  if (
    'setNotificationOutboxService' in orderManagementRepository &&
    typeof (
      orderManagementRepository as { setNotificationOutboxService?: unknown }
    ).setNotificationOutboxService === 'function'
  ) {
    (
      orderManagementRepository as {
        setNotificationOutboxService: (
          s: typeof notificationOutboxService,
        ) => void;
      }
    ).setNotificationOutboxService(notificationOutboxService);
  }

  const orderManagementService = new OrderManagementService(
    orderManagementRepository,
    auditService,
    logger,
  );

  app.use(
    '/api/admin/orders',
    createAdminOrderManagementRouter(authService, orderManagementService),
  );
  app.use(
    '/api/admin/audit-logs',
    createAdminAuditRouter(authService, auditService),
  );

  const dashboardRepository =
    dependencies.dashboardRepository ??
    (isMemoryMode
      ? new MemoryDashboardRepository(checkoutRepository)
      : new PrismaDashboardRepository());
  const dashboardService =
    dependencies.dashboardService ?? new DashboardService(dashboardRepository);

  app.use(
    '/api/admin/dashboard',
    createAdminDashboardRouter(
      authService,
      dashboardRepository,
      dashboardService,
    ),
  );

  const customerRepository =
    dependencies.customerRepository ??
    (isMemoryMode
      ? new MemoryCustomerRepository(checkoutRepository)
      : new PrismaCustomerRepository());
  const customerService =
    dependencies.customerService ?? new CustomerService(customerRepository);

  app.use(
    '/api/admin/customers',
    createAdminCustomerRouter(authService, customerService),
  );

  const contactInquiryRepository =
    dependencies.contactInquiryRepository ??
    (isMemoryMode
      ? new MemoryContactInquiryRepository()
      : new PrismaContactInquiryRepository());
  const contactInquiryService =
    dependencies.contactInquiryService ??
    new ContactInquiryService(contactInquiryRepository, auditService);

  app.use(
    '/api/contact',
    createPublicContactInquiryRouter(contactInquiryService),
  );
  app.use(
    '/api/contact-inquiries',
    createPublicContactInquiryRouter(contactInquiryService),
  );
  app.use(
    '/api/admin/contact-inquiries',
    createAdminContactInquiryRouter(authService, contactInquiryService),
  );
  app.use(
    '/api/admin/contact',
    createAdminContactInquiryRouter(authService, contactInquiryService),
  );

  const bannerRepository =
    dependencies.bannerRepository ??
    (isMemoryMode
      ? new MemoryBannerRepository()
      : new PrismaBannerRepository());
  const bannerService =
    dependencies.bannerService ??
    new BannerService(bannerRepository, auditService);

  app.use('/api/banners', createPublicBannerRouter(bannerService));
  app.use(
    '/api/admin/banners',
    createAdminBannerRouter(authService, bannerService),
  );

  const galleryRepository =
    dependencies.galleryRepository ??
    (isMemoryMode
      ? new MemoryGalleryRepository()
      : new PrismaGalleryRepository());
  const galleryService =
    dependencies.galleryService ??
    new GalleryService(galleryRepository, auditService);

  app.use('/api/gallery', createPublicGalleryRouter(galleryService));
  app.use(
    '/api/admin/gallery',
    createAdminGalleryRouter(authService, galleryService),
  );

  const storeSettingsRepository =
    dependencies.storeSettingsRepository ??
    (isMemoryMode
      ? new MemoryStoreSettingsRepository()
      : new PrismaStoreSettingsRepository());
  const storeSettingsService =
    dependencies.storeSettingsService ??
    new StoreSettingsService(storeSettingsRepository, auditService);

  app.use(
    '/api/settings',
    createPublicStoreSettingsRouter(storeSettingsService),
  );
  app.use(
    '/api/admin/settings',
    createAdminStoreSettingsRouter(authService, storeSettingsService),
  );

  const socialMediaRepository =
    dependencies.socialMediaRepository ??
    (isMemoryMode
      ? new MemorySocialMediaRepository()
      : new PrismaSocialMediaRepository());
  const socialMediaService =
    dependencies.socialMediaService ??
    new SocialMediaService(socialMediaRepository, auditService);

  app.use(
    '/api/social-media',
    createPublicSocialMediaRouter(socialMediaService),
  );
  app.use(
    '/api/social-media-link',
    createPublicSocialMediaLinkRouter(socialMediaService),
  );
  app.use(
    '/api/admin/social-media',
    createAdminSocialMediaRouter(authService, socialMediaService),
  );

  const cloudinaryClient =
    dependencies.cloudinaryClient ??
    (config.CLOUDINARY_CLOUD_NAME &&
    config.CLOUDINARY_API_KEY &&
    config.CLOUDINARY_API_SECRET
      ? new RealCloudinaryClient({
          cloudName: config.CLOUDINARY_CLOUD_NAME,
          apiKey: config.CLOUDINARY_API_KEY,
          apiSecret: config.CLOUDINARY_API_SECRET,
        })
      : isMemoryMode
        ? new MemoryCloudinaryClient()
        : new UnconfiguredCloudinaryClient());

  const mediaReferenceChecker = isMemoryMode
    ? new MemoryMediaReferenceChecker(
        paymentMethodRepository,
        paymentSubmissionRepository,
        checkoutRepository,
        [],
        bannerRepository,
        galleryRepository,
        socialMediaRepository,
      )
    : new PrismaMediaReferenceChecker();

  const cloudinaryService =
    dependencies.cloudinaryService ??
    new CloudinaryService(
      config,
      cloudinaryClient,
      mediaReferenceChecker,
      logger,
    );

  app.use(
    '/api/admin/media',
    createAdminMediaRouter(authService, cloudinaryService),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
