import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminBlogPost,
  createBlogPost,
  updateBlogPost,
  uploadBlogImage,
  type BlogPostInput,
  type BlogPostStatus,
} from '../../api/blog';
import { ApiError } from '../../api/client';
import { DateTimeField } from '../../components/DateTimeField';
import { renderBlogContent } from '../../features/blog/renderBlogContent';
import sharedStyles from '../../styles/shared.module.css';
import styles from './Blog.module.css';

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string;
  coverImageAlt: string;
  content: string;
  authorName: string;
  publishedAt: string | null;
  seoTitle: string;
  seoDescription: string;
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  excerpt: '',
  coverImageUrl: '',
  coverImageAlt: '',
  content: '',
  authorName: '',
  publishedAt: null,
  seoTitle: '',
  seoDescription: '',
};

const FORMAT_HELP: [string, string][] = [
  ['## Heading', 'Section heading'],
  ['### Sub-heading', 'Smaller heading'],
  ['**bold**  *italic*', 'Emphasis'],
  ['- item', 'Bullet list'],
  ['1. item', 'Numbered list'],
  ['> quote', 'Pull quote'],
  ['[text](https://…)', 'Link'],
  ['![description](image-url)', 'Image (or use Insert image)'],
];

export function BlogFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState<BlogPostStatus>('DRAFT');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'cover' | 'inline' | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blog-post', id],
    queryFn: () => fetchAdminBlogPost(id as string),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!data) return;
    const p = data.post;
    setForm({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? '',
      coverImageUrl: p.coverImageUrl ?? '',
      coverImageAlt: p.coverImageAlt ?? '',
      content: p.content,
      authorName: p.authorName ?? '',
      publishedAt: p.publishedAt,
      seoTitle: p.seoTitle ?? '',
      seoDescription: p.seoDescription ?? '',
    });
    setStatus(p.status);
    setSlugTouched(true);
  }, [data]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'title' && !slugTouched) next.slug = slugify(value as string);
      return next;
    });
    setSavedAt(null);
  }

  function buildInput(nextStatus: BlogPostStatus): BlogPostInput {
    const t = (v: string) => v.trim() || null;
    return {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      excerpt: t(form.excerpt),
      coverImageUrl: t(form.coverImageUrl),
      coverImageAlt: t(form.coverImageAlt),
      content: form.content,
      authorName: t(form.authorName),
      status: nextStatus,
      publishedAt: form.publishedAt,
      seoTitle: t(form.seoTitle),
      seoDescription: t(form.seoDescription),
    };
  }

  const saveMutation = useMutation({
    mutationFn: (nextStatus: BlogPostStatus) =>
      isEdit ? updateBlogPost(id as string, buildInput(nextStatus)) : createBlogPost(buildInput(nextStatus)),
    onSuccess: ({ post }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      queryClient.setQueryData(['admin-blog-post', post.id], { post });
      setStatus(post.status);
      setForm((f) => ({ ...f, slug: post.slug, publishedAt: post.publishedAt }));
      setSavedAt(new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }));
      setError(null);
      if (!isEdit) navigate(`/blog/${post.id}`, { replace: true });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save this post.'),
  });

  async function handleUpload(file: File, target: 'cover' | 'inline') {
    setUploading(target);
    setError(null);
    try {
      const { url } = await uploadBlogImage(file);
      if (target === 'cover') {
        set('coverImageUrl', url);
      } else {
        const el = contentRef.current;
        const snippet = `\n\n![Image description](${url})\n\n`;
        const pos = el?.selectionStart ?? form.content.length;
        set('content', form.content.slice(0, pos) + snippet + form.content.slice(pos));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Image upload failed.');
    } finally {
      setUploading(null);
    }
  }

  if (isEdit && isLoading) return <p className={sharedStyles.empty}>Loading…</p>;

  const canSave = form.title.trim().length >= 3 && !saveMutation.isPending;
  const isScheduled = status === 'PUBLISHED' && form.publishedAt && new Date(form.publishedAt) > new Date();

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <div>
          <Link to="/blog" className={sharedStyles.buttonLink}>
            ← All posts
          </Link>
          <h1 className={sharedStyles.pageTitle}>{isEdit ? 'Edit Post' : 'New Post'}</h1>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.statusNote}>
            {status === 'PUBLISHED' ? (isScheduled ? 'Scheduled' : 'Published') : 'Draft'}
            {savedAt && ` · saved ${savedAt}`}
          </span>
          {status === 'PUBLISHED' ? (
            <button
              type="button"
              className={sharedStyles.button}
              disabled={!canSave}
              onClick={() => saveMutation.mutate('DRAFT')}
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              className={sharedStyles.button}
              disabled={!canSave}
              onClick={() => saveMutation.mutate('DRAFT')}
            >
              Save draft
            </button>
          )}
          <button
            type="button"
            className={sharedStyles.buttonPrimary}
            disabled={!canSave}
            onClick={() => saveMutation.mutate('PUBLISHED')}
          >
            {saveMutation.isPending ? 'Saving…' : status === 'PUBLISHED' ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      {error && <p className={sharedStyles.error}>{error}</p>}

      <div className={styles.editorLayout}>
        <div className={styles.editorMain}>
          <section className={sharedStyles.cardPadded}>
            <label className={sharedStyles.field}>
              Title
              <input
                className={styles.titleInput}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. How to Choose the Right Ring Size"
                maxLength={200}
              />
            </label>
            <label className={sharedStyles.field}>
              URL
              <div className={styles.slugRow}>
                <span>/blog/</span>
                <input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set('slug', slugify(e.target.value));
                  }}
                  maxLength={160}
                />
              </div>
            </label>
            <label className={sharedStyles.field}>
              Excerpt <span className={styles.hint}>— shown on the blog list and under the title</span>
              <textarea
                rows={2}
                value={form.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
                maxLength={400}
              />
            </label>
          </section>

          <section className={sharedStyles.cardPadded}>
            <div className={styles.contentHeader}>
              <div className={styles.tabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'write'}
                  className={tab === 'write' ? styles.tabActive : styles.tab}
                  onClick={() => setTab('write')}
                >
                  Write
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'preview'}
                  className={tab === 'preview' ? styles.tabActive : styles.tab}
                  onClick={() => setTab('preview')}
                >
                  Preview
                </button>
              </div>
              {tab === 'write' && (
                <label className={sharedStyles.button}>
                  {uploading === 'inline' ? 'Uploading…' : 'Insert image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    disabled={!!uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file, 'inline');
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
            {tab === 'write' ? (
              <textarea
                ref={contentRef}
                className={styles.contentInput}
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                placeholder={'Write your article here.\n\n## A section heading\n\nA paragraph of text…'}
              />
            ) : (
              <div className={styles.preview}>
                {form.excerpt && <p className={styles.previewLead}>{form.excerpt}</p>}
                {form.content.trim() ? renderBlogContent(form.content) : <p className={styles.hint}>Nothing to preview yet.</p>}
              </div>
            )}
            <details className={styles.formatHelp}>
              <summary>Formatting guide</summary>
              <table>
                <tbody>
                  {FORMAT_HELP.map(([syntax, meaning]) => (
                    <tr key={syntax}>
                      <td>
                        <code>{syntax}</code>
                      </td>
                      <td>{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.hint}>Leave a blank line between paragraphs.</p>
            </details>
          </section>
        </div>

        <aside className={styles.editorSide}>
          <section className={sharedStyles.cardPadded}>
            <h2 className={styles.sideTitle}>Cover image</h2>
            {form.coverImageUrl ? (
              <img src={form.coverImageUrl} alt="" className={styles.coverPreview} />
            ) : (
              <div className={styles.coverEmpty}>No cover image</div>
            )}
            <div className={styles.coverActions}>
              <label className={sharedStyles.button}>
                {uploading === 'cover' ? 'Uploading…' : form.coverImageUrl ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={!!uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file, 'cover');
                    e.target.value = '';
                  }}
                />
              </label>
              {form.coverImageUrl && (
                <button type="button" className={sharedStyles.buttonLink} onClick={() => set('coverImageUrl', '')}>
                  Remove
                </button>
              )}
            </div>
            <label className={sharedStyles.field}>
              Image description (alt text)
              <input value={form.coverImageAlt} onChange={(e) => set('coverImageAlt', e.target.value)} maxLength={200} />
            </label>
          </section>

          <section className={sharedStyles.cardPadded}>
            <h2 className={styles.sideTitle}>Publishing</h2>
            <label className={sharedStyles.field}>
              Author name (optional)
              <input value={form.authorName} onChange={(e) => set('authorName', e.target.value)} maxLength={120} />
            </label>
            <DateTimeField
              label="Publish date"
              value={form.publishedAt}
              onChange={(v) => set('publishedAt', v)}
              hint="Leave empty to publish immediately. A future date schedules the post."
            />
          </section>

          <section className={sharedStyles.cardPadded}>
            <h2 className={styles.sideTitle}>Search engines (SEO)</h2>
            <label className={sharedStyles.field}>
              SEO title <span className={styles.hint}>{form.seoTitle.length}/60</span>
              <input
                value={form.seoTitle}
                onChange={(e) => set('seoTitle', e.target.value)}
                placeholder={form.title ? `${form.title} | 9KARET Blog` : ''}
                maxLength={200}
              />
            </label>
            <label className={sharedStyles.field}>
              Meta description <span className={styles.hint}>{form.seoDescription.length}/160</span>
              <textarea
                rows={3}
                value={form.seoDescription}
                onChange={(e) => set('seoDescription', e.target.value)}
                placeholder={form.excerpt || 'Defaults to the excerpt'}
                maxLength={320}
              />
            </label>
          </section>
        </aside>
      </div>
    </div>
  );
}
