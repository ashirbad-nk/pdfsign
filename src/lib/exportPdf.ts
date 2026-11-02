import { PDFDocument, degrees, rgb, type PDFFont, type PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { computeDrawTransform, localOffsetToPdf } from './coords';
import { loadFontBytes } from './fonts';
import { recolorSignatureDataUrl } from './image';
import type { FontId, PageInfo, Placement, SignatureAsset } from './types';

export interface ExportInput {
  bytes: Uint8Array;
  pages: PageInfo[];
  placements: Placement[];
  assets: Record<string, SignatureAsset>;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (!meta.includes('base64')) {
    const binary = decodeURIComponent(payload);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  const binary = atob(payload);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let value = hex.replace('#', '').trim();
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (value.length !== 6 || !/^[0-9a-f]+$/i.test(value)) {
    return { r: 0.1, g: 0.1, b: 0.1 };
  }
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  };
}

export async function buildSignedPdf(input: ExportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input.bytes);
  pdf.registerFontkit(fontkit);
  pdf.setProducer('pdfsign');
  pdf.setModificationDate(new Date());

  const fontCache = new Map<FontId, PDFFont>();
  const imageCache = new Map<string, PDFImage>();

  const getFont = async (fontId: FontId): Promise<PDFFont> => {
    const cached = fontCache.get(fontId);
    if (cached) return cached;
    const bytes = new Uint8Array(await loadFontBytes(fontId));
    const font = await pdf.embedFont(bytes);
    fontCache.set(fontId, font);
    return font;
  };

  const getImage = async (assetId: string, color?: string, thickness?: number): Promise<PDFImage> => {
    const key = `${assetId}_${color || 'default'}_${thickness ?? 0}`;
    const cached = imageCache.get(key);
    if (cached) return cached;
    const asset = input.assets[assetId];
    if (!asset) throw new Error('A signature image is missing');
    let dataUrl = asset.dataUrl;
    if (color || (thickness && thickness !== 0)) {
      dataUrl = await recolorSignatureDataUrl(dataUrl, color || '#18181b', thickness ?? 0);
    }
    const image = await pdf.embedPng(dataUrlToBytes(dataUrl));
    imageCache.set(key, image);
    return image;
  };

  for (const item of input.placements) {
    const pageInfo = input.pages[item.pageIndex];
    if (!pageInfo) continue;
    const page = pdf.getPage(item.pageIndex);
    const transform = computeDrawTransform(item, pageInfo);

    if (item.type === 'signature') {
      const image = await getImage(item.assetId, item.color, item.thickness);
      page.drawImage(image, {
        x: transform.x,
        y: transform.y,
        width: item.width,
        height: item.height,
        rotate: degrees(transform.rotate),
        opacity: item.opacity,
      });
    } else {
      const font = await getFont(item.fontId);
      const color = hexToRgb(item.color);
      const lines = item.text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const baselineFromBottom = item.height - i * item.lineHeight - item.fontSize * 0.85;
        const point = localOffsetToPdf(transform, 0, baselineFromBottom);
        try {
          page.drawText(lines[i], {
            x: point.x,
            y: point.y,
            size: item.fontSize,
            font,
            color: rgb(color.r, color.g, color.b),
            opacity: item.opacity,
            rotate: degrees(transform.rotate),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(
            `The handwriting font could not render this text (${message}). Try removing special characters or emoji.`,
          );
        }
      }
    }
  }

  return pdf.save();
}
