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
