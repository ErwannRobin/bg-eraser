// Edge-aware refinement of a soft mask using the full-resolution image as a guide.
// Implements the guided filter (He et al., 2010) with a grayscale guide. The model only
// sees a 1024 px copy, so its mask is blurry once upscaled; the guide snaps the mask
// edges back onto the real edges of the image.

// Mean over a (2r+1) x (2r+1) window, clamped at the borders. Runs in O(n) whatever r is.
// `scratch` holds the horizontal pass and must be as large as `src`.
function boxMean(
  src: Float32Array,
  dst: Float32Array,
  scratch: Float32Array,
  width: number,
  height: number,
  radius: number
): void {
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = 0; x <= Math.min(radius, width - 1); x++) sum += src[row + x];
    for (let x = 0; x < width; x++) {
      const lo = Math.max(0, x - radius);
      const hi = Math.min(width - 1, x + radius);
      scratch[row + x] = sum / (hi - lo + 1);
      if (x + radius + 1 < width) sum += src[row + x + radius + 1];
      if (x - radius >= 0) sum -= src[row + x - radius];
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(radius, height - 1); y++) sum += scratch[y * width + x];
    for (let y = 0; y < height; y++) {
      const lo = Math.max(0, y - radius);
      const hi = Math.min(height - 1, y + radius);
      dst[y * width + x] = sum / (hi - lo + 1);
      if (y + radius + 1 < height) sum += scratch[(y + radius + 1) * width + x];
      if (y - radius >= 0) sum -= scratch[(y - radius) * width + x];
    }
  }
}

/**
 * Refine `mask` (values 0..1, width * height) with the guide image `rgba`.
 * @param radius window radius in pixels; use a larger value for a bigger upscale factor
 * @param eps regularisation on a 0..1 intensity scale; smaller keeps more guide edges
 * @returns a new array with values clamped to 0..1
 */
export function guidedFilter(
  rgba: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  radius: number,
  eps: number
): Float32Array {
  const n = width * height;
  if (mask.length !== n || rgba.length !== n * 4) {
    throw new Error('guidedFilter: size mismatch');
  }

  const guide = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    guide[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
  }

  const scratch = new Float32Array(n);
  const product = new Float32Array(n);
  const meanI = new Float32Array(n);
  const meanP = new Float32Array(n);
  const a = new Float32Array(n); // holds corr(I*I), then the slope a
  const b = new Float32Array(n); // holds corr(I*p), then the offset b

  boxMean(guide, meanI, scratch, width, height, radius);
  boxMean(mask, meanP, scratch, width, height, radius);
  for (let i = 0; i < n; i++) product[i] = guide[i] * guide[i];
  boxMean(product, a, scratch, width, height, radius);
  for (let i = 0; i < n; i++) product[i] = guide[i] * mask[i];
  boxMean(product, b, scratch, width, height, radius);

  for (let i = 0; i < n; i++) {
    const variance = a[i] - meanI[i] * meanI[i];
    const covariance = b[i] - meanI[i] * meanP[i];
    const slope = covariance / (variance + eps);
    a[i] = slope;
    b[i] = meanP[i] - slope * meanI[i];
  }

  boxMean(a, meanI, scratch, width, height, radius);
  boxMean(b, meanP, scratch, width, height, radius);

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = meanI[i] * guide[i] + meanP[i];
    out[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return out;
}
