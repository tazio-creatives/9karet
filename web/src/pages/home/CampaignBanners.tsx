import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { productUrl } from '../../utils/productUrl';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './CampaignBanners.module.css';

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.category) return `/${item.category.slug}`;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.product) return productUrl({ slug: item.product.slug, categorySlug: null });
  return null;
}

function imageFor(item: HomepageItem): string | null {
  return item.imageUrl ?? item.category?.imageUrl ?? item.product?.imageUrl ?? null;
}

function BannerCard({ item, index }: { item: HomepageItem; index: number }) {
  const href = linkFor(item);
  const image = imageFor(item);
  const style = image ? undefined : { background: placeholderGradient(index) };

  const content = (
    <>
      {image && <img src={image} alt={item.heading ?? '9KARET jewellery campaign'} loading="lazy" decoding="async" />}
      {item.heading && (
        <div className={styles.bannerContent}>
          <p className={styles.bannerTitle}>{item.heading}</p>
        </div>
      )}
    </>
  );

  return href ? (
    <Link to={href} className={styles.bannerCard} style={style}>
      {content}
    </Link>
  ) : (
    <div className={styles.bannerCard} style={style}>
      {content}
    </div>
  );
}

// Seconds per card in the slow continuous crawl — a fixed per-card pace
// (rather than a fixed total duration) keeps the speed constant whether a
// section has 4 banners or 10, instead of speeding up as more get added.
const SECONDS_PER_CARD = 7;

// Edge-to-edge row of tall promotional/campaign banners (brand collabs,
// seasonal drops) — admin-curated homepage_items, each an image with an
// optional heading overlay. Distinct from OCCASION_CARDS/COLLECTION_CARDS
// (those tie to a category/collection grid); this is pure editorial content,
// most banners carry their own baked-in artwork/text.
//
// Auto-scrolls as a continuous "slow motion" marquee (not the paginated
// jump-per-interval style of ProductCarousel) — the track renders the item
// list twice back to back and animates from translateX(0) to translateX(-50%),
// which is exactly the width of one copy, so the loop seam is invisible.
// Pauses on hover via plain CSS (:hover + animation-play-state), no JS state
// needed. Single-item sections skip the animation entirely — nothing to loop.
export function CampaignBanners({ items, heading }: { items: HomepageItem[]; heading?: string | null }) {
  if (items.length === 0) return null;

  const isLooping = items.length > 1;
  const loopItems = isLooping ? [...items, ...items] : items;
  const duration = items.length * SECONDS_PER_CARD;

  return (
    <section className={styles.campaignSection}>
      {heading && <h2 className={styles.campaignHeading}>{heading}</h2>}
      <div className={styles.bannerRow}>
        <div
          className={`${styles.bannerTrack} ${isLooping ? styles.bannerTrackAnimated : ''}`}
          style={isLooping ? ({ '--marquee-duration': `${duration}s` } as CSSProperties) : undefined}
        >
          {loopItems.map((item, i) => (
            <BannerCard key={`${item.id}-${i}`} item={item} index={i % items.length} />
          ))}
        </div>
      </div>
    </section>
  );
}
