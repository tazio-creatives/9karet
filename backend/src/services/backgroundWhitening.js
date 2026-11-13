// Local, deterministic background cleanup for generated jewellery photos —
// raw-pixel work only, never an AI call. Shared by the bracelet catalogue
// finishing pass (braceletImageFinish.js, unchanged behaviour) and the
// Pendant Product Size Image (productSizeImageService.js).
//
// Only light, near-neutral pixels in background regions are lifted to white:
// regions touching the image border, large enclosed regions (the inside of a
// loop), or small enclosed openings that are as bright and flat as a
// backdrop. Gold — always clearly saturated — and small neutral areas such as
// stones or highlights inside the metal are left exactly as generated.

// Light, near-neutral pixel = background candidate.
const MAX_SATURATION = 0.12;
const MIN_LUMA = 170;
// Fully white from this luma; 170–200 is a short ramp so the darkest shadow
// core fades out rather than leaving a hard edge.
const FULL_WHITE_LUMA = 200;
// A candidate region counts as background if it touches the border or is at
// least this share of the image (the inside of the bracelet loop)...
const MIN_INNER_REGION_SHARE = 0.01;
// ...or if it is a small enclosed opening (openwork holes in a motif) that
// is bright and flat like the backdrop. Stones and pearls have strong
// light/dark facets or shading, so they fail the flatness test.
const OPENING_MIN_MEAN_LUMA = 228;
const OPENING_MAX_LUMA_STDDEV = 6;

function lumaAt(data, p) {
  return 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
}

function saturationAt(data, p) {
  const max = Math.max(data[p], data[p + 1], data[p + 2]);
  return max === 0 ? 0 : (max - Math.min(data[p], data[p + 1], data[p + 2])) / max;
}

// Mutates `data` (raw RGB/RGBA) in place.
export function whitenBackground(data, width, height, channels) {
  const total = width * height;
  const candidate = new Uint8Array(total);
  const luma = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const p = i * channels;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const max = Math.max(r, g, b);
    const saturation = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    luma[i] = lumaAt(data, p);
    if (saturation <= MAX_SATURATION && luma[i] >= MIN_LUMA) candidate[i] = 1;
  }

  // Label 4-connected candidate regions; keep the background ones.
  const keep = new Uint8Array(total);
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  const minInner = total * MIN_INNER_REGION_SHARE;
  for (let start = 0; start < total; start++) {
    if (!candidate[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    let touchesBorder = false;
    const visit = (j) => {
      if (candidate[j] && !seen[j]) {
        seen[j] = 1;
        queue[tail++] = j;
      }
    };
    visit(start);
    while (head < tail) {
      const i = queue[head++];
      const x = i % width;
      const y = (i - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      if (x > 0) visit(i - 1);
      if (x < width - 1) visit(i + 1);
      if (y > 0) visit(i - width);
      if (y < height - 1) visit(i + width);
    }
    let isBackground = touchesBorder || tail >= minInner;
    if (!isBackground) {
      let sum = 0;
      let sumSq = 0;
      for (let k = 0; k < tail; k++) {
        const l = luma[queue[k]];
        sum += l;
        sumSq += l * l;
      }
      const mean = sum / tail;
      const stddev = Math.sqrt(Math.max(0, sumSq / tail - mean * mean));
      isBackground = mean >= OPENING_MIN_MEAN_LUMA && stddev <= OPENING_MAX_LUMA_STDDEV;
    }
    if (isBackground) {
      for (let k = 0; k < tail; k++) keep[queue[k]] = 1;
    }
  }

  for (let i = 0; i < total; i++) {
    if (!keep[i]) continue;
    const p = i * channels;
    const t = Math.min(1, Math.max(0, (luma[i] - MIN_LUMA) / (FULL_WHITE_LUMA - MIN_LUMA)));
    const a = t * t * (3 - 2 * t);
    for (let c = 0; c < 3; c++) data[p + c] = Math.round(data[p + c] + (255 - data[p + c]) * a);
  }
}

// Confidence gate, used where a wrong cleanup would corrupt a measurement
// (the Pendant Product Size Image). Whitening is applied only when:
//   - the frame border is almost entirely light, near-neutral backdrop (a
//     dark or coloured backdrop is left for validation to reject), and
//   - the product itself is visibly coloured metal. White gold, silver or
//     platinum is near-neutral like the backdrop, so whitening could erase
//     its edges — those images are left untouched.
// Otherwise the pixels are not modified at all.
const MIN_BORDER_BACKDROP_SHARE = 0.9;
const COLOURED_METAL_SATURATION = 0.2;
const MIN_COLOURED_METAL_SHARE = 0.002;

export function whitenBackgroundIfConfident(data, width, height, channels) {
  let borderTotal = 0;
  let borderBackdrop = 0;
  let coloured = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * channels;
      const sat = saturationAt(data, p);
      const luma = lumaAt(data, p);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        borderTotal += 1;
        if (sat <= MAX_SATURATION && luma >= MIN_LUMA) borderBackdrop += 1;
      }
      if (sat > COLOURED_METAL_SATURATION && luma < 250) coloured += 1;
    }
  }
  const borderShare = borderBackdrop / borderTotal;
  const colouredShare = coloured / (width * height);
  if (borderShare < MIN_BORDER_BACKDROP_SHARE) {
    return { applied: false, reason: 'backdrop_not_light_neutral', borderShare, colouredShare };
  }
  if (colouredShare < MIN_COLOURED_METAL_SHARE) {
    return { applied: false, reason: 'product_not_coloured_metal', borderShare, colouredShare };
  }
  whitenBackground(data, width, height, channels);
  return { applied: true, reason: null, borderShare, colouredShare };
}
