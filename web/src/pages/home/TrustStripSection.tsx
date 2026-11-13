import type { HomepageItem } from '../../api/types';
import styles from './TrustStripSection.module.css';

export function TrustStripSection({ items }: { items: HomepageItem[] }) {
  return (
    <div className={styles.strip}>
      {items.map((item) => (
        <div key={item.id} className={styles.item}>
          <CheckIcon />
          <span>{item.heading}</span>
        </div>
      ))}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}
