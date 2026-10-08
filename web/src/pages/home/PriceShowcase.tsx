import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './PriceShowcase.module.css';

// Works out the price band from the card's label, so admins only type
// "Under ₹5,000", "₹5,000 – ₹10,000" or "Above ₹30,000".
function priceBandUrl(label: string | null): string | null {
  if (!label) return null;
  const amounts = (label.match(/\d[\d,]*/g) ?? []).map((n) => Number(n.replace(/,/g, '')));
  if (amounts.length >= 2) return `/jewellery?priceMin=${amounts[0]}&priceMax=${amounts[1]}`;
  if (amounts.length === 1) {
    if (/above|over|more than|\+/i.test(label)) return `/jewellery?priceMin=${amounts[0]}`;
    return `/jewellery?priceMax=${amounts[0]}`;
  }
  return null;
}

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.category) return `/${item.category.slug}`;
  return priceBandUrl(item.heading);
}

// "Beautiful Choices, Thoughtfully Priced" — the words after the comma
// are set in gold.
function TwoToneHeading({ text }: { text: string }) {
  const comma = text.indexOf(',');
  if (comma === -1) return <h2 className={styles.heading}>{text}</h2>;
  return (
    <h2 className={styles.heading}>
      {text.slice(0, comma + 1)} <span className={styles.accent}>{text.slice(comma + 1).trim()}</span>
    </h2>
  );
}

// "Shop by Price" photo cards: a soft band, a two-tone serif title and one
// pastel card per price band (photo, price, "Shop Now →"). Five across on
// desktop; a swipeable row on phones.
export function PriceShowcase({ items, heading }: { items: HomepageItem[]; heading?: string | null }) {
  return (
    <section className={styles.band}>
      <div className={styles.inner}>
        {heading && <TwoToneHeading text={heading} />}
        <div className={styles.row}>
          {items.map((item, i) => {
            const href = linkFor(item);
            const body = (
              <>
                <span className={styles.frame}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.subheading || item.heading || ''} loading="lazy" decoding="async" />
                  ) : (
                    <span className={styles.placeholder} style={{ background: placeholderGradient(i) }} aria-hidden="true" />
                  )}
                </span>
                {item.heading && <span className={styles.price}>{item.heading}</span>}
                {href && (
                  <span className={styles.shop}>
                    {item.ctaLabel || 'Shop Now'}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <path d="M4 12h15M13 6l6 6-6 6" />
                    </svg>
                  </span>
                )}
              </>
            );
            const className = `${styles.card} ${styles[`tint${i % 5}`]}`;
            return href ? (
              <Link key={item.id} to={href} className={className}>
                {body}
              </Link>
            ) : (
              <div key={item.id} className={className}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
