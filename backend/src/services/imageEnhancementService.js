import OpenAI, {
  toFile,
  APIConnectionTimeoutError,
  RateLimitError,
  BadRequestError,
  AuthenticationError,
  PermissionDeniedError,
} from 'openai';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Locked server-side and never exposed to the frontend — keeps the model
// constrained to a quality/lighting/background cleanup pass, never a
// redesign of the jewellery itself.
const ENHANCEMENT_PROMPT = `You are a professional luxury jewellery product-image enhancement specialist. Improve the technical quality of the uploaded jewellery photograph while preserving the product with maximum visual accuracy.

The uploaded jewellery is the definitive product reference. Preserve its exact design, shape, dimensions, proportions, stone count, stone shapes, stone positions, gemstone colours, metal colour, metal finish, engraving, texture, chain structure, clasps and every other identifiable component.

Do not redesign, reinterpret, simplify or beautify the jewellery by changing its construction. Do not add, remove, replace, resize or reposition any gemstone, metal component or decorative detail.

Improve only image sharpness, detail clarity, exposure, white balance, colour accuracy, studio lighting, contrast, noise, edge quality, background cleanliness, product centring and natural shadows.

Place the exact jewellery product on a clean, neutral, premium e-commerce studio background. Keep the product centred with sufficient spacing around it. Use balanced professional lighting that reveals the product details without creating unrealistic reflections or changing the metal and gemstone colours.

Produce a photorealistic, premium jewellery e-commerce product image. Do not include people, hands, props, text, logos, labels or watermarks. The final image must be square with a 1:1 aspect ratio.`;

// gpt-image-2 at quality:'high' reliably takes ~140s in practice — timeout
// needs real margin above that, not the SDK default.
const REQUEST_TIMEOUT_MS = 240_000;
const WEBSITE_SIZE_PX = 1200;
const TARGET_MAX_BYTES = 500 * 1024;

let client = null;
function getClient() {
  if (!env.openaiApiKey) {
    throw new AppError(503, 'Image enhancement is not configured');
  }
  if (!client) {
    client = new OpenAI({ apiKey: env.openaiApiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 2 });
  }
  return client;
}

// Never trust the model to return a small file — step quality down until it
// fits under the ~500KB website budget, without dropping below a floor that
// would introduce visible artifacting.
async function optimizeForWeb(sourceBuffer) {
  const base = sharp(sourceBuffer);
  let quality = 85;
  let output = await base
    .clone()
    .resize(WEBSITE_SIZE_PX, WEBSITE_SIZE_PX, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .webp({ quality })
    .toBuffer();

  while (output.length > TARGET_MAX_BYTES && quality > 65) {
    quality -= 5;
    output = await base
      .clone()
      .resize(WEBSITE_SIZE_PX, WEBSITE_SIZE_PX, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .webp({ quality })
      .toBuffer();
  }

  return output;
}

// Never leak provider internals (request IDs, raw model error text, account
// details) to the client — log full detail server-side only, return a safe
// generic message.
function mapOpenAiError(err) {
  console.error('OpenAI image enhancement failed:', err?.status ?? '', err?.message ?? err);

  if (err instanceof RateLimitError) {
    return new AppError(429, 'Image enhancement is busy right now — please try again in a moment.');
  }
  if (err instanceof APIConnectionTimeoutError) {
    return new AppError(504, 'Image enhancement timed out — please try again.');
  }
  if (err instanceof BadRequestError) {
    return new AppError(400, 'The uploaded image could not be processed — try a different photo.');
  }
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new AppError(503, 'Image enhancement is not configured correctly.');
  }
  return new AppError(502, 'Image enhancement failed — please try again.');
}

// Buffer in, buffer out — no temp files, nothing persisted to storage or
// the DB (plan: this feature never permanently stores customer/admin
// uploads, unlike the separate AI candidate-variant pipeline).
export async function enhanceJewelleryImage(sourceBuffer, mimetype) {
  const openai = getClient();
  const extension = mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : 'jpg';

  let response;
  try {
    response = await openai.images.edit({
      model: env.openaiImageModel,
      image: await toFile(sourceBuffer, `product.${extension}`, { type: mimetype }),
      prompt: ENHANCEMENT_PROMPT,
      // 1024x1024 is the one square size guaranteed supported across every
      // current GPT image model (gpt-image-2 also accepts larger arbitrary
      // WIDTHxHEIGHT sizes, but the exact upper safe bound isn't documented
      // precisely enough to hardcode — and the result is resized to
      // WEBSITE_SIZE_PX below regardless, so it isn't worth the 400 risk).
      size: '1024x1024',
      quality: 'high',
      background: 'opaque',
      output_format: 'png',
      n: 1,
    });
  } catch (err) {
    throw mapOpenAiError(err);
  }

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new AppError(502, 'Image enhancement did not return a result');

  const enhancedBuffer = Buffer.from(b64, 'base64');
  const webBuffer = await optimizeForWeb(enhancedBuffer);
  return { buffer: webBuffer, mimeType: 'image/webp' };
}
