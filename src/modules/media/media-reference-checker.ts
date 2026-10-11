import { prisma } from '../../lib/prisma';
import type { BannerRepository } from '../banners/banners.types';
import type { GalleryRepository } from '../gallery/gallery.types';
import type { SocialMediaRepository } from '../social-media/social-media.types';
import type {
  CheckoutRepository,
  OrderSnapshot,
} from '../checkout/checkout.types';
import type { PaymentMethodRepository } from '../payment-method/payment-method.types';
import type { PaymentSubmissionRepository } from '../payment-submission/payment-submission.types';
import type {
  MediaReferenceChecker,
  MediaReferenceCheckResult,
} from './media.types';

export class PrismaMediaReferenceChecker implements MediaReferenceChecker {
  async isAssetReferenced(
    publicId: string,
    secureUrl?: string,
  ): Promise<MediaReferenceCheckResult> {
    const urlConditions: Array<{ contains: string }> = [{ contains: publicId }];
    if (secureUrl) {
      urlConditions.push({ contains: secureUrl });
    }

    // 1. Check ProductImage table
    const referencedProductImage = await prisma.productImage.findFirst({
      where: {
        OR: [{ publicId }, ...(secureUrl ? [{ imageUrl: secureUrl }] : [])],
      },
      select: { id: true, productId: true },
    });
    if (referencedProductImage) {
      return {
        referenced: true,
        reason: `Asset is referenced by product image ${referencedProductImage.id} for product ${referencedProductImage.productId}`,
      };
    }

    // 2. Check PaymentMethod table
    const referencedPaymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        OR: urlConditions.map((c) => ({ qrImageUrl: c })),
      },
      select: { id: true, code: true },
    });
    if (referencedPaymentMethod) {
      return {
        referenced: true,
        reason: `Asset is referenced as QR code for payment method ${referencedPaymentMethod.code}`,
      };
    }

    // 3. Check PaymentSubmission table (historical guest payment evidence - NEVER delete!)
    const referencedSubmission = await prisma.paymentSubmission.findFirst({
      where: {
        OR: urlConditions.map((c) => ({ proofImageUrl: c })),
      },
      select: { id: true, orderId: true },
    });
    if (referencedSubmission) {
      return {
        referenced: true,
        reason: `Asset is historical payment proof for payment submission ${referencedSubmission.id}`,
      };
    }

    // 4. Check Banner table
    const referencedBanner = await prisma.banner.findFirst({
      where: {
        OR: [{ publicId }, ...(secureUrl ? [{ imageUrl: secureUrl }] : [])],
      },
      select: { id: true, title: true },
    });
    if (referencedBanner) {
      return {
        referenced: true,
        reason: `Asset is referenced by banner ${referencedBanner.id} ("${referencedBanner.title}")`,
      };
    }

    // 5. Check GalleryItem table
    const referencedGalleryItem = await prisma.galleryItem.findFirst({
      where: {
        OR: [{ publicId }, ...(secureUrl ? [{ imageUrl: secureUrl }] : [])],
      },
      select: { id: true, title: true },
    });
    if (referencedGalleryItem) {
      return {
        referenced: true,
        reason: `Asset is referenced by gallery item ${referencedGalleryItem.id} ("${referencedGalleryItem.title}")`,
      };
    }

    // 6. Check SocialMedia table
    const referencedSocialMedia = await prisma.socialMedia.findFirst({
      where: {
        OR: [{ publicId }, ...(secureUrl ? [{ thumbnailUrl: secureUrl }] : [])],
      },
      select: { id: true, label: true, platform: true },
    });
    if (referencedSocialMedia) {
      return {
        referenced: true,
        reason: `Asset is referenced by social media item ${referencedSocialMedia.id} (${referencedSocialMedia.platform})`,
      };
    }

    return { referenced: false };
  }
}

export class MemoryMediaReferenceChecker implements MediaReferenceChecker {
  constructor(
    private readonly paymentMethodRepository?: PaymentMethodRepository,
    private readonly paymentSubmissionRepository?: PaymentSubmissionRepository,
    private readonly checkoutRepository?: CheckoutRepository,
    private readonly productImages: Array<{
      publicId: string | null;
      imageUrl: string;
      productId: string;
    }> = [],
    private readonly bannerRepository?: BannerRepository,
    private readonly galleryRepository?: GalleryRepository,
    private readonly socialMediaRepository?: SocialMediaRepository,
  ) {}

  async isAssetReferenced(
    publicId: string,
    secureUrl?: string,
  ): Promise<MediaReferenceCheckResult> {
    // 1. Check product images
    const matchingProductImage = this.productImages.find(
      (img) =>
        img.publicId === publicId || (secureUrl && img.imageUrl === secureUrl),
    );
    if (matchingProductImage) {
      return {
        referenced: true,
        reason: `Asset is referenced by product ${matchingProductImage.productId}`,
      };
    }

    // 2. Check payment methods
    if (this.paymentMethodRepository) {
      const methods =
        'items' in this.paymentMethodRepository
          ? (
              this.paymentMethodRepository as unknown as {
                items: Array<{ qrImageUrl: string | null; code: string }>;
              }
            ).items
          : await this.paymentMethodRepository.list();
      const matchingMethod = methods.find(
        (m) =>
          m.qrImageUrl &&
          (m.qrImageUrl.includes(publicId) ||
            (secureUrl && m.qrImageUrl === secureUrl)),
      );
      if (matchingMethod) {
        return {
          referenced: true,
          reason: `Asset is referenced as QR code for payment method ${matchingMethod.code}`,
        };
      }
    }

    // 3. Check payment submissions (historical evidence)
    if (
      this.paymentSubmissionRepository &&
      'submissions' in this.paymentSubmissionRepository
    ) {
      const submissions = (
        this.paymentSubmissionRepository as unknown as {
          submissions: Array<{ proofImageUrl: string; id: string }>;
        }
      ).submissions;
      const matchingSub = submissions.find(
        (s) =>
          s.proofImageUrl &&
          (s.proofImageUrl.includes(publicId) ||
            (secureUrl && s.proofImageUrl === secureUrl)),
      );
      if (matchingSub) {
        return {
          referenced: true,
          reason: `Asset is historical payment proof for payment submission ${matchingSub.id}`,
        };
      }
    }

    // 4. Check checkout orders
    if (this.checkoutRepository && 'orders' in this.checkoutRepository) {
      const orders = (
        this.checkoutRepository as unknown as {
          orders: OrderSnapshot[];
        }
      ).orders;
      const matchingOrder = orders.find((o) =>
        o.items.some(
          (item) =>
            item.sku.includes(publicId) ||
            (secureUrl && item.productName.includes(secureUrl)),
        ),
      );
      if (matchingOrder) {
        return {
          referenced: true,
          reason: `Asset is referenced by order ${matchingOrder.orderNumber}`,
        };
      }
    }

    // 5. Check banners
    if (this.bannerRepository) {
      const banners =
        'items' in this.bannerRepository
          ? (
              this.bannerRepository as unknown as {
                items: Array<{
                  publicId: string | null;
                  imageUrl: string;
                  title: string;
                }>;
              }
            ).items
          : (await this.bannerRepository.list({ limit: 1000 })).items;
      const matchingBanner = banners.find(
        (b) =>
          b.publicId === publicId || (secureUrl && b.imageUrl === secureUrl),
      );
      if (matchingBanner) {
        return {
          referenced: true,
          reason: `Asset is referenced by banner ("${matchingBanner.title}")`,
        };
      }
    }

    // 6. Check gallery items
    if (this.galleryRepository) {
      const items =
        'items' in this.galleryRepository
          ? (
              this.galleryRepository as unknown as {
                items: Array<{
                  publicId: string | null;
                  imageUrl: string;
                  title: string;
                }>;
              }
            ).items
          : (await this.galleryRepository.list({ limit: 1000 })).items;
      const matchingItem = items.find(
        (g) =>
          g.publicId === publicId || (secureUrl && g.imageUrl === secureUrl),
      );
      if (matchingItem) {
        return {
          referenced: true,
          reason: `Asset is referenced by gallery item ("${matchingItem.title}")`,
        };
      }
    }

    // 7. Check social media items
    if (this.socialMediaRepository) {
      const items = (await this.socialMediaRepository.list({ limit: 1000 }))
        .items;
      const matchingSocial = items.find(
        (s) =>
          s.publicId === publicId ||
          (secureUrl && s.thumbnailUrl === secureUrl),
      );
      if (matchingSocial) {
        return {
          referenced: true,
          reason: `Asset is referenced by social media item (${matchingSocial.platform})`,
        };
      }
    }

    return { referenced: false };
  }
}
