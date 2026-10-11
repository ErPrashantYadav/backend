import { prisma } from '../../lib/prisma';
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

    return { referenced: false };
  }
}
