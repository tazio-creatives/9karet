import type { HomepageSection as HomepageSectionData } from '../../api/types';
import { BentoCard } from './BentoCard';
import { BondGrid } from './BondGrid';
import { BannerTrio } from './BannerTrio';
import { CollectionCarousel } from './CollectionCarousel';
import { ImageMosaic } from './ImageMosaic';
import { VideoStory } from './VideoStory';
import { PriceShowcase } from './PriceShowcase';
import { CampaignBanners } from './CampaignBanners';
import { CategoryProductRow } from './CategoryProductRow';
import { CategoryShowcase } from './CategoryShowcase';
import { CollectionShowcase } from './CollectionShowcase';
import { CollectionProductShowcase } from './CollectionProductShowcase';
import { DuoBanner } from './DuoBanner';
import { HeroCarousel } from './HeroCarousel';
import { NewArrivalsSection } from './NewArrivalsSection';
import { NewsletterForm } from './NewsletterForm';
import { ProductCarousel } from './ProductCarousel';
import { PriceTierCard } from './PriceTierCard';
import { TrustStripSection } from './TrustStripSection';
import styles from './HomepageSection.module.css';

interface Props {
  section: HomepageSectionData;
  alternate: boolean;
}

// Section "type" drives layout shape (grid size, card size) — content is
// entirely admin-configurable via /api/v1/homepage (plan §3), nothing here
// is hardcoded per-product/category.
export function HomepageSection({ section, alternate }: Props) {
  if (section.items.length === 0 && section.type !== 'NEWSLETTER') return null;

  const sectionClass = `${styles.section} ${alternate ? styles.alt : ''}`;

  switch (section.type) {
    case 'HERO':
      return (
        <section className={`${styles.section} ${styles.hero}`}>
          <HeroCarousel items={section.items} />
        </section>
      );

    case 'NEWSLETTER':
      return (
        <section className={`${styles.section} ${styles.newsletter}`}>
          <h2 className={styles.heading}>{section.heading}</h2>
          <NewsletterForm />
        </section>
      );

    case 'TRUST_STRIP':
      return (
        <section className={`${styles.section} ${styles.trustSection}`}>
          <TrustStripSection items={section.items} />
        </section>
      );

    case 'INSTAGRAM':
      return (
        <section className={sectionClass}>
          {section.heading && <h2 className={styles.heading}>{section.heading}</h2>}
          <div className={styles.scrollRow}>
            {section.items.map((item, i) => (
              <div key={item.id} className={styles.scrollItemSm}>
                <BentoCard item={item} index={i} size="sm" />
              </div>
            ))}
          </div>
          <p className={styles.instagramLink}>Follow Us @9karet</p>
        </section>
      );

    case 'FEATURED_PRODUCT':
      return (
        <ProductCarousel items={section.items} heading={section.heading ?? 'Featured Products'} cardsPerViewDesktop={4} />
      );

    case 'CAMPAIGN_BANNERS':
      return <CampaignBanners items={section.items} heading={section.heading} />;

    case 'CATEGORY_PRODUCTS':
      return <CategoryProductRow items={section.items} heading={section.heading} />;

    // No section.heading rendered here — the collection's own name is
    // already the banner's real H2 (per the "don't repeat the collection
    // name above the grid" requirement).
    case 'COLLECTION_SHOWCASE':
      return <CollectionProductShowcase items={section.items} />;

    case 'SHOP_BY_MATERIAL':
      return (
        <section className={sectionClass}>
          {section.heading && <h2 className={styles.heading}>{section.heading}</h2>}
          <div className={styles.gridSm}>
            {section.items.map((item, i) => (
              <BentoCard key={item.id} item={item} index={i} size="sm" />
            ))}
          </div>
        </section>
      );

    case 'SHOP_BY_PRICE':
      return (
        <section className={sectionClass}>
          {section.heading && <h2 className={styles.heading}>{section.heading}</h2>}
          <div className={styles.priceRow}>
            {section.items.map((item) => (
              <PriceTierCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      );

    case 'OCCASION_CARDS':
    case 'COLLECTION_CARDS':
      if (section.items.length === 3) {
        return (
          <section>
            {section.heading && <h2 className={`${styles.heading} ${styles.tileHeading}`}>{section.heading}</h2>}
            <CollectionShowcase items={section.items} />
          </section>
        );
      }
      if (section.items.length === 2) {
        return (
          <section>
            {section.heading && <h2 className={`${styles.heading} ${styles.tileHeading}`}>{section.heading}</h2>}
            <DuoBanner items={section.items} />
          </section>
        );
      }
      return (
        <section className={sectionClass}>
          {section.heading && <h2 className={styles.heading}>{section.heading}</h2>}
          <div className={styles.grid}>
            {section.items.map((item, i) => (
              <BentoCard key={item.id} item={item} index={i} />
            ))}
          </div>
        </section>
      );

    case 'BENTO_CATEGORIES':
      return (
        <section>
          <CategoryShowcase items={section.items} heading={section.heading} />
        </section>
      );

    case 'NEW_ARRIVALS':
      return <NewArrivalsSection items={section.items} />;

    case 'COLLECTION_CAROUSEL':
      return (
        <CollectionCarousel
          items={section.items}
          heading={section.heading}
          subheading={section.subheading}
          ctaLabel={section.ctaLabel}
          ctaUrl={section.ctaUrl}
        />
      );

    case 'IMAGE_MOSAIC':
      return <ImageMosaic items={section.items} heading={section.heading} subheading={section.subheading} />;

    case 'PRICE_SHOWCASE':
      return <PriceShowcase items={section.items} heading={section.heading} />;

    case 'VIDEO_STORY':
      return (
        <VideoStory
          item={section.items[0]}
          heading={section.heading}
          subheading={section.subheading}
          ctaLabel={section.ctaLabel}
          ctaUrl={section.ctaUrl}
        />
      );

    case 'BANNER_TRIO':
      return <BannerTrio items={section.items} heading={section.heading} />;

    case 'SHOP_BY_BOND':
      return (
        <section className={`${sectionClass} ${styles.bond}`}>
          <h2 className={styles.heading}>{section.heading || 'Shop by Bond'}</h2>
          <BondGrid items={section.items} />
        </section>
      );

    // BEST_SELLERS
    default:
      return (
        <section className={sectionClass}>
          {section.heading && <h2 className={styles.heading}>{section.heading}</h2>}
          <div className={styles.scrollRow}>
            {section.items.map((item, i) => (
              <div key={item.id} className={styles.scrollItem}>
                <BentoCard item={item} index={i} />
              </div>
            ))}
          </div>
        </section>
      );
  }
}
