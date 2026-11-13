import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useHead } from '../../seo/head';
import { organizationJsonLd, breadcrumbJsonLd } from '../../seo/jsonLd';
import { fetchBlogPosts, blogListQueryKey, formatBlogDate } from '../../api/blog';
import { POLICY_ICONS } from '../policies/PolicyIcons';
import { BlogCard } from './BlogCard';
import styles from './Blog.module.css';

export function BlogListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const { data, isLoading, isError } = useQuery({
    queryKey: blogListQueryKey(page),
    queryFn: () => fetchBlogPosts(page),
  });

  useHead({
    title: page > 1 ? `Blog — Page ${page} | 9KARET` : 'Blog | 9KARET',
    description:
      'Jewellery guides, styling ideas, care tips and stories from 9Karet — 9K gold, gemstones and everyday style.',
    canonicalPath: page > 1 ? `/blog?page=${page}` : '/blog',
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
      ]),
    ],
  });

  const posts = data?.posts ?? [];
  const [featured, ...rest] = page === 1 ? posts : [undefined, ...posts];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">›</span>
          <span>Blog</span>
        </nav>
        <h1 className={styles.heroTitle}>The 9Karet Journal</h1>
        <div className={styles.divider} aria-hidden="true">
          <span />
          {POLICY_ICONS.gem}
          <span />
        </div>
        <p className={styles.heroSubtitle}>Jewellery guides, styling ideas, care tips and stories from our workshop.</p>
      </header>

      <div className={styles.container}>
        {isLoading && <p className={styles.state}>Loading articles…</p>}
        {isError && <p className={styles.state}>We couldn’t load the blog right now. Please try again shortly.</p>}
        {!isLoading && !isError && posts.length === 0 && (
          <p className={styles.state}>New articles are coming soon — check back shortly.</p>
        )}

        {featured && (
          <Link to={`/blog/${featured.slug}`} className={styles.featured}>
            <div className={styles.featuredMedia}>
              {featured.coverImageUrl ? (
                <img src={featured.coverImageUrl} alt={featured.coverImageAlt ?? featured.title} />
              ) : (
                <div className={styles.placeholder}>{POLICY_ICONS.gem}</div>
              )}
            </div>
            <div className={styles.featuredText}>
              <p className={styles.eyebrow}>Latest article</p>
              <h2>{featured.title}</h2>
              {featured.excerpt && <p className={styles.excerpt}>{featured.excerpt}</p>}
              <p className={styles.meta}>
                {formatBlogDate(featured.publishedAt)} · {featured.readMinutes} min read
              </p>
              <span className={styles.readLink}>Read article →</span>
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <div className={styles.grid}>
            {rest.map((post) => post && <BlogCard key={post.id} post={post} />)}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <nav className={styles.pagination} aria-label="Blog pages">
            <button type="button" disabled={page <= 1} onClick={() => setSearchParams({ page: String(page - 1) })}>
              ← Newer
            </button>
            <span>
              Page {page} of {data.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => setSearchParams({ page: String(page + 1) })}
            >
              Older →
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
