import { useEffect, useRef } from 'react';
import {
  DiamondIcon,
  HallmarkIcon,
  BuybackIcon,
  ExchangeIcon,
  ShieldCheckIcon,
} from '../../components/assuranceIcons';
import styles from './AssuranceStrip.module.css';

const ASSURANCES = [
  { Icon: DiamondIcon, title: '100% Certified Diamonds', description: 'IGI / GIA Certified' },
  { Icon: HallmarkIcon, title: 'BIS Hallmarked Gold', description: 'Trusted Purity' },
  { Icon: BuybackIcon, title: 'Buyback Guarantee', description: 'Better Value, Always' },
  { Icon: ExchangeIcon, title: 'Exchange Support', description: 'Easy & Flexible' },
  { Icon: ShieldCheckIcon, title: 'Secure Payments', description: 'Safe & Reliable' },
] as const;

// Static, non-CMS content (plan: "Do not add an admin configuration
// screen") — placed directly below the HERO section by HomePage.tsx, not
// part of the data-driven HomepageSection switch, since it isn't a
// homepage_sections row and has no per-instance content to vary.
export function AssuranceStrip() {
  const stripRef = useRef<HTMLElement>(null);

  // Phones and tablets only — desktop shows all 5 items at once, nothing to slide.
  // Pauses while the user is touching/dragging the strip themselves so
  // auto-advance never fights a manual swipe, then resumes a few seconds
  // after they let go.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let paused = false;
    let resumeTimer: ReturnType<typeof setTimeout>;
    const pause = () => {
      paused = true;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        paused = false;
      }, 4000);
    };

    strip.addEventListener('touchstart', pause, { passive: true });
    strip.addEventListener('pointerdown', pause);

    const interval = setInterval(() => {
      if (paused) return;
      const itemWidth = strip.firstElementChild?.getBoundingClientRect().width;
      if (!itemWidth) return;
      const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4;
      strip.scrollTo({ left: atEnd ? 0 : strip.scrollLeft + itemWidth, behavior: 'smooth' });
    }, 1800);

    return () => {
      clearInterval(interval);
      clearTimeout(resumeTimer);
      strip.removeEventListener('touchstart', pause);
      strip.removeEventListener('pointerdown', pause);
    };
  }, []);

  return (
    <section className={styles.strip} aria-label="Shopping assurances" ref={stripRef}>
      {ASSURANCES.map(({ Icon, title, description }) => (
        <div className={styles.item} key={title}>
          <span className={styles.icon}>
            <Icon />
          </span>
          <div className={styles.text}>
            <p className={styles.title}>{title}</p>
            <p className={styles.description}>{description}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
