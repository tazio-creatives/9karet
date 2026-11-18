import { useEffect, useRef, useState, type CSSProperties, type TouchEvent as ReactTouchEvent } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './HeroCarousel.module.css';

const ROTATE_MS = 6000;
// Must match the .trackAnimated transition duration in the CSS.
const SLIDE_MS = 600;
const SWIPE_THRESHOLD_PX = 40;
// Kept in sync with the media query in HeroCarousel.module.css — the
// <source> breakpoint below must match the CSS one, otherwise the browser
// and the layout would switch images at different widths.
const MOBILE_BREAKPOINT = '(max-width: 767px)';

// The uploaded banner image already contains its own heading/description/
// CTA artwork, so there is nothing visible to label it with — this is
// screen-reader-only text, never rendered on the page itself.
function ariaLabelFor(item: HomepageItem): string {
  return item.name || item.category?.name || item.collection?.name || item.product?.name || 'Promotional banner';
}

export function HeroCarousel({ items }: { items: HomepageItem[] }) {
  // Position on the track. With 2+ slides the track is
  // [clone of last, ...slides, clone of first], so the neighbours always
  // peek in on both sides; after sliding onto a clone the track jumps
  // (without animation) to the real slide it copies.
  const [pos, setPos] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const hasMultiple = items.length > 1;
  const isPaused = isHovering || isTouching || isFocused;

  const count = items.length;
  const active = hasMultiple ? (((pos - 1) % count) + count) % count : 0;

  function goTo(index: number) {
    setAnimate(true);
    setPos(index + 1);
  }
  // If the track is still sitting on a clone (its jump back didn't run,
  // e.g. the tab was in the background), first snap to the real slide the
  // clone copies (looks identical), then animate from there on the next frame.
  function step(dir: 1 | -1) {
    if (pos <= 0 || pos >= count + 1) {
      const real = pos <= 0 ? count : 1;
      setAnimate(false);
      setPos(real);
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          setAnimate(true);
          setPos(real + dir);
        }),
      );
      return;
    }
    setAnimate(true);
    setPos(pos + dir);
  }
  const next = () => step(1);
  const prev = () => step(-1);
  // Always-current next() for the autoplay timer.
  const nextRef = useRef(next);
  nextRef.current = next;

  // After sliding onto a clone, jump (without animation) to the real slide
  // it copies once the slide animation has finished. A timer rather than
  // transitionend, which some browsers skip (background tabs, reduced motion).
  useEffect(() => {
    if (!hasMultiple || (pos !== 0 && pos !== count + 1)) return;
    const id = window.setTimeout(() => {
      setAnimate(false);
      setPos(pos === 0 ? count : 1);
    }, SLIDE_MS + 50);
    return () => window.clearTimeout(id);
  }, [pos, count, hasMultiple]);

  // Re-enable the slide animation one frame after an instant jump.
  useEffect(() => {
    if (animate) return;
    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setAnimate(true)));
    return () => window.cancelAnimationFrame(id);
  }, [animate]);

  // Item list changed (admin edit / refetch): restart from the first slide.
  useEffect(() => {
    setAnimate(false);
    setPos(1);
  }, [count]);

  useEffect(() => {
    if (!hasMultiple || isPaused) return;
    const id = window.setInterval(() => nextRef.current(), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, hasMultiple, isPaused]);

  // Pause while browser focus is anywhere inside the slider (keyboard users
  // tabbing to the prev/next buttons or the banner link itself).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    function onFocusIn() {
      setIsFocused(true);
    }
    function onFocusOut(e: FocusEvent) {
      if (!el?.contains(e.relatedTarget as Node)) setIsFocused(false);
    }
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);
    return () => {
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  function onTouchStart(e: ReactTouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    setIsTouching(true);
  }
  function onTouchMove(e: ReactTouchEvent) {
    if (touchStartX.current == null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }
  function onTouchEnd() {
    if (touchDeltaX.current > SWIPE_THRESHOLD_PX) prev();
    else if (touchDeltaX.current < -SWIPE_THRESHOLD_PX) next();
    touchStartX.current = null;
    touchDeltaX.current = 0;
    setIsTouching(false);
  }

  if (count === 0) return null;
  const slides = hasMultiple ? [items[count - 1], ...items, items[0]] : items;
  const touchHandlers = { onTouchStart, onTouchMove, onTouchEnd };

  return (
    <div
      className={styles.hero}
      ref={wrapRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      aria-roledescription="carousel"
    >
      <div className={styles.viewport} {...touchHandlers}>
        <div
          className={`${styles.track} ${animate ? styles.trackAnimated : ''}`}
          style={{ '--pos': hasMultiple ? pos : 0 } as CSSProperties}
        >
          {slides.map((item, i) => {
            const realIndex = hasMultiple ? (i - 1 + count) % count : i;
            const isCurrent = hasMultiple ? i === pos : true;
            return (
              <Slide
                key={`${item.id}-${i}`}
                item={item}
                index={realIndex}
                isCurrent={isCurrent}
                isClone={hasMultiple && (i === 0 || i === slides.length - 1)}
                onPeekClick={!isCurrent ? () => (i < pos ? prev() : next()) : undefined}
              />
            );
          })}
        </div>

        {hasMultiple && (
          <>
            <button type="button" className={`${styles.arrow} ${styles.arrowPrev}`} aria-label="Previous slide" onClick={prev}>
              <ChevronIcon direction="left" />
            </button>
            <button type="button" className={`${styles.arrow} ${styles.arrowNext}`} aria-label="Next slide" onClick={next}>
              <ChevronIcon direction="right" />
            </button>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className={styles.dotsRow}>
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              className={`${styles.dot} ${i === active ? styles.dotActive : ''}`}
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === active}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Slide({
  item,
  index,
  isCurrent,
  isClone,
  onPeekClick,
}: {
  item: HomepageItem;
  index: number;
  isCurrent: boolean;
  isClone: boolean;
  onPeekClick?: () => void;
}) {
  const label = ariaLabelFor(item);
  // No separately-uploaded mobile image — the desktop image stands in on
  // mobile too, at its own natural ratio (see .mediaWrapFallback).
  const isMobileFallback = !item.imageUrlMobile;
  const media = item.imageUrl ? (
    <picture>
      {item.imageUrlMobile && <source media={MOBILE_BREAKPOINT} srcSet={item.imageUrlMobile} />}
      <img
        src={item.imageUrl}
        alt={isClone ? '' : `${label} — 9KARET`}
        className={styles.bgImg}
        loading={isCurrent || index === 0 ? 'eager' : 'lazy'}
        fetchPriority={isCurrent && index === 0 ? 'high' : undefined}
        decoding="async"
      />
    </picture>
  ) : (
    <div className={styles.bgImg} style={{ background: placeholderGradient(index) }} />
  );
  const className = `${styles.slide} ${isCurrent ? styles.slideCurrent : ''} ${isMobileFallback ? styles.mediaWrapFallback : ''}`;
  const hidden = !isCurrent;

  // Side (peeking) slides: clicking one moves the slider to it instead of
  // following its link.
  if (onPeekClick) {
    return (
      <div className={className} aria-hidden="true" onClick={onPeekClick}>
        {media}
      </div>
    );
  }
  if (item.redirectUrl) {
    return (
      <Link
        to={item.redirectUrl}
        target={item.openInNewTab ? '_blank' : undefined}
        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
        className={className}
        aria-label={label}
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : undefined}
      >
        {media}
      </Link>
    );
  }
  return (
    <div className={className} aria-label={label} role="img" aria-hidden={hidden || undefined}>
      {media}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}
