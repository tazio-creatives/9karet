import {
  GemIcon,
  HallmarkIcon,
  BuybackIcon,
  ExchangeIcon,
  ShieldCheckIcon,
} from './assuranceIcons';
import styles from './ProductAssuranceGrid.module.css';

interface ProductAssuranceGridProps {
  // Static per-product facts, not the live customer selection — whether a
  // piece carries stones doesn't change with the colour/size picked, so this
  // is decided once from the product record (plan: "Do not display claims
  // that are untrue for the selected product or variation").
  hasStones: boolean;
}

// Separate, deliberately lighter design from the homepage's dark
// AssuranceStrip (pages/home/AssuranceStrip.tsx) — same icon set, its own
// compact ivory/champagne layout. Renders only the claims that are actually
// true for this product; Buyback/Exchange/Secure Payment are universal.
export function ProductAssuranceGrid({ hasStones }: ProductAssuranceGridProps) {
  const items = [
    {
      key: 'hallmark',
      Icon: HallmarkIcon,
      title: 'BIS Hallmarked 9K Gold',
      description: 'Purity you can trust',
    },
    hasStones && {
      key: 'stones',
      Icon: GemIcon,
      title: 'Genuine Gemstones',
      description: 'Weight & price shown upfront',
    },
    {
      key: 'buyback',
      Icon: BuybackIcon,
      title: 'Buyback Guarantee',
      description: 'Best value, always',
    },
    {
      key: 'exchange',
      Icon: ExchangeIcon,
      title: 'Easy Exchange',
      description: 'Simple and hassle-free',
    },
    {
      key: 'payment',
      Icon: ShieldCheckIcon,
      title: 'Secure Payment',
      description: 'Safe and reliable checkout',
    },
  ].filter((item): item is Exclude<typeof item, false> => item !== false);

  // An odd count would otherwise leave one item awkwardly alone in the last
  // row's first column — span it across both instead (matches the 5-item
  // reference design's "final item spans both columns", generalized to
  // whatever count survives the conditional filtering above).
  const lastIndex = items.length - 1;

  return (
    <section className={styles.grid} aria-label="Product assurances">
      {items.map(({ key, Icon, title, description }, i) => (
        <div key={key} className={`${styles.item} ${i === lastIndex && items.length % 2 === 1 ? styles.spanFull : ''}`}>
          <span className={styles.iconWrap}>
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
