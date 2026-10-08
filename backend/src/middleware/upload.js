import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Memory storage — images are small enough at this scale to buffer fully
// before handing to sharp; avoids a temp-file cleanup concern.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
});

// Stricter allowlist for the OpenAI image-edit pipeline — that API only
// accepts PNG/JPEG/WebP source images, so reject anything else up front
// rather than letting the provider call fail after an upload round-trip.
const ENHANCE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// Customer-submitted photos on a product review — up to 5 per review.
export const uploadReviewImages = upload.array('images', 5);

export const uploadEnhanceImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ENHANCE_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPG, JPEG, or WebP uploads are allowed'));
    }
    cb(null, true);
  },
});

// Unboxing video on a return request — a customer's raw phone recording, so
// allow the common container formats rather than dictating one, and a much
// higher size limit than the image uploads above.
const RETURN_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']);

// Return request: the unboxing video plus 3–8 live photos (Return &
// Refund Policy). One multer instance for both fields, so the per-file size
// limit is the video's; photos are re-checked against the image limit in
// the controller.
export const RETURN_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadReturnMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxReturnVideoSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'photos') {
      if (!RETURN_PHOTO_MIME_TYPES.has(file.mimetype)) {
        // AppError, not Error: a plain Error is masked as a 500 in production.
        return cb(new AppError(400, 'Photos must be JPG, PNG or WebP images'));
      }
      return cb(null, true);
    }
    if (!RETURN_VIDEO_MIME_TYPES.has(file.mimetype)) {
      return cb(new AppError(400, 'Only MP4, MOV, WebM, or AVI video uploads are allowed'));
    }
    cb(null, true);
  },
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'photos', maxCount: 8 },
]);


// Homepage "Video Story" video — stored as uploaded (no transcoding), so only
// formats every browser plays inline: MP4 and WebM (no MOV/AVI).
const HOMEPAGE_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm']);
export const HOMEPAGE_VIDEO_MAX_MB = 50;

export const uploadHomepageVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HOMEPAGE_VIDEO_MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!HOMEPAGE_VIDEO_MIME_TYPES.has(file.mimetype)) {
      return cb(new AppError(400, 'Only MP4 or WebM videos are allowed'));
    }
    cb(null, true);
  },
}).single('video');
