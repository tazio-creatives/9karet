import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCollectionBySlug } from '../api/collections';
import { ProductListing } from '../features/plp/ProductListing';
import { PlpSkeleton } from '../features/plp/PlpSkeleton';
import styles from './PlaceholderPage.module.css';

export function CollectionPage() {
  const { collectionSlug } = useParams<{ collectionSlug: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['collection', collectionSlug],
    queryFn: () => fetchCollectionBySlug(collectionSlug as string),
    enabled: !!collectionSlug,
  });

  if (isLoading) {
    return <PlpSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Collection not found</h1>
        <p className={styles.body}>We couldn't find that collection.</p>
      </div>
    );
  }

  const { collection } = data;

  return (
    <ProductListing
      collectionSlug={collection.slug}
      heading={collection.name}
      description={collection.description}
      breadcrumbs={[{ label: collection.name }]}
      canonicalPath={`/collections/${collection.slug}`}
    />
  );
}
