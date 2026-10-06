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

  // Three sibling top-level categories, by their descriptive names
  // ("Natural Diamond Earrings"), as internal links under the intro — the
  // next three after this one in menu order (wrapping round), so every
  // category gets linked from somewhere rather than always the same three.
  const seoCategories = categories
    .filter((c) => !c.parentId && c.isActive && c.seoHeading)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const here = seoCategories.findIndex((c) => c.id === ancestors[0]?.id);
  const relatedLinks = seoCategories
    .map((_, i) => seoCategories[(Math.max(here, 0) + 1 + i) % seoCategories.length])
    .filter((c) => c.id !== ancestors[0]?.id)
    .slice(0, 3)
    .map((c) => ({ label: c.seoHeading as string, href: `/${c.slug}` }));

  return (
    <ProductListing
      categorySlug={category.slug}
      heading={category.name}
      h1={category.seoHeading || category.name}
      seoTitle={category.seoTitle}
      seoDescription={category.seoDescription}
      relatedLinks={relatedLinks}
      description={category.description}
      breadcrumbs={breadcrumbs}
      canonicalPath={`/${category.slug}`}
      subcategories={subcategories}
      banner={category.banner}
    />
  );
}
