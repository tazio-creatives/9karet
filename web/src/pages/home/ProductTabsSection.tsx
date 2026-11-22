import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageItem, ProductCard as ProductCardType } from '../../api/types';
import { WishlistButton } from '../../components/WishlistButton';
import { QuickAddSheet } from '../../features/plp/QuickAddSheet';
import { useQuickAdd } from '../../features/plp/useQuickAdd';
import { productImageAlt } from '../../seo/productSeo';
import { formatPrice } from '../../utils/formatPrice';
import { placeholderGradient } from '../../utils/placeholderGradient';
import { productUrl } from '../../utils/productUrl';
import styles from './ProductTabsSection.module.css';

// Homepage "Product Tabs": New Arrivals / Trending / Bestsellers tabs over a
// 5-column product grid, with the admin-managed promo card in the last cell.
// The backend sends items[0] = promo card, then one item per tab (heading =
// tab name, products = that tab's products); empty tabs are already left out.
export function ProductTabsSection({ items, heading }: { items: HomepageItem[]; heading?: string | null }) {
  const promo = items[0];
  const tabs = items.slice(1).filter((t) => (t.products?.length ?? 0) > 0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const quickAdd = useQuickAdd();

  if (tabs.length === 0) return null;
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const products = (active.products ?? []).slice(0, 9);

  return (
    <section className={styles.section} aria-label={heading || 'Shop our picks'}>
      <div className={styles.tabs} role="tablist">
        {tabs.map((tab) => {
          const selected = tab.id === active.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${tab.id}-tab`}
              aria-selected={selected}
              aria-controls={`${tab.id}-panel`}
              className={`${styles.tab} ${selected ? styles.tabActive : ''}`}
              onClick={() => setActiveId(tab.id)}
            >
              {tab.heading}
            </button>
          );
        })}
      </div>

      <div className={styles.grid} role="tabpanel" id={`${active.id}-panel`} aria-labelledby={`${active.id}-tab`}>
        {products.map((product, i) => (
          <TabProductCard
            key={product.id}
            product={product}
            index={i}
            hideNewTag
            onAdd={() => quickAdd.addToCart(product)}
            isAdding={quickAdd.pendingProductId === product.id}
            justAdded={quickAdd.justAddedProductId === product.id}
            hasError={quickAdd.errorProductId === product.id}
          />
        ))}
        {promo && <PromoCard item={promo} />}
      </div>

      {quickAdd.sheetProduct && <QuickAddSheet product={quickAdd.sheetProduct} onClose={quickAdd.closeSheet} />}
    </section>
  );
}

export function TabProductCard({
  product,
  index,
  onAdd,
  isAdding,
  justAdded,
  hasError,
  hideNewTag = false,
}: {
  product: ProductCardType;
  index: number;
  onAdd: () => void;
  isAdding: boolean;
  justAdded: boolean;
  hasError: boolean;
  // Homepage: no "New" ribbon (Trending / Bestseller still show).
  hideNewTag?: boolean;
}) {
  const href = productUrl(product);
  const ribbon = product.isBestSeller
    ? 'Bestseller'
    : product.isTrending
      ? 'Trending'
      : product.isNew && !hideNewTag
        ? 'New'
        : null;
  const isOutOfStock = product.availableStock <= 0;

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <Link to={href} className={styles.mediaLink} tabIndex={-1} aria-hidden="true">
          {product.primaryImageUrl ? (
            <img src={product.primaryImageUrl} alt={productImageAlt(product)} loading="lazy" decoding="async" />
          ) : (
            <span className={styles.placeholder} style={{ background: placeholderGradient(index) }} />
          )}
        </Link>
        {ribbon && <span className={styles.ribbon}>{ribbon}</span>}
        <WishlistButton productId={product.id} className={styles.wishlist} />
        {product.ratingCount > 0 && (
          <span className={styles.rating}>
            {product.ratingAvg.toFixed(1)} <span className={styles.star}>★</span>
            <span className={styles.ratingCount}>|{product.ratingCount}</span>
          </span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.priceRow}>
          <p className={styles.price}>
            {formatPrice(product.sellingPrice)}
            {product.strikePrice > 0 && <span className={styles.strike}>{formatPrice(product.strikePrice)}</span>}
          </p>
          <button
            type="button"
            className={`${styles.addButton} ${justAdded ? styles.addButtonDone : ''} ${hasError ? styles.addButtonError : ''}`}
            onClick={onAdd}
            disabled={isAdding || isOutOfStock}
            aria-label={
              isOutOfStock
                ? `${product.name} is out of stock`
                : justAdded
                  ? `${product.name} added to cart`
                  : `Add ${product.name} to cart`
            }
            title={isOutOfStock ? 'Out of stock' : hasError ? 'Could not add — try again' : 'Add to cart'}
          >
            {isAdding ? <span className={styles.spinner} /> : justAdded ? <CheckIcon /> : <PlusIcon />}
          </button>
        </div>

        {(product.offerBadges.length > 0 || product.offerLabel) && (
          <p className={styles.offer}>
            <CoinIcon />
            <span>{product.offerBadges[0]?.label ?? product.offerLabel}</span>
          </p>
        )}

        <Link to={href} className={styles.name}>
          {product.name}
        </Link>
      </div>
    </article>
  );
}

function promoLink(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.redirectUrl) return item.redirectUrl;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.category) return `/${item.category.slug}`;
  if (item.product) return productUrl({ slug: item.product.slug, categorySlug: null });
  return null;
}

// The promo card: admin image (or a burgundy gradient), small eyebrow line,
// serif title and a cream "Explore now" button. Defaults keep it presentable
// before an admin has filled anything in.
function PromoCard({ item }: { item: HomepageItem }) {
  const href = promoLink(item) ?? '/jewellery';
  const eyebrow = item.subheading || 'The Everyday Edit';
  const title = item.heading || 'Little luxuries. Every day.';
  const cta = item.ctaLabel || 'Explore now';

  return (
    <Link to={href} className={styles.promo}>
      {item.imageUrl && (
        <picture className={styles.promoImage}>
          {item.imageUrlMobile && <source media="(max-width: 767px)" srcSet={item.imageUrlMobile} />}
          <img src={item.imageUrl} alt="" loading="lazy" decoding="async" />
        </picture>
      )}
      <span className={styles.promoShade} aria-hidden="true" />
      <span className={styles.promoText}>
        <span className={styles.promoEyebrow}>{eyebrow}</span>
        <span className={styles.promoTitle}>{title}</span>
      </span>
      <span className={styles.promoButton}>
        {cta} <span aria-hidden="true">↗</span>
      </span>
    </Link>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#e3b85b" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#b8862b" strokeWidth="1.4" />
      <path d="M9.5 9h5M9.5 11.5h5M11 9c2 0 2 4 0 4l3 3" fill="none" stroke="#8a5d14" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
