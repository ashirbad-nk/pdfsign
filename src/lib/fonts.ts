import type { FontDef, FontId } from './types';

export const FONTS: FontDef[] = [
  // --- Fine Handwriting (slender, fine pen strokes, no bold) ---
  {
    id: 'shadows-into-light',
    name: 'Shadows Into Light',
    family: 'Shadows Into Light',
    file: 'ShadowsIntoLight.ttf',
    category: 'handwriting',
    description: 'Fine clean ballpoint handwriting',
  },
  {
    id: 'cedarville-cursive',
    name: 'Cedarville Cursive',
    family: 'Cedarville Cursive',
    file: 'CedarvilleCursive.ttf',
    category: 'handwriting',
    description: 'Slender, delicate cursive script',
  },
  {
    id: 'sacramento',
    name: 'Sacramento',
    family: 'Sacramento',
    file: 'Sacramento-Regular.ttf',
    category: 'handwriting',
    description: 'Monoline fine script',
  },
  {
    id: 'reenie-beanie',
    name: 'Reenie Beanie',
    family: 'Reenie Beanie',
    file: 'ReenieBeanie.ttf',
    category: 'handwriting',
    description: 'Extra-fine pencil & pen strokes',
  },
  {
    id: 'homemade-apple',
    name: 'Homemade Apple',
    family: 'Homemade Apple',
    file: 'HomemadeApple.ttf',
    category: 'handwriting',
    description: 'Natural fluid handwriting',
  },
  {
    id: 'la-belle-aurore',
    name: 'La Belle Aurore',
    family: 'La Belle Aurore',
    file: 'LaBelleAurore.ttf',
    category: 'handwriting',
    description: 'Casual fine pen writing',
  },
  {
    id: 'dawning-of-a-new-day',
    name: 'Dawning of a New Day',
    family: 'Dawning of a New Day',
    file: 'DawningofaNewDay.ttf',
    category: 'handwriting',
    description: 'Tall slender handwriting',
  },
  {
    id: 'alex-brush',
    name: 'Alex Brush',
    family: 'Alex Brush',
    file: 'AlexBrush-Regular.ttf',
    category: 'handwriting',
    description: 'Classic flowing cursive',
  },
  {
    id: 'allura',
    name: 'Allura',
    family: 'Allura',
    file: 'Allura-Regular.ttf',
    category: 'handwriting',
    description: 'Fine calligraphy signature',
  },
  {
    id: 'pinyon-script',
    name: 'Pinyon Script',
    family: 'Pinyon Script',
    file: 'PinyonScript-Regular.ttf',
    category: 'handwriting',
    description: 'Vintage formal copperplate',
  },

  // --- Standard Document Print Fonts ---
  {
    id: 'standard-sans',
    name: 'Standard Sans',
    family: 'Liberation Sans',
    file: 'LiberationSans.ttf',
    category: 'standard',
    description: 'Clean modern print (Arial / Helvetica style)',
  },
  {
    id: 'standard-serif',
    name: 'Standard Serif',
    family: 'Liberation Serif',
    file: 'LiberationSerif.ttf',
    category: 'standard',
    description: 'Classic formal serif (Times style)',
  },
  {
    id: 'standard-mono',
    name: 'Standard Mono',
    family: 'Liberation Mono',
    file: 'LiberationMono.ttf',
    category: 'standard',
    description: 'Clean typewriter monospace (Courier style)',
  },
];

// Compatibility entries for legacy saved placements
const LEGACY_FONTS: FontDef[] = [
  {
    id: 'great-vibes',
    name: 'Great Vibes',
    family: 'Great Vibes',
    file: 'GreatVibes-Regular.ttf',
    category: 'handwriting',
    description: 'Formal script',
  },
  {
    id: 'kalam',
    name: 'Kalam',
    family: 'Kalam',
    file: 'Kalam-Regular.ttf',
    category: 'handwriting',
    description: 'Marker',
  },
  {
    id: 'caveat-brush',
    name: 'Caveat Brush',
    family: 'Caveat Brush',
    file: 'CaveatBrush-Regular.ttf',
    category: 'handwriting',
    description: 'Brush',
  },
];

const ALL_FONTS = [...FONTS, ...LEGACY_FONTS];

export const FONT_BY_ID: Record<FontId, FontDef> = Object.fromEntries(
  ALL_FONTS.map((f) => [f.id, f]),
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
      ALL_FONTS.map(async (font) => {
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
  const font = FONT_BY_ID[fontId];
  if (!font) return 'sans-serif';
  if (font.category === 'standard') {
    if (font.id === 'standard-mono') return `"${font.family}", ui-monospace, monospace`;
    if (font.id === 'standard-serif') return `"${font.family}", Times New Roman, serif`;
    return `"${font.family}", ui-sans-serif, system-ui, sans-serif`;
  }
  return `"${font.family}", cursive`;
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
