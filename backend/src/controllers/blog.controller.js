import {
  createBlogPostSchema,
  updateBlogPostSchema,
  listPublicBlogQuerySchema,
  listAdminBlogQuerySchema,
} from '../validators/blog.validators.js';
import {
  findPublishedPosts,
  findPublishedPostBySlug,
  findOtherPublishedPosts,
  findPublishedSlugs,
  findAllPostsForAdmin,
  findPostById,
} from '../repositories/blogPosts.repository.js';
import { createPost, updatePostById, deletePostById } from '../services/blogService.js';
import { processAndStoreBlogImage } from '../services/homepageImageService.js';
import { AppError, NotFoundError } from '../utils/AppError.js';

// ~200 words/minute; content_length (list queries) is a character count,
// ~6 characters per word including the space.
function readMinutesFromLength(chars) {
  return Math.max(1, Math.round(Number(chars ?? 0) / 6 / 200));
}

function toSummaryDto(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_url,
    coverImageAlt: row.cover_image_alt,
    authorName: row.author_name,
    status: row.status,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    readMinutes: readMinutesFromLength(row.content_length ?? row.content?.length),
  };
}

function toDetailDto(row) {
  return {
    ...toSummaryDto(row),
    content: row.content,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at,
  };
}

// ---------- Public ----------

export async function listPublished(req, res, next) {
  try {
    const q = listPublicBlogQuerySchema.parse(req.query);
    const page = q.page ?? 1;
    const limit = q.limit ?? 12;
    const { items, total } = await findPublishedPosts({ page, limit });
    res.json({ posts: items.map(toSummaryDto), page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function getPublished(req, res, next) {
  try {
    const post = await findPublishedPostBySlug(req.params.slug);
    if (!post) throw new NotFoundError('Post not found');
    const more = await findOtherPublishedPosts(post.id, 3);
    res.json({ post: toDetailDto(post), morePosts: more.map(toSummaryDto) });
  } catch (err) {
    next(err);
  }
}

export async function listPublishedSlugs(req, res, next) {
  try {
    const rows = await findPublishedSlugs();
    res.json({ posts: rows.map((r) => ({ slug: r.slug, updatedAt: r.updated_at })) });
  } catch (err) {
    next(err);
  }
}

// ---------- Admin ----------

export async function adminList(req, res, next) {
  try {
    const q = listAdminBlogQuerySchema.parse(req.query);
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const { items, total } = await findAllPostsForAdmin({ status: q.status, search: q.search, page, limit });
    res.json({ posts: items.map(toSummaryDto), page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function adminGet(req, res, next) {
  try {
    const post = await findPostById(req.params.id);
    if (!post) throw new NotFoundError('Post not found');
    res.json({ post: toDetailDto(post) });
  } catch (err) {
    next(err);
  }
}

export async function adminCreate(req, res, next) {
  try {
    const input = createBlogPostSchema.parse(req.body);
    const post = await createPost(input, req.admin.id);
    res.status(201).json({ post: toDetailDto(post) });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdate(req, res, next) {
  try {
    const input = updateBlogPostSchema.parse(req.body);
    const post = await updatePostById(req.params.id, input, req.admin.id);
    res.json({ post: toDetailDto(post) });
  } catch (err) {
    next(err);
  }
}

export async function adminDelete(req, res, next) {
  try {
    await deletePostById(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function adminUploadImage(req, res, next) {
  try {
    if (!req.file) throw new AppError(400, 'No image file provided');
    const { url } = await processAndStoreBlogImage(req.file.buffer);
    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
}
