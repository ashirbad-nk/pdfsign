import type { BgOptions } from '../lib/types';

interface Request {
  id: number;
  width: number;
  height: number;
  data: Uint8ClampedArray;
  options: BgOptions;
}

interface Response {
  id: number;
  width: number;
  height: number;
  data: Uint8ClampedArray;
  error?: string;
}

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (message: Response, transfer?: Transferable[]) => void;
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Separable sliding-window maximum. */
function dilate(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const deque = new Int32Array(Math.max(w, h));

  for (let y = 0; y < h; y++) {
    let head = 0;
    let tail = 0;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const value = src[row + x];
      while (tail > head && src[row + deque[tail - 1]] <= value) tail--;
      deque[tail++] = x;
      const left = x - radius;
      while (tail > head && deque[head] < left) head++;
      tmp[row + x] = src[row + deque[head]];
    }
  }

  for (let x = 0; x < w; x++) {
    let head = 0;
    let tail = 0;
    for (let y = 0; y < h; y++) {
      const idx = y * w + x;
      const value = tmp[idx];
      while (tail > head && tmp[deque[tail - 1] * w + x] <= value) tail--;
      deque[tail++] = y;
      const top = y - radius;
      while (tail > head && deque[head] < top) head++;
      out[idx] = tmp[deque[head] * w + x];
    }
  }

  return out;
}

/** Separable box blur using a sliding sum. */
function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius <= 0) return src;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    let count = 0;
    for (let x = -radius; x <= radius; x++) {
      if (x >= 0 && x < w) {
        sum += src[row + x];
        count++;
      }
    }
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / count;
      const remove = x - radius;
      const add = x + radius + 1;
      if (remove >= 0 && remove < w) {
        sum -= src[row + remove];
        count--;
      }
      if (add >= 0 && add < w) {
        sum += src[row + add];
        count++;
      }
    }
  }

  for (let x = 0; x < w; x++) {
    let sum = 0;
    let count = 0;
    for (let y = -radius; y <= radius; y++) {
      if (y >= 0 && y < h) {
        sum += tmp[y * w + x];
        count++;
      }
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / count;
      const remove = y - radius;
      const add = y + radius + 1;
      if (remove >= 0 && remove < h) {
        sum -= tmp[remove * w + x];
        count--;
      }
      if (add >= 0 && add < h) {
        sum += tmp[add * w + x];
        count++;
      }
    }
  }

  return out;
}

function sampleBilinear(src: Float32Array, w: number, h: number, x: number, y: number): number {
  const fx = Math.min(w - 1, Math.max(0, x));
  const fy = Math.min(h - 1, Math.max(0, y));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const a = src[y0 * w + x0];
  const b = src[y0 * w + x1];
  const c = src[y1 * w + x0];
  const d = src[y1 * w + x1];
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

function processImage(req: Request): Response {
  const { width: w, height: h, data, options } = req;

  const gray = new Float32Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Estimate the paper level on a downscaled copy, then bring it back up.
  const factor = Math.max(1, Math.round(Math.max(w, h) / 520));
  const sw = Math.max(1, Math.floor(w / factor));
  const sh = Math.max(1, Math.floor(h / factor));
  const small = new Float32Array(sw * sh);
  for (let sy = 0; sy < sh; sy++) {
    const y0 = sy * factor;
    const y1 = Math.min(h, y0 + factor);
    for (let sx = 0; sx < sw; sx++) {
      const x0 = sx * factor;
      const x1 = Math.min(w, x0 + factor);
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += gray[y * w + x];
          count++;
        }
      }
      small[sy * sw + sx] = count ? sum / count : 255;
    }
  }

  const radius = Math.max(2, Math.round(Math.min(sw, sh) * 0.032));
  const bgSmall = boxBlur(dilate(dilate(small, sw, sh, 1), sw, sh, radius), sw, sh, Math.max(1, radius >> 1));

  const strength = Math.min(100, Math.max(0, options.strength));
  const contrast = Math.min(100, Math.max(0, options.contrast));
  const k = 0.35 + (1 - strength / 100) * 0.75;
  const gamma = 1.6 - (contrast / 100) * 0.9;
  const feather = Math.max(0, Math.min(5, Math.round(options.feather)));

  const rawAlpha = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = (y + 0.5) / factor - 0.5;
    for (let x = 0; x < w; x++) {
      const sx = (x + 0.5) / factor - 0.5;
      const bg = sampleBilinear(bgSmall, sw, sh, sx, sy);
      const g = gray[y * w + x];
      let a = (bg - g) / Math.max(26, bg * k);
      a = clamp01(a);
      if (a < 0.045) {
        a = 0;
      } else {
        a = Math.pow(a, gamma);
      }
      rawAlpha[y * w + x] = a;
    }
  }

  // Remove isolated speckles (but keep fine dots such as the dot of an i).
  const cleaned = rawAlpha.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (rawAlpha[i] < 0.2) continue;
      const maxAround = Math.max(
        rawAlpha[i - 1],
        rawAlpha[i + 1],
        rawAlpha[i - w],
        rawAlpha[i + w],
        rawAlpha[i - w - 1],
        rawAlpha[i - w + 1],
        rawAlpha[i + w - 1],
        rawAlpha[i + w + 1],
      );
      if (maxAround < 0.07) cleaned[i] = 0;
    }
  }

  const alpha = feather > 0 || true ? boxBlur(cleaned, w, h, Math.max(1, feather)) : cleaned;

  // Crop to the ink bounds.
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 0.06) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    return { id: req.id, width: 1, height: 1, data: new Uint8ClampedArray(4), error: 'No ink found' };
  }

  const pad = Math.max(2, Math.round(Math.min(w, h) * 0.008));
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const outW = maxX - minX + 1;
  const outH = maxY - minY + 1;
  const result = new Uint8ClampedArray(outW * outH * 4);
  const inkR = 18;
  const inkG = 18;
  const inkB = 22;

  for (let y = 0; y < outH; y++) {
    const srcRow = (y + minY) * w + minX;
    const dstRow = y * outW;
    for (let x = 0; x < outW; x++) {
      const a = alpha[srcRow + x];
      const di = (dstRow + x) * 4;
      const si = (srcRow + x) * 4;
      if (options.keepColor) {
        result[di] = data[si];
        result[di + 1] = data[si + 1];
        result[di + 2] = data[si + 2];
      } else {
        result[di] = inkR;
        result[di + 1] = inkG;
        result[di + 2] = inkB;
      }
      result[di + 3] = Math.round(a * 255);
    }
  }

  return { id: req.id, width: outW, height: outH, data: result };
}

ctx.onmessage = (event: MessageEvent<Request>) => {
  const req = event.data;
  try {
    const result = processImage(req);
    ctx.postMessage(result, [result.data.buffer]);
  } catch (err) {
    ctx.postMessage({
      id: req.id,
      width: 0,
      height: 0,
      data: new Uint8ClampedArray(0),
      error: err instanceof Error ? err.message : 'Background removal failed',
    });
  }
};
