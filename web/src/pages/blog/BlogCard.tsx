import { Link } from 'react-router-dom';
import { formatBlogDate, type BlogPostSummary } from '../../api/blog';
import { POLICY_ICONS } from '../policies/PolicyIcons';
import styles from './Blog.module.css';

export function BlogCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link to={`/blog/${post.slug}`} className={styles.card}>
      <div className={styles.cardMedia}>
        {post.coverImageUrl ? (
          <img src={post.coverImageUrl} alt={post.coverImageAlt ?? post.title} loading="lazy" />
        ) : (
          <div className={styles.placeholder}>{POLICY_ICONS.gem}</div>
        )}
      </div>
      <div className={styles.cardBody}>
        <p className={styles.meta}>
          {formatBlogDate(post.publishedAt)} · {post.readMinutes} min read
        </p>
        <h3>{post.title}</h3>
        {post.excerpt && <p className={styles.cardExcerpt}>{post.excerpt}</p>}
        <span className={styles.readLink}>Read more →</span>
      </div>
    </Link>
  );
}
