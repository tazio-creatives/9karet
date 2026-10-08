import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '../api/categories';
import { findCategoryBySlug, getAncestorChain, getChildCategories } from '../utils/categoryTree';
import { ProductListing } from '../features/plp/ProductListing';
import { PlpSkeleton } from '../features/plp/PlpSkeleton';
import styles from './PlaceholderPage.module.css';

export function PLPPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return <PlpSkeleton />;
  }

  const categories = data?.categories ?? [];
  const category = categorySlug ? findCategoryBySlug(categories, categorySlug) : null;

  if (!category) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Category not found</h1>
        <p className={styles.body}>We couldn't find that category.</p>
      </div>
    );
  }

  const ancestors = getAncestorChain(categories, category);
  const breadcrumbs = ancestors.map((c, i) => ({
    label: c.name,
    href: i < ancestors.length - 1 ? `/${c.slug}` : undefined,
  }));
  const subcategories = getChildCategories(categories, category.id).map((c) => ({
    name: c.name,
    href: `/${c.slug}`,
    slug: c.slug,
  }));

  return (
    <ProductListing
      categorySlug={category.slug}
      heading={category.name}
      h1={category.seoHeading || category.name}
      seoTitle={category.seoTitle}
      // Category pages show only the name on screen — the description is
      // kept for the meta description, not shown as visible intro text.
      seoDescription={category.seoDescription || category.description}
      breadcrumbs={breadcrumbs}
      canonicalPath={`/${category.slug}`}
      subcategories={subcategories}
      banner={category.banner}
    />
  );
}
