import { useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import type { ProductImage } from '../../api/types';
import { placeholderGradient } from '../../utils/placeholderGradient';
import { WishlistButton } from '../../components/WishlistButton';
import styles from './ImageGallery.module.css';

// Each uploaded photo is stored as several rows sharing one sortOrder — one
// per size (thumbnail/small/medium/large/original) and, for large, one per
// format (avif/webp). Grouping by sortOrder collapses that back into one
// displayable photo instead of showing every format/size as a duplicate
// thumbnail.
// AVIF first — same visual quality at a smaller (or at worst equal) file
// size than WebP, since it's the newer, more efficient codec; WebP is only
// a fallback for the rare browser without AVIF support (all evergreen
// browsers — Chrome/Firefox/Edge/Safari 16+ — decode it natively).
function pickUrl(rows: ProductImage[], preferredVariant: string): string | undefined {
  return (
    rows.find((r) => r.variant === preferredVariant && r.format === 'avif')?.url ??
    rows.find((r) => r.variant === preferredVariant && r.format === 'webp')?.url ??
    rows.find((r) => r.variant === preferredVariant)?.url ??
    rows.find((r) => r.variant === 'large' && r.format === 'avif')?.url ??
    rows.find((r) => r.variant === 'large' && r.format === 'webp')?.url ??
    rows.find((r) => r.variant === 'large')?.url ??
    rows.find((r) => r.variant === 'original')?.url ??
    rows[0]?.url
  );
}

interface GalleryPhoto {
  id: string;
  mainUrl: string;
  thumbUrl: string;
  type: ProductImage['type'];
}

function groupPhotos(images: ProductImage[]): GalleryPhoto[] {
  const groups = new Map<number, ProductImage[]>();
  for (const img of images) {
    if (!groups.has(img.sortOrder)) groups.set(img.sortOrder, []);
    groups.get(img.sortOrder)!.push(img);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, rows]) => ({
      id: rows[0].id,
      mainUrl: pickUrl(rows, 'large') as string,
      thumbUrl: pickUrl(rows, 'small') as string,
      type: rows[0].type,
    }))
    .filter((photo) => !!photo.mainUrl);
}

export function ImageGallery({
  images,
  productName,
  imageAlt = productName,
  productId,
  isNew,
}: {
  images: ProductImage[];
  productName: string;
  // Descriptive alt for the product photos (falls back to the name).
  imageAlt?: string;
  productId: string;
  isNew: boolean;
}) {
  const displayImages = groupPhotos(images);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const isSwiping = useRef(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = mainRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  };

  const SWIPE_THRESHOLD = 40;

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaX.current = 0;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Only treat it as a gallery swipe once horizontal movement clearly
    // dominates vertical — otherwise a vertical page scroll starting on the
    // gallery would get hijacked into flipping images.
    if (!isSwiping.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      isSwiping.current = true;
    }
    if (isSwiping.current) touchDeltaX.current = dx;
  };

  const handleTouchEnd = () => {
    const dx = touchDeltaX.current;
    if (isSwiping.current && displayImages.length > 1) {
      if (dx > SWIPE_THRESHOLD) goPrev();
      else if (dx < -SWIPE_THRESHOLD) goNext();
    }
    touchStartX.current = null;
    touchStartY.current = null;
    touchDeltaX.current = 0;
    isSwiping.current = false;
  };

  // No upload flow exists yet (Phase 9/15) — every product renders this
  // gradient placeholder today, same convention as ProductCard/BentoCard.
  if (displayImages.length === 0) {
    return (
      <div className={styles.gallery}>
        <div className={styles.main}>
          <div
            className={styles.placeholder}
            style={{ background: placeholderGradient(0) }}
            role="img"
            aria-label={productName}
          />
          <div className={styles.overlayBadges}>{isNew && <span className={styles.badgeNew}>New</span>}</div>
          <WishlistButton productId={productId} className={styles.overlayWishlist} />
        </div>
      </div>
    );
  }

  const goPrev = () => setActiveIndex((i) => (i - 1 + displayImages.length) % displayImages.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % displayImages.length);

  const activePhoto = displayImages[activeIndex];
  const activeUrl = activePhoto.mainUrl;
  // The Product Size Image is a square diagram with its ruler axis, origin
  // and labels right at the edges — object-fit: cover (used for every other,
  // landscape-ish product photo) crops those off in the 4:3 main frame. This
  // one needs the whole square visible, letterboxed instead of cropped.
  const isSizeGuide = activePhoto.type === 'PRODUCT_SIZE';

  return (
    <div className={styles.gallery}>
      <div
        ref={mainRef}
        className={styles.main}
        onMouseEnter={() => setIsZooming(true)}
        onMouseLeave={() => setIsZooming(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setLightboxOpen(true)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={activeUrl}
          alt={isSizeGuide ? `${productName} size guide` : imageAlt}
          className={isSizeGuide ? `${styles.mainImage} ${styles.productSizeImage}` : styles.mainImage}
          style={isSizeGuide ? { objectFit: 'contain' } : undefined}
        />
        {/* The follow-mouse 200% magnify pane makes sense for a regular photo
            but shows only a small cropped region at a time — exactly what
            looked like "left/right cut off" for the size-guide diagram,
            whose whole point is being seen in full. Skip it for that type;
            the zoom-hint button below still opens the full, uncropped
            lightbox view. */}
        {isZooming && !isSizeGuide && (
          <div
            className={styles.zoomPane}
            style={{ backgroundImage: `url(${activeUrl})`, backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%` }}
          />
        )}
        <div className={styles.overlayBadges}>{isNew && <span className={styles.badgeNew}>New</span>}</div>
        <WishlistButton productId={productId} className={styles.overlayWishlist} />
        <button
          type="button"
          className={styles.zoomHint}
          aria-label="View larger image"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxOpen(true);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M11 8v6M8 11h6" />
          </svg>
        </button>
        {/* Mobile-only overlay position indicator (see .carouselPagination's
            own media query) — additive to the thumbnail row below, which
            stays as-is on every width. */}
        {displayImages.length > 1 && (
          <div className={styles.carouselPagination} role="tablist" aria-label="Image pagination">
            {displayImages.map((img, i) => (
              <button
                key={img.id}
                type="button"
                className={i === activeIndex ? `${styles.carouselPaginationDot} ${styles.active}` : styles.carouselPaginationDot}
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={`Go to image ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(i);
                }}
              />
            ))}
          </div>
        )}
      </div>
      {displayImages.length > 1 && (
        <div className={styles.thumbRow}>
          <button type="button" className={styles.navButton} onClick={goPrev} aria-label="Previous image">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className={styles.thumbs}>
            {displayImages.map((img, i) => (
              <button
                key={img.id}
                type="button"
                className={i === activeIndex ? styles.thumbActive : styles.thumb}
                onClick={() => setActiveIndex(i)}
                aria-label={`View image ${i + 1}`}
              >
                <img
                  src={img.thumbUrl}
                  alt=""
                  className={img.type === 'PRODUCT_SIZE' ? styles.sizeGuideThumbImg : undefined}
                />
                {img.type === 'PRODUCT_SIZE' && <span className={styles.sizeGuideLabel}>Size Guide</span>}
              </button>
            ))}
          </div>
          <button type="button" className={styles.navButton} onClick={goNext} aria-label="Next image">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
      {lightboxOpen && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxOpen(false)}>
          <button
            type="button"
            className={styles.lightboxClose}
            aria-label="Close"
            onClick={() => setLightboxOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          {displayImages.length > 1 && (
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxNavPrev}`}
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <img
            src={activeUrl}
            alt={isSizeGuide ? `${productName} size guide` : imageAlt}
            className={styles.lightboxImage}
            onClick={(e) => e.stopPropagation()}
          />
          {displayImages.length > 1 && (
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxNavNext}`}
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
