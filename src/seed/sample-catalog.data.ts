import { normalizeCatalogSlug } from '../utils/slug';
import {
  normalizeSize,
  normalizeSku,
} from '../modules/products/products.service';

export interface SampleCategoryData {
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
}

export interface SampleBrandData {
  name: string;
  slug: string;
  displayOrder: number;
  isActive: boolean;
}

export interface SampleVariantData {
  sku: string;
  sizeMilliliters: number;
  sizeLabel: string;
  purchasePrice: string;
  sellingPrice: string;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
}

export interface SampleProductData {
  name: string;
  slug: string;
  categorySlug: string;
  brandSlug: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FIXED' | null;
  discountValue: string | null;
  isActive: boolean;
  variants: SampleVariantData[];
}

export const SAMPLE_CATEGORIES: SampleCategoryData[] = [
  {
    name: 'Whisky',
    slug: normalizeCatalogSlug('whisky'),
    description:
      'Distilled alcoholic beverage made from fermented grain mash. (Sample Test Catalog)',
    displayOrder: 1,
    isActive: true,
  },
  {
    name: 'Vodka',
    slug: normalizeCatalogSlug('vodka'),
    description:
      'Clear distilled spirit filtered for purity and smoothness. (Sample Test Catalog)',
    displayOrder: 2,
    isActive: true,
  },
  {
    name: 'Rum',
    slug: normalizeCatalogSlug('rum'),
    description:
      'Distilled spirit crafted from sugarcane molasses. (Sample Test Catalog)',
    displayOrder: 3,
    isActive: true,
  },
  {
    name: 'Beer',
    slug: normalizeCatalogSlug('beer'),
    description:
      'Fermented cereal grain brew crafted for refreshing flavor. (Sample Test Catalog)',
    displayOrder: 4,
    isActive: true,
  },
  {
    name: 'Wine',
    slug: normalizeCatalogSlug('wine'),
    description:
      'Fermented fruit beverage featuring selected grape varietals. (Sample Test Catalog)',
    displayOrder: 5,
    isActive: true,
  },
];

export const SAMPLE_BRANDS: SampleBrandData[] = [
  {
    name: 'Old Durbar',
    slug: normalizeCatalogSlug('old-durbar'),
    displayOrder: 1,
    isActive: true,
  },
  {
    name: 'Khukri',
    slug: normalizeCatalogSlug('khukri'),
    displayOrder: 2,
    isActive: true,
  },
  {
    name: 'Ruslan',
    slug: normalizeCatalogSlug('ruslan'),
    displayOrder: 3,
    isActive: true,
  },
  {
    name: 'Gorkha',
    slug: normalizeCatalogSlug('gorkha'),
    displayOrder: 4,
    isActive: true,
  },
  {
    name: 'Divine Wines',
    slug: normalizeCatalogSlug('divine-wines'),
    displayOrder: 5,
    isActive: true,
  },
];

export const SAMPLE_PRODUCTS: SampleProductData[] = [
  {
    name: 'Old Durbar Black Chimney Blended Peated Whisky',
    slug: normalizeCatalogSlug('old-durbar-black-chimney'),
    categorySlug: normalizeCatalogSlug('whisky'),
    brandSlug: normalizeCatalogSlug('old-durbar'),
    description:
      'Peated reserve blended malt whisky aged in charred oak barrels. (Sample Test Catalog)',
    discountType: null,
    discountValue: null,
    isActive: true,
    variants: [
      {
        sku: normalizeSku('SAMPLE-OD-BC-750ML'),
        sizeMilliliters: 750,
        sizeLabel: normalizeSize('750 ml').sizeLabel,
        purchasePrice: '2800.00',
        sellingPrice: '3350.00',
        stock: 45,
        lowStockThreshold: 10,
        isActive: true,
      },
      {
        sku: normalizeSku('SAMPLE-OD-BC-375ML'),
        sizeMilliliters: 375,
        sizeLabel: normalizeSize('375 ml').sizeLabel,
        purchasePrice: '1450.00',
        sellingPrice: '1750.00',
        stock: 30,
        lowStockThreshold: 8,
        isActive: true,
      },
      {
        sku: normalizeSku('SAMPLE-OD-BC-180ML'),
        sizeMilliliters: 180,
        sizeLabel: normalizeSize('180 ml').sizeLabel,
        purchasePrice: '750.00',
        sellingPrice: '900.00',
        stock: 60,
        lowStockThreshold: 15,
        isActive: true,
      },
    ],
  },
  {
    name: 'Old Durbar 12 Years Blended Reserve Whisky',
    slug: normalizeCatalogSlug('old-durbar-12-years-reserve'),
    categorySlug: normalizeCatalogSlug('whisky'),
    brandSlug: normalizeCatalogSlug('old-durbar'),
    description:
      'Aged 12 years reserve malt blend with smooth smoky character. (Sample Test Catalog)',
    discountType: 'PERCENTAGE',
    discountValue: '5.00',
    isActive: true,
    variants: [
      {
        sku: normalizeSku('SAMPLE-OD-12Y-750ML'),
        sizeMilliliters: 750,
        sizeLabel: normalizeSize('750 ml').sizeLabel,
        purchasePrice: '3600.00',
        sellingPrice: '4200.00',
        stock: 25,
        lowStockThreshold: 5,
        isActive: true,
      },
      {
        sku: normalizeSku('SAMPLE-OD-12Y-375ML'),
        sizeMilliliters: 375,
        sizeLabel: normalizeSize('375 ml').sizeLabel,
        purchasePrice: '1900.00',
        sellingPrice: '2250.00',
        stock: 20,
        lowStockThreshold: 5,
        isActive: true,
      },
    ],
  },
  {
    name: 'Khukri XXX Coronation Rum',
    slug: normalizeCatalogSlug('khukri-xxx-coronation-rum'),
    categorySlug: normalizeCatalogSlug('rum'),
    brandSlug: normalizeCatalogSlug('khukri'),
    description:
      'Special coronation edition Himalayan rum bottled in the classic dagger decanter. (Sample Test Catalog)',
    discountType: null,
    discountValue: null,
    isActive: true,
    variants: [
      {
        sku: normalizeSku('SAMPLE-KH-CR-375ML'),
        sizeMilliliters: 375,
        sizeLabel: normalizeSize('375 ml').sizeLabel,
        purchasePrice: '1600.00',
        sellingPrice: '1950.00',
        stock: 15,
        lowStockThreshold: 5,
        isActive: true,
      },
    ],
  },
  {
    name: 'Khukri Spice Rum',
    slug: normalizeCatalogSlug('khukri-spice-rum'),
    categorySlug: normalizeCatalogSlug('rum'),
    brandSlug: normalizeCatalogSlug('khukri'),
    description:
      'Himalayan rum infused with natural spices and rich honey undertones. (Sample Test Catalog)',
    discountType: 'FIXED',
    discountValue: '100.00',
    isActive: true,
    variants: [
      {
        sku: normalizeSku('SAMPLE-KH-SP-750ML'),
        sizeMilliliters: 750,
        sizeLabel: normalizeSize('750 ml').sizeLabel,
        purchasePrice: '1600.00',
        sellingPrice: '1900.00',
        stock: 50,
        lowStockThreshold: 12,
        isActive: true,
      },
      {
        sku: normalizeSku('SAMPLE-KH-SP-375ML'),
        sizeMilliliters: 375,
        sizeLabel: normalizeSize('375 ml').sizeLabel,
        purchasePrice: '850.00',
        sellingPrice: '1000.00',
        stock: 40,
        lowStockThreshold: 10,
        isActive: true,
      },
    ],
  },
  {
    name: 'Ruslan Ultra Premium Vodka',
    slug: normalizeCatalogSlug('ruslan-ultra-premium-vodka'),
    categorySlug: normalizeCatalogSlug('vodka'),
    brandSlug: normalizeCatalogSlug('ruslan'),
    description:
      'Triple-distilled pure grain spirit filtered through active charcoal columns. (Sample Test Catalog)',
    discountType: null,
    discountValue: null,
    isActive: true,
    variants: [
      {
        sku: normalizeSku('SAMPLE-RU-UP-750ML'),
        sizeMilliliters: 750,
        sizeLabel: normalizeSize('750 ml').sizeLabel,
        purchasePrice: '1500.00',
        sellingPrice: '1800.00',
        stock: 60,
        lowStockThreshold: 15,
        isActive: true,
      },
      {
        sku: normalizeSku('SAMPLE-RU-UP-375ML'),
        sizeMilliliters: 375,
        sizeLabel: normalizeSize('375 ml').sizeLabel,
        purchasePrice: '800.00',
        sellingPrice: '950.00',
        stock: 50,
        lowStockThreshold: 12,
        isActive: true,
      },
      {
        sku: normalizeSku('SAMPLE-RU-UP-180ML'),
        sizeMilliliters: 180,
        sizeLabel: normalizeSize('180 ml').sizeLabel,
        purchasePrice: '420.00',
        sellingPrice: '500.00',
        stock: 80,
        lowStockThreshold: 20,
        isActive: true,
      },
    ],
  },
  {
    name: 'Gorkha Premium Craft Beer',
    slug: normalizeCatalogSlug('gorkha-premium-craft-beer'),
    categorySlug: normalizeCatalogSlug('beer'),
    brandSlug: normalizeCatalogSlug('gorkha'),
    description:
      'Authentic premium lager brewed with finest two-row malt and aromatic hops. (Sample Test Catalog)',
    discountType: null,
    discountValue: null,
    isActive: true,
    variants: [
      {
        sku: normalizeSku('SAMPLE-GK-PB-650ML'),
        sizeMilliliters: 650,
        sizeLabel: normalizeSize('650 ml').sizeLabel,
        purchasePrice: '280.00',
        sellingPrice: '340.00',
        stock: 120,
        lowStockThreshold: 24,
        isActive: true,
      },
      {
        sku: normalizeSku('SAMPLE-GK-PB-330ML'),
        sizeMilliliters: 330,
        sizeLabel: normalizeSize('330 ml').sizeLabel,
        purchasePrice: '160.00',
        sellingPrice: '200.00',
        stock: 100,
        lowStockThreshold: 24,
        isActive: true,
      },
    ],
  },
  {
    name: 'Divine Red Wine Classic Reserve',
    slug: normalizeCatalogSlug('divine-red-wine-classic-reserve'),
    categorySlug: normalizeCatalogSlug('wine'),
    brandSlug: normalizeCatalogSlug('divine-wines'),
    description:
      'Full-bodied ruby red wine with ripe berry notes and balanced tannins. (Sample Test Catalog)',
    discountType: 'PERCENTAGE',
    discountValue: '10.00',
    isActive: true,
    variants: [
      {
        sku: normalizeSku('SAMPLE-DW-RC-750ML'),
        sizeMilliliters: 750,
        sizeLabel: normalizeSize('750 ml').sizeLabel,
        purchasePrice: '850.00',
        sellingPrice: '1050.00',
        stock: 35,
        lowStockThreshold: 8,
        isActive: true,
      },
    ],
  },
];
