export type Tool = 'select' | 'signature' | 'text';

export type FontId =
  | 'great-vibes'
  | 'allura'
  | 'alex-brush'
  | 'sacramento'
  | 'caveat-brush'
  | 'shadows-into-light'
  | 'kalam'
  | 'reenie-beanie'
  | 'la-belle-aurore'
  | 'pinyon-script';

export interface FontDef {
  id: FontId;
  name: string;
  family: string;
  file: string;
}

export interface SignatureAsset {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface PageInfo {
  index: number;
  /** viewport width in PDF points at scale 1, including page rotation */
  width: number;
  /** viewport height in PDF points at scale 1, including page rotation */
  height: number;
  /** PDF /Rotate normalized to 0 | 90 | 180 | 270 */
  rotation: number;
  /** pdf.js viewport transform (PDF user space -> display points at scale 1) */
  transform: [number, number, number, number, number, number];
}

export interface PlacementBase {
  id: string;
  pageIndex: number;
  /** top-left x in display points (scale 1) */
  x: number;
  /** top-left y in display points (scale 1) */
  y: number;
  width: number;
  height: number;
  /** clockwise rotation in degrees, around the box center */
  rotation: number;
  opacity: number;
  color?: string;
}

export interface SignaturePlacement extends PlacementBase {
  type: 'signature';
  assetId: string;
  color?: string;
  thickness?: number;
}

export interface TextPlacement extends PlacementBase {
  type: 'text';
  text: string;
  fontId: FontId;
  fontSize: number;
  lineHeight: number;
  color: string;
}

export type Placement = SignaturePlacement | TextPlacement;

export interface PenColorDef {
  id: string;
  label: string;
  value: string;
}

export const PEN_COLORS: PenColorDef[] = [
  { id: 'black', label: 'Black pen', value: '#18181b' },
  { id: 'blue', label: 'Blue pen', value: '#1d4ed8' },
  { id: 'red', label: 'Red pen', value: '#dc2626' },
  { id: 'green', label: 'Green pen', value: '#15803d' },
];

export const DEFAULT_PEN_COLOR = PEN_COLORS[0].value;

export interface ColorShade {
  label: string;
  value: string;
}

export interface ColorShadeGroup {
  name: string;
  shades: ColorShade[];
}

export const COLOR_SHADE_GROUPS: ColorShadeGroup[] = [
  {
    name: 'Monochrome',
    shades: [
      { label: 'Pencil Gray', value: '#9ca3af' },
      { label: 'Slate Gray', value: '#4b5563' },
      { label: 'Charcoal', value: '#374151' },
      { label: 'Jet Black', value: '#111827' },
    ],
  },
  {
    name: 'Blue',
    shades: [
      { label: 'Sky Blue', value: '#60a5fa' },
      { label: 'Classic Blue', value: '#2563eb' },
      { label: 'Royal Blue', value: '#1d4ed8' },
      { label: 'Deep Navy', value: '#1e3a8a' },
    ],
  },
  {
    name: 'Purple',
    shades: [
      { label: 'Lavender', value: '#c084fc' },
      { label: 'Violet Ink', value: '#9333ea' },
      { label: 'Deep Purple', value: '#7e22ce' },
      { label: 'Dark Plum', value: '#581c87' },
    ],
  },
  {
    name: 'Red',
    shades: [
      { label: 'Warm Coral', value: '#f87171' },
      { label: 'Vibrant Red', value: '#ef4444' },
      { label: 'Crimson Ink', value: '#dc2626' },
      { label: 'Dark Burgundy', value: '#7f1d1d' },
    ],
  },
  {
    name: 'Orange',
    shades: [
      { label: 'Tangerine', value: '#fb923c' },
      { label: 'Burnt Orange', value: '#ea580c' },
      { label: 'Rust', value: '#c2410c' },
      { label: 'Dark Amber', value: '#7c2d12' },
    ],
  },
  {
    name: 'Green',
    shades: [
      { label: 'Mint Green', value: '#4ade80' },
      { label: 'Emerald Pen', value: '#16a34a' },
      { label: 'Forest Green', value: '#15803d' },
      { label: 'Dark Pine', value: '#14532d' },
    ],
  },
  {
    name: 'Teal',
    shades: [
      { label: 'Aqua / Cyan', value: '#2dd4bf' },
      { label: 'Teal Pen', value: '#0d9488' },
      { label: 'Deep Teal', value: '#0f766e' },
      { label: 'Dark Ocean', value: '#134e4a' },
    ],
  },
  {
    name: 'Brown',
    shades: [
      { label: 'Golden Ochre', value: '#d97706' },
      { label: 'Warm Caramel', value: '#b45309' },
      { label: 'Sepia Ink', value: '#78350f' },
      { label: 'Dark Espresso', value: '#451a03' },
    ],
  },
];

export interface BgOptions {
  strength: number;
  contrast: number;
  feather: number;
  keepColor: boolean;
}

export interface ProcessedImage {
  dataUrl: string;
  width: number;
  height: number;
}

export interface PdfMeta {
  fileName: string;
  baseName: string;
  pages: PageInfo[];
  bytes: Uint8Array;
}

export type DateFormat = 'ddmmyyyy' | 'dmy' | 'mdy' | 'long' | 'iso';

export interface DateFormatOption {
  id: DateFormat;
  label: string;
  pattern: string;
}

export const DATE_FORMATS: DateFormatOption[] = [
  { id: 'ddmmyyyy', label: 'DD/MM/YYYY', pattern: 'DD/MM/YYYY' },
  { id: 'dmy', label: 'DD MMM YYYY', pattern: 'DD MMM YYYY' },
  { id: 'mdy', label: 'MMM D, YYYY', pattern: 'MMM D, YYYY' },
  { id: 'long', label: 'Full date', pattern: 'Month D, YYYY' },
  { id: 'iso', label: 'YYYY-MM-DD', pattern: 'YYYY-MM-DD' },
];

export function formatDate(date: Date, format: DateFormat): string {
  const day = String(date.getDate()).padStart(2, '0');
  const monthNum = String(date.getMonth() + 1).padStart(2, '0');
  const monthShort = date.toLocaleString('en-US', { month: 'short' });
  const monthLong = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  switch (format) {
    case 'ddmmyyyy':
      return `${day}/${monthNum}/${year}`;
    case 'mdy':
      return `${monthShort} ${date.getDate()}, ${year}`;
    case 'long':
      return `${monthLong} ${date.getDate()}, ${year}`;
    case 'iso':
      return `${year}-${monthNum}-${day}`;
    case 'dmy':
    default:
      return `${day} ${monthShort} ${year}`;
  }
}
