import type { FontDef, FontId } from './types';

export const FONTS: FontDef[] = [
  {
    id: 'shadows-into-light',
    name: 'Shadows Into Light (Fine / Clean)',
    family: 'Shadows Into Light',
    file: 'ShadowsIntoLight.ttf',
  },
  { id: 'sacramento', name: 'Sacramento (Slender Script)', family: 'Sacramento', file: 'Sacramento-Regular.ttf' },
  { id: 'reenie-beanie', name: 'Reenie Beanie (Extra Fine)', family: 'Reenie Beanie', file: 'ReenieBeanie.ttf' },
  { id: 'allura', name: 'Allura (Flowing Script)', family: 'Allura', file: 'Allura-Regular.ttf' },
  { id: 'alex-brush', name: 'Alex Brush (Cursive)', family: 'Alex Brush', file: 'AlexBrush-Regular.ttf' },
  { id: 'pinyon-script', name: 'Pinyon Script (Classic Script)', family: 'Pinyon Script', file: 'PinyonScript-Regular.ttf' },
  {
    id: 'la-belle-aurore',
    name: 'La Belle Aurore (Casual)',
    family: 'La Belle Aurore',
    file: 'LaBelleAurore.ttf',
  },
  { id: 'great-vibes', name: 'Great Vibes (Formal Script)', family: 'Great Vibes', file: 'GreatVibes-Regular.ttf' },
  { id: 'kalam', name: 'Kalam (Medium Marker)', family: 'Kalam', file: 'Kalam-Regular.ttf' },
  { id: 'caveat-brush', name: 'Caveat Brush (Bold Brush)', family: 'Caveat Brush', file: 'CaveatBrush-Regular.ttf' },
];

export const FONT_BY_ID: Record<FontId, FontDef> = Object.fromEntries(
  FONTS.map((f) => [f.id, f]),
) as Record<FontId, FontDef>;

export const DEFAULT_FONT: FontId = 'shadows-into-light';
export const LINE_HEIGHT_RATIO = 1.25;

function fontUrl(file: string): string {
  return `${import.meta.env.BASE_URL}fonts/${file}`;
}

let loadPromise: Promise<void> | null = null;

export function ensureFontsLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    await Promise.all(
      FONTS.map(async (font) => {
        try {
          const face = new FontFace(font.family, `url("${fontUrl(font.file)}")`);
          await face.load();
          document.fonts.add(face);
        } catch (err) {
          console.warn(`Could not load font ${font.name}`, err);
        }
      }),
    );
  })();
  return loadPromise;
}

export function cssFont(fontId: FontId): string {
  return `"${FONT_BY_ID[fontId].family}", cursive`;
}

let measureCtx: CanvasRenderingContext2D | null = null;

export interface TextMetricsBlock {
  lines: string[];
  lineHeight: number;
  width: number;
  height: number;
}

export function measureTextBlock(text: string, fontId: FontId, fontSize: number): TextMetricsBlock {
  const lines = text.length ? text.split('\n') : [''];
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  if (!measureCtx && typeof document !== 'undefined') {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  let maxWidth = 0;
  if (measureCtx) {
    measureCtx.font = `${fontSize}px ${cssFont(fontId)}`;
    for (const line of lines) {
      maxWidth = Math.max(maxWidth, measureCtx.measureText(line || ' ').width);
    }
  } else {
    for (const line of lines) {
      maxWidth = Math.max(maxWidth, (line || ' ').length * fontSize * 0.55);
    }
  }
  const width = Math.max(8, Math.ceil(maxWidth) + 2);
  return { lines, lineHeight, width, height: Math.ceil(lines.length * lineHeight) };
}

const bytesCache = new Map<FontId, Promise<ArrayBuffer>>();

export function loadFontBytes(fontId: FontId): Promise<ArrayBuffer> {
  let cached = bytesCache.get(fontId);
  if (!cached) {
    cached = fetch(fontUrl(FONT_BY_ID[fontId].file)).then((res) => {
      if (!res.ok) throw new Error(`Failed to load font ${FONT_BY_ID[fontId].name}`);
      return res.arrayBuffer();
    });
    bytesCache.set(fontId, cached);
  }
  return cached;
}
