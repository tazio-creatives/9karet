import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useHead, defaultHead } from '../../seo/head';
import { organizationJsonLd, breadcrumbJsonLd } from '../../seo/jsonLd';
import { fetchBlogPost, blogPostQueryKey, formatBlogDate } from '../../api/blog';
import { ApiError } from '../../api/client';
import { SITE_URL } from '../../config';
import { renderBlogContent } from '../../features/blog/renderBlogContent';
import { BlogCard } from './BlogCard';
import styles from './Blog.module.css';

export function BlogPostPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: blogPostQueryKey(slug),
    queryFn: () => fetchBlogPost(slug),
  });
  const post = data?.post;
  const canonicalPath = `/blog/${slug}`;

  useHead(
    post
      ? {
          title: post.seoTitle || `${post.title} | 9KARET Blog`,
          description: post.seoDescription || post.excerpt || post.title,
          canonicalPath,
          jsonLd: [
            organizationJsonLd(),
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Blog', path: '/blog' },
              { name: post.title, path: canonicalPath },
            ]),
            {
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: post.title,
              description: post.seoDescription || post.excerpt || undefined,
              image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
              datePublished: post.publishedAt ?? undefined,
              dateModified: post.updatedAt,
              author: { '@type': post.authorName ? 'Person' : 'Organization', name: post.authorName || '9KARET' },
              publisher: { '@type': 'Organization', name: '9KARET', url: SITE_URL },
              mainEntityOfPage: `${SITE_URL}${canonicalPath}`,
            },
          ],
        }
      : defaultHead,
  );

  if (isLoading) return <p className={styles.state}>Loading article…</p>;

  if (!post) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className={styles.notFound}>
        <h1>{notFound ? 'Article not found' : 'Something went wrong'}</h1>
        <p>
          {notFound
            ? 'This article may have been moved or is no longer available.'
            : 'We couldn’t load this article right now. Please try again shortly.'}
        </p>
        <Link to="/blog" className={styles.readLink}>
          ← Back to the blog
        </Link>
      </div>
    );
  }

  return (
    <article className={styles.page}>
      <header className={styles.postHeader}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">›</span>
          <Link to="/blog">Blog</Link>
        </nav>
        <h1 className={styles.postTitle}>{post.title}</h1>
        <p className={styles.postMeta}>
          {post.authorName && <>By {post.authorName} · </>}
          {formatBlogDate(post.publishedAt)} · {post.readMinutes} min read
        </p>
      </header>

      {post.coverImageUrl && (
        <div className={styles.postCover}>
          <img src={post.coverImageUrl} alt={post.coverImageAlt ?? post.title} />
        </div>
      )}

      <div className={styles.postBody}>
        {post.excerpt && <p className={styles.postLead}>{post.excerpt}</p>}
        {renderBlogContent(post.content)}
      </div>

      {data && data.morePosts.length > 0 && (
        <section className={styles.more}>
          <div className={styles.container}>
            <h2 className={styles.moreTitle}>More from the blog</h2>
            <div className={styles.grid}>
              {data.morePosts.map((p) => (
                <BlogCard key={p.id} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
