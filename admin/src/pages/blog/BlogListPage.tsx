import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminBlogPosts, deleteBlogPost, type BlogPostStatus, type BlogPostSummary } from '../../api/blog';
import { ApiError } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import sharedStyles from '../../styles/shared.module.css';
import styles from './Blog.module.css';

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'https://9karet.com';

function statusLabel(post: BlogPostSummary) {
  if (post.status === 'DRAFT') return { text: 'Draft', badge: 'badgeNeutral' };
  if (post.publishedAt && new Date(post.publishedAt) > new Date()) return { text: 'Scheduled', badge: 'badgeInfo' };
  return { text: 'Published', badge: 'badgeSuccess' };
}

export function BlogListPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<BlogPostStatus | ''>('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<BlogPostSummary | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blog-posts', { status, search, page }],
    queryFn: () => fetchAdminBlogPosts({ status: status || undefined, search: search || undefined, page }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBlogPost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      setPendingDelete(null);
    },
    onError: (err) => {
      window.alert(err instanceof ApiError ? err.message : 'Could not delete this post.');
      setPendingDelete(null);
    },
  });

  const posts = data?.posts ?? [];

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Blog</h1>
        <Link to="/blog/new" className={sharedStyles.buttonPrimary}>
          New Post
        </Link>
      </div>

      <div className={styles.filters}>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as BlogPostStatus | '');
            setPage(1);
          }}
        >
          <option value="">All posts</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Drafts</option>
        </select>
        <form
          className={styles.searchForm}
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchDraft.trim());
            setPage(1);
          }}
        >
          <input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Search by title" />
          <button type="submit" className={sharedStyles.button}>
            Search
          </button>
        </form>
      </div>

      <div className={sharedStyles.card}>
        {isLoading && <p className={sharedStyles.empty}>Loading…</p>}
        {!isLoading && posts.length === 0 && (
          <p className={sharedStyles.empty}>
            No posts yet. <Link to="/blog/new">Write the first one</Link>.
          </p>
        )}
        {posts.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th></th>
                <th>Title</th>
                <th>Status</th>
                <th>Published</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const label = statusLabel(post);
                return (
                  <tr key={post.id}>
                    <td className={styles.thumbCell}>
                      {post.coverImageUrl ? (
                        <img src={post.coverImageUrl} alt="" className={styles.thumb} />
                      ) : (
                        <div className={styles.thumbPlaceholder} />
                      )}
                    </td>
                    <td>
                      <Link to={`/blog/${post.id}`} className={styles.titleLink}>
                        {post.title}
                      </Link>
                      <div className={styles.slug}>/blog/{post.slug}</div>
                    </td>
                    <td>
                      <span className={sharedStyles[label.badge]}>{label.text}</span>
                    </td>
                    <td>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-IN') : '—'}</td>
                    <td>{new Date(post.updatedAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      <div className={styles.rowActions}>
                        {label.text === 'Published' && (
                          <a
                            href={`${STOREFRONT_URL}/blog/${post.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className={sharedStyles.buttonLink}
                          >
                            View
                          </a>
                        )}
                        <Link to={`/blog/${post.id}`} className={sharedStyles.buttonLink}>
                          Edit
                        </Link>
                        <button type="button" className={sharedStyles.buttonLink} onClick={() => setPendingDelete(post)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className={sharedStyles.pagination}>
          <button type="button" className={sharedStyles.button} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <button
            type="button"
            className={sharedStyles.button}
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete post"
          message={`Permanently delete "${pendingDelete.title}"? It will disappear from the storefront immediately. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
