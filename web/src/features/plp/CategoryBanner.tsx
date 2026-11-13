import type { CategoryBanner as CategoryBannerData } from '../../api/types';
import styles from './CategoryBanner.module.css';

const MOBILE_BREAKPOINT = '(max-width: 767px)';

const TEXT_POSITION_CLASS: Record<CategoryBannerData['textPosition'], string> = {
  LEFT: styles.posLeft,
  CENTER: styles.posCenter,
  RIGHT: styles.posRight,
};

const FOCAL_POSITION_VALUE: Record<CategoryBannerData['focalPosition'], string> = {
  LEFT: 'left center',
  CENTER: 'center',
  RIGHT: 'right center',
};

interface CategoryBannerProps {
  banner: CategoryBannerData;
  title: string;
}

// The page's single H1 lives in ProductListing's always-rendered mobile
// header (Google indexes mobile-first) — the banner image's own artwork is
// the visual title, and `title` is its alt-text fallback. No CTA — the
// customer is already on this category's page.
export function CategoryBanner({ banner, title }: CategoryBannerProps) {
  if (!banner.imageUrl) return null;

  const textClass = banner.textColor === 'DARK' ? styles.textDark : styles.textLight;
  const focalPosition = FOCAL_POSITION_VALUE[banner.focalPosition];

  return (
    <div className={`${styles.banner} ${textClass}`} style={{ ['--banner-focal-position' as string]: focalPosition }}>
      <picture>
        {banner.imageUrlMobile && <source media={MOBILE_BREAKPOINT} srcSet={banner.imageUrlMobile} />}
        <img
          src={banner.imageUrl}
          alt={banner.altText || title}
          className={styles.img}
          style={{ objectPosition: focalPosition }}
          width={1920}
          height={600}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      {banner.textColor === 'LIGHT' && <div className={styles.scrim} aria-hidden="true" />}

      <div className={`${styles.copy} ${TEXT_POSITION_CLASS[banner.textPosition]}`}>
        {banner.eyebrow && <p className={styles.eyebrow}>{banner.eyebrow}</p>}
        {banner.description && <p className={styles.description}>{banner.description}</p>}
      </div>
    </div>
  );
}
