import { useQuery } from '@tanstack/react-query';
import { fetchCollections } from '../api/collections';
import { fetchHomepage } from '../api/homepage';
import type { HomepageItem } from '../api/types';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useHead } from '../seo/head';
import { CollectionCard, CollectionGrid } from './home/CollectionSpotlight';
import styles from './CollectionsIndexPage.module.css';

// "View All Collections": every active collection as a tall card. Images and
// short lines come from the homepage "Our Collections" section's items (so
// they're uploaded once); a collection not in that section shows a gradient
// and its own description instead.
export function CollectionsIndexPage() {
  useHead({
    title: 'Jewellery Collections | 9KARET',
    description: 'Explore every 9KARET jewellery collection — from everyday 9K gold to gemstone statement pieces.',
    canonicalPath: '/collections',
    jsonLd: [],
  });

  const { data, isLoading, isError } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });
  const { data: homepage } = useQuery({ queryKey: ['homepage'], queryFn: fetchHomepage });

  const spotlight = new Map<string, HomepageItem>();
  for (const section of homepage?.sections ?? []) {
    if (section.type !== 'COLLECTION_SPOTLIGHT' && section.type !== 'COLLECTION_GRID') continue;
    for (const item of section.items) {
      if (item.collection && !spotlight.has(item.collection.id)) spotlight.set(item.collection.id, item);
    }
  }
  const collections = data?.collections ?? [];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={[{ label: 'Collections' }]} />
      <h1 className={styles.title}>Our Collections</h1>
      <p className={styles.intro}>Find the story that feels like you.</p>

      {isLoading && <p className={styles.status}>Loading collections…</p>}
      {isError && <p className={styles.status}>Collections could not be loaded. Please try again.</p>}
      {!isLoading && !isError && collections.length === 0 && (
        <p className={styles.status}>No collections yet — check back soon.</p>
      )}

      {collections.length > 0 && (
        <CollectionGrid>
          {collections.map((c, i) => {
            const item = spotlight.get(c.id);
            return (
              <CollectionCard
                key={c.id}
                href={`/collections/${c.slug}`}
                name={item?.heading || c.name}
                tagline={item?.subheading || c.description}
                imageUrl={item?.imageUrl}
                imageUrlMobile={item?.imageUrlMobile}
                index={i}
              />
            );
          })}
        </CollectionGrid>
      )}
    </div>
  );
}
