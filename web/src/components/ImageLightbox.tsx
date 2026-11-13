import { useEffect, useState } from 'react';
import styles from './ImageLightbox.module.css';

// Click-to-enlarge modal for a small image set (review photos) — mirrors
// features/pdp/ImageGallery.tsx's own lightbox pattern (backdrop, Escape/
// click-outside to close, prev/next when there's more than one image) so
// the interaction feels the same wherever a photo is enlarged on the site.
// The caller only ever mounts this while it should be open (conditional
// rendering), so a plain useState(startIndex) is enough — a fresh mount on
// each open already gives it the right starting index.
export function ImageLightbox({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [images.length, onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      {images.length > 1 && (
        <button
          type="button"
          className={`${styles.nav} ${styles.navPrev}`}
          aria-label="Previous image"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i - 1 + images.length) % images.length);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <img src={images[index]} alt="" className={styles.image} onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <button
          type="button"
          className={`${styles.nav} ${styles.navNext}`}
          aria-label="Next image"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i + 1) % images.length);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
      {images.length > 1 && (
        <p className={styles.counter}>
          {index + 1} / {images.length}
        </p>
      )}
    </div>
  );
}
