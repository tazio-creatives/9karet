import styles from './TrustStripBar.module.css';

const ICON_PROPS = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 };

function TruckIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M2 7h11v10H2z" />
      <path d="M13 10h4l4 3v4h-8z" />
      <circle cx="6" cy="19" r="1.7" />
      <circle cx="17" cy="19" r="1.7" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 11a9 9 0 1 1 2.6 6.3" />
      <path d="M3 5v6h6" />
    </svg>
  );
}

function ExchangeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CertifiedIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 2l2.4 1.4 2.8-.2 1 2.6 2.4 1.4-.6 2.8.6 2.8-2.4 1.4-1 2.6-2.8-.2L12 18l-2.4 1.4-2.8.2-1-2.6-2.4-1.4.6-2.8-.6-2.8 2.4-1.4 1-2.6 2.8.2L12 2z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

const ITEMS = [
  { Icon: TruckIcon, title: 'Free Insured Shipping', subtitle: 'Across India' },
  { Icon: ReturnIcon, title: '15 Days Easy Returns', subtitle: 'No questions asked' },
  { Icon: ExchangeIcon, title: 'Lifetime Exchange', subtitle: 'For manufacturing defects' },
  { Icon: LockIcon, title: 'Secure Payments', subtitle: '100% safe & encrypted' },
];

// Cart-specific 3-item assurance set, matching the exact wording of an
// approved reference design — kept separate from ITEMS (used elsewhere at
// its full 4-item default) rather than repurposing those entries, since the
// copy here doesn't map onto shipping/returns/exchange at all. The
// reference's payment subtitle ("backed by the trust of TATA") named a real
// unrelated company, so it's swapped for an accurate equivalent instead of
// carrying over a false claim.
export const CART_ASSURANCE_ITEMS = [
  { Icon: CertifiedIcon, title: 'Purity Guaranteed', subtitle: 'on every online purchase' },
  { Icon: TruckIcon, title: 'Secure Delivery', subtitle: 'by our trusted partners' },
  { Icon: LockIcon, title: 'Easy & Secure Payments', subtitle: '100% safe & encrypted' },
];

// PLP-specific static trust strip — deliberately not the CMS-driven homepage
// TrustStripSection (that one renders one generic checkmark icon per
// admin-entered item; this needs 4 visually distinct icons with fixed copy).
export function TrustStripBar({
  className,
  variant = 'circle',
  items = ITEMS,
}: {
  className?: string;
  // 'boxed' gives each item its own outlined card instead of one shared
  // top border across the row — same icons/copy either way.
  variant?: 'circle' | 'boxed';
  // Defaults to the standard 4-item lineup; pass CART_ASSURANCE_ITEMS (or
  // any same-shaped array) for a different copy/count.
  items?: typeof ITEMS;
} = {}) {
  const stripClass = variant === 'boxed' ? `${styles.strip} ${styles.stripBoxed}` : styles.strip;
  const itemClass = variant === 'boxed' ? `${styles.item} ${styles.itemBoxed}` : styles.item;

  return (
    <div className={className ? `${stripClass} ${className}` : stripClass}>
      {items.map(({ Icon, title, subtitle }) => (
        <div key={title} className={itemClass}>
          <span className={styles.iconWrap}>
            <Icon />
          </span>
          <div>
            <p className={styles.title}>{title}</p>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
