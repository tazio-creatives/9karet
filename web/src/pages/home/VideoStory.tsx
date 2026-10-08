import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import styles from './VideoStory.module.css';

// "Video Story": a gold eyebrow line, large serif title, text and button
// beside a framed video. The cover image shows with a big play button; a
// click plays the video with sound and the browser's own controls (time,
// progress, volume, fullscreen). Nothing downloads until then.
export function VideoStory({
  item,
  heading,
  subheading,
  ctaLabel,
  ctaUrl,
}: {
  item: HomepageItem;
  heading?: string | null;
  subheading?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  if (!item?.videoUrl) return null;
  const label = item.heading || heading || 'Video';
  const eyebrow = item.subheading;

  function start() {
    setStarted(true);
    videoRef.current?.play().catch(() => {});
  }

  return (
    <section className={styles.band}>
      <div className={styles.inner}>
        <div className={styles.text}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          {heading && <h2 className={styles.heading}>{heading}</h2>}
          {subheading && <p className={styles.subheading}>{subheading}</p>}
          {ctaLabel && ctaUrl && (
            <Link to={ctaUrl} className={styles.cta}>
              {ctaLabel}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M4 12h15M13 6l6 6-6 6" />
              </svg>
            </Link>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.frame}>
            <video
              ref={videoRef}
              className={styles.video}
              src={item.videoUrl}
              poster={item.imageUrl ?? undefined}
              // Without a cover image, fetch just enough to show the first frame.
              preload={item.imageUrl ? 'none' : 'metadata'}
              playsInline
              controls={started}
              aria-label={label}
            />
            {!started && (
              <button type="button" className={styles.play} onClick={start} aria-label={`Play video: ${label}`}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
