import { slugify } from '../utils/slug.js';
import { AppError, NotFoundError } from '../utils/AppError.js';
import {
  findPostById,
  findPostBySlug,
  insertPost,
  updatePost,
  deletePost,
} from '../repositories/blogPosts.repository.js';
import { invalidateBlogPages } from './pageCacheInvalidation.js';

// Path segments the public blog router already uses (GET /blog/sitemap).
const RESERVED_SLUGS = new Set(['sitemap']);

async function assertSlugAvailable(slug, exceptId) {
  if (RESERVED_SLUGS.has(slug)) {
    throw new AppError(400, `"${slug}" is reserved — choose a different URL slug.`);
  }
  const existing = await findPostBySlug(slug);
  if (existing && existing.id !== exceptId) {
    throw new AppError(409, `Another post already uses the address "/blog/${slug}". Choose a different URL slug.`);
  }
}

// Publishing without an explicit publish time stamps "now"; an explicit
// future time schedules the post (it stays hidden until then).
function resolvePublishedAt(input, existing) {
  if (Object.hasOwn(input, 'publishedAt') && input.publishedAt) return input.publishedAt;
  const nextStatus = input.status ?? existing?.status;
  if (nextStatus === 'PUBLISHED') return existing?.published_at ?? new Date().toISOString();
  return existing?.published_at ?? null;
}

// Cache clearing is best-effort — the save itself already succeeded, and
// page_cache's TTL bounds staleness even if this ever fails.
async function safeInvalidate() {
  try {
    await invalidateBlogPages();
  } catch (err) {
    console.error('Blog page-cache invalidation failed:', err);
  }
}

export async function createPost(input, adminId) {
  const slug = input.slug || slugify(input.title);
  if (!slug) throw new AppError(400, 'Could not derive a URL slug from the title — please enter one.');
  await assertSlugAvailable(slug);
  const post = await insertPost({ ...input, slug, publishedAt: resolvePublishedAt(input, null) }, adminId);
  await safeInvalidate();
  return post;
}

export async function updatePostById(id, input, adminId) {
  const existing = await findPostById(id);
  if (!existing) throw new NotFoundError('Post not found');
  const fields = { ...input };
  if (Object.hasOwn(fields, 'slug')) {
    if (!fields.slug) delete fields.slug;
    else await assertSlugAvailable(fields.slug, id);
  }
  fields.publishedAt = resolvePublishedAt(input, existing);
  const post = await updatePost(id, fields, adminId);
  await safeInvalidate();
  return post;
}

export async function deletePostById(id) {
  const existing = await findPostById(id);
  if (!existing) throw new NotFoundError('Post not found');
  await deletePost(id);
  await safeInvalidate();
}
