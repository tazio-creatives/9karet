// Identical two-bangle sets, catalogue images only: the image model
// generates ONE bangle (the "source"), and this module places exactly two
// copies of it on a pure-white canvas in the shot's layout. Local CPU work
// with sharp + raw pixels — never an AI call.
//
// Why: asked for two bangles, the model kept drawing a doubled pair at each
// position (four bangles). Duplicating one verified bangle locally makes the
// final count exactly two by construction.
//
// Pixel safety:
//   - The background is cleaned with the shared, gold-safe whitenBackground()
//     (only light, near-neutral background regions change; saturated gold
//     pixels are never modified).
//   - Copies are laid onto pure white with a DARKEN blend: over white, the
//     result is exactly the copy's own pixels, so jewellery pixels, motifs,
//     anti-aliased edges and the model's own contact shadow are preserved.
//     No recolouring, warmth or saturation change is ever applied.
//   - The primary copy is never resampled (scale 1); a smaller background
//     copy is resampled once (lanczos3), which keeps its colour average.
//   - No copy is ever mirrored.
//
// Safety: anything this module cannot verify fails with a clear reason and
// no composite — a missing or unclean backdrop, a source with more or fewer
// than one bangle-sized metal object, copies that would touch or overlap,
// or a final image that does not contain exactly two objects.
import sharp from 'sharp';
import { whitenBackgroundIfConfident } from './backgroundWhitening.js';

// Coloured metal = clearly saturated, not dark. Gold is always well above
// this; white backdrop and grey shadows are well below.
const METAL_SATURATION = 0.18;
const METAL_MIN_MAX = 60;
// Connect a bangle's band across thin specular highlights before counting.
const CLOSE_RADIUS = 2;
// A metal object must be at least this share of the frame to count.
const MIN_OBJECT_SHARE = 0.002;
// Copies' metal must stay at least this far apart.
const MIN_GAP_PX = 8;
// Crop margin around the bangle (shadow below gets more), and the feather
// that fades a crop's non-metal edge into white so no seam can show.
const MARGIN = 0.03;
const SHADOW_MARGIN = 0.06;
const FEATHER_PX = 12;

// Layout boxes per catalogue shot, as fractions of the canvas
// [x0, y0, x1, y1]. Boxes never overlap, so copies cannot either.
// `secondScale` is the background copy's size relative to the primary.
// `align`: where a copy sits in its box vertically.
export const COMPOSITE_LAYOUTS = {
  // Front: one above, one below.
  1: { name: 'front_above_below', boxes: [[0.05, 0.06, 0.95, 0.47], [0.05, 0.53, 0.95, 0.94]], secondScale: 1, align: 'centre' },
  // Slight Alternate: left foreground, right background, both upright.
  2: { name: 'slight_left_fg_right_bg', boxes: [[0.03, 0.05, 0.5, 0.95], [0.53, 0.1, 0.97, 0.9]], secondScale: 0.9, align: 'bottom' },
  // Elevated: larger left foreground, smaller right background.
  3: { name: 'elevated_left_fg_right_bg', boxes: [[0.03, 0.42, 0.72, 0.88], [0.34, 0.14, 0.97, 0.38]], secondScale: 0.8, align: 'bottom' },
  // Macro: larger foreground, smaller background, both complete.
  4: { name: 'macro_large_fg_small_bg', boxes: [[0.02, 0.02, 0.6, 0.98], [0.62, 0.2, 0.98, 0.92]], secondScale: 0.62, align: 'bottom' },
};

function isMetal(data, p) {
  const r = data[p];
  const g = data[p + 1];
  const b = data[p + 2];
  const max = Math.max(r, g, b);
  if (max <= METAL_MIN_MAX) return false;
  return (max - Math.min(r, g, b)) / max > METAL_SATURATION;
}

export function metalMask(data, width, height, channels) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) if (isMetal(data, i * channels)) mask[i] = 1;
  return mask;
}

function dilate(mask, width, height, radius) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < width) out[yy * width + xx] = 1;
        }
      }
    }
  }
  return out;
}

// Bangle-sized metal objects: 4-connected components of the (closed) metal
// mask above MIN_OBJECT_SHARE, with their bounding boxes.
export function metalObjects(mask, width, height) {
  const closed = dilate(mask, width, height, CLOSE_RADIUS);
  const seen = new Uint8Array(closed.length);
  const queue = new Int32Array(closed.length);
  const minArea = closed.length * MIN_OBJECT_SHARE;
  const objects = [];
  for (let start = 0; start < closed.length; start++) {
    if (!closed[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;
    seen[start] = 1;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      const x = i % width;
      const y = (i - x) / width;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const n = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1];
      for (const j of n) {
        if (j >= 0 && closed[j] && !seen[j]) {
          seen[j] = 1;
          queue[tail++] = j;
        }
      }
    }
    if (tail >= minArea) objects.push({ area: tail, x0, y0, x1, y1 });
  }
  return objects;
}

async function decode(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function fail(reason) {
  return { ok: false, reason };
}

// Isolates the one bangle in a generated source image. Returns the cleaned
// crop (raw RGB), its metal mask and the metal bbox inside the crop.
export async function isolateSingleBangle(buffer) {
  const img = await decode(buffer);
  const { data, width, height, channels } = img;
  const cleanup = whitenBackgroundIfConfident(data, width, height, channels);
  if (!cleanup.applied) {
    return fail(
      cleanup.reason === 'product_not_coloured_metal'
        ? 'Composite not created: no gold bangle could be isolated in the generated source image.'
        : 'Composite not created: the generated source image does not have a clean light background, so the bangle could not be isolated safely.',
    );
  }
  const mask = metalMask(data, width, height, channels);
  const objects = metalObjects(mask, width, height);
  if (objects.length === 0) return fail('Composite not created: no bangle was found in the generated source image.');
  if (objects.length > 1) {
    return fail(`Composite not created: the generated source image contains ${objects.length} separate bangle-sized objects instead of exactly one.`);
  }
  const [obj] = objects;
  const mx = Math.round(width * MARGIN);
  const my = Math.round(height * MARGIN);
  const cx0 = Math.max(0, obj.x0 - mx);
  const cy0 = Math.max(0, obj.y0 - my);
  const cx1 = Math.min(width - 1, obj.x1 + mx);
  const cy1 = Math.min(height - 1, obj.y1 + Math.round(height * SHADOW_MARGIN));
  const cw = cx1 - cx0 + 1;
  const ch = cy1 - cy0 + 1;
  const crop = Buffer.alloc(cw * ch * 3);
  const cropMask = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const s = ((cy0 + y) * width + (cx0 + x)) * channels;
      const d = (y * cw + x) * 3;
      crop[d] = data[s];
      crop[d + 1] = data[s + 1];
      crop[d + 2] = data[s + 2];
      cropMask[y * cw + x] = mask[(cy0 + y) * width + (cx0 + x)];
    }
  }
  // Feather only NON-metal pixels near the crop edge into white, so a cut
  // shadow can never show a straight seam. Metal pixels are never touched.
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = y * cw + x;
      if (cropMask[i]) continue;
      const edge = Math.min(x, y, cw - 1 - x, ch - 1 - y);
      if (edge >= FEATHER_PX) continue;
      const a = 1 - edge / FEATHER_PX;
      const d = i * 3;
      for (let c = 0; c < 3; c++) crop[d + c] = Math.round(crop[d + c] + (255 - crop[d + c]) * a);
    }
  }
  return {
    ok: true,
    source: { width, height },
    crop: { data: crop, width: cw, height: ch, mask: cropMask, metalBox: { x0: obj.x0 - cx0, y0: obj.y0 - cy0, x1: obj.x1 - cx0, y1: obj.y1 - cy0 } },
    origin: { x: cx0, y: cy0 },
  };
}

async function scaledCopy(crop, scale) {
  if (scale === 1) return { data: crop.data, width: crop.width, height: crop.height };
  const w = Math.max(1, Math.round(crop.width * scale));
  const h = Math.max(1, Math.round(crop.height * scale));
  const { data, info } = await sharp(crop.data, { raw: { width: crop.width, height: crop.height, channels: 3 } })
    .resize(w, h, { kernel: 'lanczos3', fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function fitScale(cw, ch, box, W, H) {
  return Math.min((box[2] - box[0]) * W / cw, (box[3] - box[1]) * H / ch);
}

// Places exactly two copies of the isolated bangle in the shot's layout.
export async function composeIdenticalPair(sourceBuffer, shotNumber) {
  const layout = COMPOSITE_LAYOUTS[shotNumber];
  if (!layout) return fail(`Composite not created: no composite layout for catalogue shot ${shotNumber}.`);
  const isolated = await isolateSingleBangle(sourceBuffer);
  if (!isolated.ok) return isolated;
  const { crop } = isolated;
  const W = isolated.source.width;
  const H = isolated.source.height;

  // Primary copy is never enlarged; never resampled when it already fits.
  const primary = Math.min(1, fitScale(crop.width, crop.height, layout.boxes[0], W, H));
  const second = Math.min(fitScale(crop.width, crop.height, layout.boxes[1], W, H), primary * layout.secondScale);
  const scales = [primary, second].map((s) => (s >= 0.999 ? 1 : s));
  if (scales.some((s) => s < 0.25)) {
    return fail('Composite not created: the generated bangle is too large for the two-bangle layout.');
  }

  const canvas = Buffer.alloc(W * H * 3, 255);
  const placed = [];
  for (let k = 0; k < 2; k++) {
    const copy = await scaledCopy(crop, scales[k]);
    const box = layout.boxes[k];
    const bx0 = box[0] * W;
    const by0 = box[1] * H;
    const bx1 = box[2] * W;
    const by1 = box[3] * H;
    const left = Math.round(bx0 + (bx1 - bx0 - copy.width) / 2);
    const top = Math.round(layout.align === 'bottom' ? by1 - copy.height : by0 + (by1 - by0 - copy.height) / 2);
    for (let y = 0; y < copy.height; y++) {
      const cy = top + y;
      if (cy < 0 || cy >= H) continue;
      for (let x = 0; x < copy.width; x++) {
        const cx = left + x;
        if (cx < 0 || cx >= W) continue;
        const s = (y * copy.width + x) * 3;
        const d = (cy * W + cx) * 3;
        // DARKEN: over white this is exactly the copy's pixel.
        canvas[d] = Math.min(canvas[d], copy.data[s]);
        canvas[d + 1] = Math.min(canvas[d + 1], copy.data[s + 1]);
        canvas[d + 2] = Math.min(canvas[d + 2], copy.data[s + 2]);
      }
    }
    const mb = crop.metalBox;
    placed.push({
      scale: scales[k],
      left,
      top,
      width: copy.width,
      height: copy.height,
      metal: {
        x0: left + Math.floor(mb.x0 * scales[k]),
        y0: top + Math.floor(mb.y0 * scales[k]),
        x1: left + Math.ceil(mb.x1 * scales[k]),
        y1: top + Math.ceil(mb.y1 * scales[k]),
      },
    });
  }

  // Copies must not touch or overlap.
  const [a, b] = placed.map((p) => p.metal);
  const gapX = Math.max(b.x0 - a.x1, a.x0 - b.x1);
  const gapY = Math.max(b.y0 - a.y1, a.y0 - b.y1);
  if (Math.max(gapX, gapY) < MIN_GAP_PX) return fail('Composite not created: the two bangle copies would touch or overlap.');

  // Verify the final image contains exactly two bangle objects.
  const finalObjects = metalObjects(metalMask(canvas, W, H, 3), W, H);
  if (finalObjects.length !== 2) {
    return fail(`Composite not created: the final image contains ${finalObjects.length} bangle objects instead of exactly two.`);
  }

  const buffer = await sharp(canvas, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  return {
    ok: true,
    buffer,
    metadata: {
      method: 'identical_pair_local_composite',
      layout: layout.name,
      copies: 2,
      mirrored: false,
      finalObjectCount: finalObjects.length,
      placements: placed.map(({ scale, left, top, width, height }) => ({ scale: Number(scale.toFixed(4)), left, top, width, height })),
    },
  };
}
