import type { RawImage } from './bgRemove';

export async function fileToImageData(file: File, maxDim = 2200): Promise<RawImage> {
  let bitmap: ImageBitmap | HTMLImageElement;
  let width: number;
  let height: number;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    width = bitmap.width;
    height = bitmap.height;
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Could not read that image'));
        element.src = url;
      });
      bitmap = img;
      width = img.naturalWidth;
      height = img.naturalHeight;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const scale = Math.min(1, maxDim / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
  const data = ctx.getImageData(0, 0, outW, outH);
  return { width: outW, height: outH, data: data.data };
}

export function rawToCanvas(image: RawImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  const data = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export function rawToDataUrl(image: RawImage, maxDim = 1400): string {
  const canvas = rawToCanvas(image);
  return canvasToDataUrl(canvas, maxDim);
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, maxDim = 1400): string {
  const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
  if (scale >= 1) return canvas.toDataURL('image/png');
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(canvas.width * scale));
  out.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = out.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

export function dataUrlDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not read the signature image'));
    img.src = dataUrl;
  });
}

/** Crop a transparent canvas to its visible pixels, with a little padding. */
export function trimTransparentCanvas(canvas: HTMLCanvasElement, padding = 8): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 6) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return canvas;
  const x0 = Math.max(0, minX - padding);
  const y0 = Math.max(0, minY - padding);
  const x1 = Math.min(width - 1, maxX + padding);
  const y1 = Math.min(height - 1, maxY + padding);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  const outCtx = out.getContext('2d');
  if (!outCtx) return canvas;
  outCtx.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

const recolorCache = new Map<string, string>();

export function adjustAlphaThickness(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  thickness: number,
): void {
  if (!thickness || thickness === 0) return;
  const passes = Math.min(3, Math.abs(thickness));
  const isDilation = thickness > 0;

  for (let pass = 0; pass < passes; pass++) {
    const src = new Uint8ClampedArray(width * height);
    for (let i = 0; i < src.length; i++) {
      src[i] = data[i * 4 + 3];
    }

    if (isDilation) {
      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          const idx = row + x;
          const current = src[idx];
          if (current >= 245) continue;

          let maxN = current;
          if (x > 0 && src[idx - 1] > maxN) maxN = src[idx - 1];
          if (x < width - 1 && src[idx + 1] > maxN) maxN = src[idx + 1];
          if (y > 0 && src[idx - width] > maxN) maxN = src[idx - width];
          if (y < height - 1 && src[idx + width] > maxN) maxN = src[idx + width];

          if (x > 0 && y > 0 && src[idx - width - 1] * 0.88 > maxN) maxN = Math.round(src[idx - width - 1] * 0.88);
          if (x < width - 1 && y > 0 && src[idx - width + 1] * 0.88 > maxN) maxN = Math.round(src[idx - width + 1] * 0.88);
          if (x > 0 && y < height - 1 && src[idx + width - 1] * 0.88 > maxN) maxN = Math.round(src[idx + width - 1] * 0.88);
          if (x < width - 1 && y < height - 1 && src[idx + width + 1] * 0.88 > maxN) maxN = Math.round(src[idx + width + 1] * 0.88);

          if (maxN > current) {
            data[idx * 4 + 3] = Math.max(current, Math.round(maxN * 0.85));
          }
        }
      }
    } else {
      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          const idx = row + x;
          const current = src[idx];
          if (current <= 15) {
            data[idx * 4 + 3] = 0;
            continue;
          }

          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            data[idx * 4 + 3] = 0;
            continue;
          }

          let minN = src[idx - 1];
          if (src[idx + 1] < minN) minN = src[idx + 1];
          if (src[idx - width] < minN) minN = src[idx - width];
          if (src[idx + width] < minN) minN = src[idx + width];

          if (minN < current) {
            const diff = current - minN;
            data[idx * 4 + 3] = Math.max(0, Math.round(current - diff * 0.65));
          }
        }
      }
    }
  }
}

export function getCachedRecoloredSignature(
  dataUrl: string,
  hexColor: string,
  thickness: number = 0,
): string | null {
  if (!hexColor || !dataUrl) return dataUrl;
  return recolorCache.get(`${dataUrl}_${hexColor}_${thickness}`) || null;
}

/**
 * Tint a transparent PNG signature to a target pen color and adjust stroke thickness.
 */
export async function recolorSignatureDataUrl(
  dataUrl: string,
  hexColor: string,
  thickness: number = 0,
): Promise<string> {
  if (!dataUrl) return dataUrl;
  const color = hexColor || '#18181b';
  const cacheKey = `${dataUrl}_${color}_${thickness}`;
  const hit = recolorCache.get(cacheKey);
  if (hit) return hit;

  if (typeof document === 'undefined') {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);

        if (thickness !== 0) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          adjustAlphaThickness(imgData.data, canvas.width, canvas.height, thickness);
          ctx.putImageData(imgData, 0, 0);
        }

        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const result = canvas.toDataURL('image/png');
        recolorCache.set(cacheKey, result);
        resolve(result);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
