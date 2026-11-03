import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatDate,
  DATE_FORMATS,
  PEN_COLORS,
  COLOR_SHADE_GROUPS,
  DEFAULT_PEN_COLOR,
  type DateFormat,
  type TextPlacement,
  type SignaturePlacement,
} from '../src/lib/types';
import { DEFAULT_FONT, FONTS, FONT_BY_ID, cssFont } from '../src/lib/fonts';
import { useAppStore } from '../src/lib/store';
import { getCachedRecoloredSignature, recolorSignatureDataUrl, adjustAlphaThickness } from '../src/lib/image';

describe('Date formatting & options', () => {
  const testDate = new Date(2026, 10, 2); // 2nd November 2026

  it('formats date as dd/mm/yyyy for "ddmmyyyy"', () => {
    const formatted = formatDate(testDate, 'ddmmyyyy');
    expect(formatted).toBe('02/11/2026');
  });

  it('has ddmmyyyy as the first DATE_FORMATS option', () => {
    expect(DATE_FORMATS[0].id).toBe('ddmmyyyy');
    expect(DATE_FORMATS[0].label).toBe('DD/MM/YYYY');
  });

  it('formats other standard formats correctly', () => {
    expect(formatDate(testDate, 'dmy')).toBe('02 Nov 2026');
    expect(formatDate(testDate, 'iso')).toBe('2026-11-02');
  });
});

describe('Pen colours configuration', () => {
  it('has exactly 4 pen colour options corresponding to common pens', () => {
    expect(PEN_COLORS).toHaveLength(4);
    const ids = PEN_COLORS.map((p) => p.id);
    expect(ids).toEqual(['black', 'blue', 'red', 'green']);
  });

  it('defaults to black pen ink', () => {
    expect(DEFAULT_PEN_COLOR).toBe('#18181b');
  });

  it('provides a curated grid of 32 shades across 8 color families', () => {
    expect(COLOR_SHADE_GROUPS).toHaveLength(8);
    const names = COLOR_SHADE_GROUPS.map((g) => g.name);
    expect(names).toEqual(['Monochrome', 'Blue', 'Purple', 'Red', 'Orange', 'Green', 'Teal', 'Brown']);

    for (const group of COLOR_SHADE_GROUPS) {
      expect(group.shades).toHaveLength(4);
      for (const shade of group.shades) {
        expect(shade.value).toMatch(/^#[0-9a-f]{6}$/i);
        expect(shade.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Store pen colour & placement synchronisation', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      pages: [
        {
          index: 0,
          width: 600,
          height: 800,
          rotation: 0,
          transform: [1, 0, 0, 1, 0, 0],
        },
      ],
      assets: {
        'asset-1': {
          id: 'asset-1',
          name: 'My signature',
          dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          width: 100,
          height: 50,
          createdAt: Date.now(),
        },
      },
      placements: [],
      selectedId: null,
      penColor: DEFAULT_PEN_COLOR,
      history: [],
      future: [],
    });
  });

  it('creates signatures and text with the active pen colour', () => {
    const store = useAppStore.getState();
    store.addSignatureAt('asset-1', 0, 100, 100);
    store.addTextAt(0, 200, 200, 'Hello');
    store.addDateAt(0, 300, 300, 'ddmmyyyy');

    const placements = useAppStore.getState().placements;
    expect(placements).toHaveLength(3);

    // All three items start with the active black pen color
    expect(placements[0].color).toBe('#18181b');
    expect(placements[1].color).toBe('#18181b');
    expect(placements[2].color).toBe('#18181b');

    // And the date text was formatted dd/mm/yyyy
    const dateItem = placements[2];
    if (dateItem.type === 'text') {
      expect(dateItem.text).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
  });

  it('allows handwriting, signature, and date to have different colours independently', () => {
    const store = useAppStore.getState();
    // Default pen is Black (#18181b)
    store.addTextAt(0, 100, 100, 'Handwriting notes');

    // Change pen to Blue for signature & date
    store.select(null);
    store.setPenColor('#1d4ed8');
    store.addSignatureAt('asset-1', 0, 200, 200);

    // Change pen to Red for date
    store.select(null);
    store.setPenColor('#dc2626');
    store.addDateAt(0, 300, 300, 'ddmmyyyy');

    const state = useAppStore.getState();
    expect(state.placements).toHaveLength(3);

    // Handwriting is black
    expect(state.placements[0].color).toBe('#18181b');
    // Signature is blue
    expect(state.placements[1].color).toBe('#1d4ed8');
    // Date is red
    expect(state.placements[2].color).toBe('#dc2626');

    // Updating a selected item only changes that item
    store.select(state.placements[0].id);
    store.setPenColor('#15803d'); // change handwriting to green

    const updated = useAppStore.getState();
    expect(updated.placements[0].color).toBe('#15803d');
    expect(updated.placements[1].color).toBe('#1d4ed8'); // signature remains blue
    expect(updated.placements[2].color).toBe('#dc2626'); // date remains red
  });

  it('supports undoing pen colour changes', () => {
    const store = useAppStore.getState();
    store.addSignatureAt('asset-1', 0, 100, 100);
    const sigId = useAppStore.getState().placements[0].id;
    expect(useAppStore.getState().placements[0].color).toBe('#18181b');

    store.select(sigId);
    store.setPenColor('#dc2626'); // Red pen
    expect(useAppStore.getState().placements[0].color).toBe('#dc2626');

    store.undo();
    expect(useAppStore.getState().placements[0].color).toBe('#18181b');
  });

  it('uses realistic, non-bold font sizes and clean font for placed text and dates', () => {
    const store = useAppStore.getState();
    store.addTextAt(0, 100, 100, 'Handwritten text');
    store.addDateAt(0, 100, 200, 'ddmmyyyy');

    const placements = useAppStore.getState().placements;
    expect(placements).toHaveLength(2);

    const textPlacement = placements[0] as TextPlacement;
    const datePlacement = placements[1] as TextPlacement;

    expect(textPlacement.fontId).toBe('shadows-into-light');
    expect(textPlacement.fontSize).toBe(18);

    expect(datePlacement.fontId).toBe('shadows-into-light');
    expect(datePlacement.fontSize).toBe(16);
  });
});

describe('Handwriting styling and weights', () => {
  it('uses a fine, clean handwriting font as DEFAULT_FONT instead of a bold brush', () => {
    expect(DEFAULT_FONT).toBe('shadows-into-light');
  });

  it('separates fonts into fine handwriting and standard document print categories', () => {
    const handwritingFonts = FONTS.filter((f) => f.category === 'handwriting');
    const standardFonts = FONTS.filter((f) => f.category === 'standard');

    expect(handwritingFonts.length).toBeGreaterThanOrEqual(8);
    expect(standardFonts).toHaveLength(3);

    // Standard fonts check
    const stdIds = standardFonts.map((f) => f.id);
    expect(stdIds).toContain('standard-sans');
    expect(stdIds).toContain('standard-serif');
    expect(stdIds).toContain('standard-mono');

    // No bold brush fonts in active font list
    const activeIds = FONTS.map((f) => f.id);
    expect(activeIds).not.toContain('caveat-brush');
    expect(activeIds).not.toContain('kalam');
  });

  it('verifies all font files exist in public/fonts', () => {
    const root = path.resolve(__dirname, '..');
    for (const font of FONTS) {
      const file = path.join(root, 'public', 'fonts', font.file);
      expect(fs.existsSync(file), `Missing font file: ${font.file}`).toBe(true);
    }
  });

  it('returns proper CSS fallback families for handwriting and standard fonts', () => {
    expect(cssFont('standard-sans')).toContain('sans-serif');
    expect(cssFont('standard-serif')).toContain('serif');
    expect(cssFont('standard-mono')).toContain('monospace');
    expect(cssFont('shadows-into-light')).toContain('cursive');
  });
});

describe('Signature stroke thickness adjustments', () => {
  it('dilates alpha to increase thickness (+1)', () => {
    // 5x5 grid with a single solid pixel at center (2, 2)
    const data = new Uint8ClampedArray(5 * 5 * 4);
    data[(2 * 5 + 2) * 4 + 3] = 255; // center pixel alpha

    adjustAlphaThickness(data, 5, 5, 1);

    // Center pixel remains solid
    expect(data[(2 * 5 + 2) * 4 + 3]).toBe(255);
    // Adjacent pixels expanded outward (thicker)
    expect(data[(2 * 5 + 1) * 4 + 3]).toBeGreaterThan(0);
    expect(data[(2 * 5 + 3) * 4 + 3]).toBeGreaterThan(0);
    expect(data[(1 * 5 + 2) * 4 + 3]).toBeGreaterThan(0);
    expect(data[(3 * 5 + 2) * 4 + 3]).toBeGreaterThan(0);
  });

  it('erodes alpha to decrease thickness (-1)', () => {
    // 5x5 grid with a 3x3 solid block in center
    const data = new Uint8ClampedArray(5 * 5 * 4);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        data[(y * 5 + x) * 4 + 3] = 255;
      }
    }

    // Outer edge pixels should decrease / erode
    adjustAlphaThickness(data, 5, 5, -1);
    expect(data[(1 * 5 + 1) * 4 + 3]).toBeLessThan(255);
  });

  it('updates signature thickness via store placement update', () => {
    const store = useAppStore.getState();
    store.addSignatureAt('asset-1', 0, 100, 100);
    const sigId = useAppStore.getState().placements[0].id;

    store.updatePlacement(sigId, { thickness: 2 });
    expect((useAppStore.getState().placements[0] as SignaturePlacement).thickness).toBe(2);

    store.updatePlacement(sigId, { thickness: -1 });
    expect((useAppStore.getState().placements[0] as SignaturePlacement).thickness).toBe(-1);
  });
});

describe('Signature recoloring utility', () => {
  it('returns dataUrl unmodified if empty or no color', async () => {
    const result = await recolorSignatureDataUrl('', '#1d4ed8');
    expect(result).toBe('');
  });

  it('reads from cache when available', () => {
    expect(getCachedRecoloredSignature('some-url', '')).toBe('some-url');
  });
});
