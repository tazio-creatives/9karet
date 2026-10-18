import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import styles from './PriceTierCard.module.css';

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.category) return `/${item.category.slug}`;
  if (item.collection) return `/collections/${item.collection.slug}`;
  return null;
}

export function PriceTierCard({ item }: { item: HomepageItem }) {
  const href = linkFor(item);
  const content = (
    <>
      <GemIcon />
      {item.heading && <span className={styles.label}>{item.heading}</span>}
    </>
  );

  return href ? (
    <Link to={href} className={styles.tile}>
      {content}
    </Link>
  ) : (
    <div className={styles.tile}>{content}</div>
  );
}

function GemIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 3h12l4 6-10 12L2 9l4-6z" />
      <path d="M2 9h20M8 3l4 6-4 12M16 3l-4 6 4 12" />
    </svg>
  );
}
