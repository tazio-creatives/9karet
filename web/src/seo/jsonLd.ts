import type { ProductDetail } from '../api/types';
import { SITE_URL, SOCIAL_LINKS } from '../config';

// JSON-LD builders (plan §1a/§13): Organization sitewide, BreadcrumbList
// everywhere, Product on PDP — rendered server-side into <head> so it's
// present in the initial HTML search engines see, not injected after the
// fact by client JS.

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

// Other ways people write the brand — Google uses alternateName (on both
// Organization and WebSite) to connect these spellings to this site's
// "site name" in results.
const BRAND_ALTERNATE_NAMES = ['Box Diamonds', 'BoxDiamonds', 'boxdiamonds.com'];

// OnlineStore is schema.org's Organization subtype for an online shop — tells
// search engines BOX DIAMONDS is a jewellery brand/store, not a "diamond box"
// product. sameAs lists the brand's real social profiles (config.ts) so
// Google links them to this site.
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': ORGANIZATION_ID,
    name: 'BOX DIAMONDS',
    alternateName: BRAND_ALTERNATE_NAMES,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/images/logo.png`,
    email: 'info@boxdiamonds.com',
    sameAs: Object.values(SOCIAL_LINKS),
    description: 'Certified Natural Diamond Jewellery',
  };
}

// Homepage only. No SearchAction: the storefront has no URL-driven search
// results page for one to point at.
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'BOX DIAMONDS',
    alternateName: BRAND_ALTERNATE_NAMES,
    url: `${SITE_URL}/`,
    description: 'Certified Natural Diamond Jewellery',
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

// Offer-level shipping and returns, matching what's configured in Google
// Merchant Center and the site's Shipping and Return & Refund policies: free
// shipping across India; 4-5 days to make/pack (made to order) + 3-4 days in
// transit; 7-day free return by courier pickup — unless the product (or its
// category) is non-returnable, e.g. solitaires.
const SHIPPING_DETAILS = {
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'INR' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 4, maxValue: 5, unitCode: 'DAY' },
    transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 4, unitCode: 'DAY' },
  },
};

function returnPolicy(nonReturnable: boolean) {
  return nonReturnable
    ? {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
      }
    : {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      };
}

export function productJsonLd(product: ProductDetail, canonicalPath: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    // Handmade jewellery has no GTIN barcode; the brand is the identifier
    // Google accepts instead.
    brand: { '@type': 'Brand', name: 'BOX DIAMONDS' },
    description: product.shortDescription ?? product.name,
    image: product.images.filter((img) => img.variant === 'large').map((img) => img.url),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: product.sellingPrice,
      // Zero-stock pieces are still sold as Make to Order (cart/checkout
      // accept them), so they're orderable — Google's "in stock" means
      // "accepting orders and can fulfil them". The making time is covered by
      // the handling time set in Merchant Center, not by a back-order date.
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}${canonicalPath}`,
      shippingDetails: SHIPPING_DETAILS,
      hasMerchantReturnPolicy: returnPolicy(!!product.nonReturnable),
    },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAvg,
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };
}
