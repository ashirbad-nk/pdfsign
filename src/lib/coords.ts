import type { PageInfo, PlacementBase } from './types';

export interface Point {
  x: number;
  y: number;
}

export type Transform = [number, number, number, number, number, number];

/** Invert a pdf.js 2D affine transform (PDF space -> viewport space). */
export function invertTransform(t: Transform): (x: number, y: number) => Point {
  const [a, b, c, d, e, f] = t;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-9) return () => ({ x: 0, y: 0 });
  return (x: number, y: number) => ({
    x: (d * (x - e) - c * (y - f)) / det,
    y: (-b * (x - e) + a * (y - f)) / det,
  });
}

/** Rotate a vector counter-clockwise in PDF space. */
export function rotateVector(x: number, y: number, degrees: number): Point {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

export interface DrawTransform {
  /** bottom-left anchor of the unrotated box, in PDF user space */
  x: number;
  y: number;
  /** counter-clockwise rotation in PDF user space */
  rotate: number;
  /** box center in PDF user space */
  center: Point;
}

/**
 * Convert a display-space placement (top-left origin, y down, scale 1) into the
 * anchor/rotation pdf-lib needs to draw the same box on the page.
 *
 * A page /Rotate R turns the PDF space clockwise by R on screen. An element that
 * must appear at theta clockwise in display space therefore needs a PDF-space
 * rotation of phi = R - theta (PDF rotations are counter-clockwise).
 */
export function computeDrawTransform(item: PlacementBase, page: PageInfo): DrawTransform {
  const toPdf = invertTransform(page.transform);
  const center = toPdf(item.x + item.width / 2, item.y + item.height / 2);
  const phi = page.rotation - item.rotation;
  const half = rotateVector(item.width / 2, item.height / 2, phi);
  return {
    x: center.x - half.x,
    y: center.y - half.y,
    rotate: phi,
    center,
  };
}

/** Point in PDF space for a local offset from the bottom-left corner of the box. */
export function localOffsetToPdf(t: DrawTransform, ox: number, oy: number): Point {
  const v = rotateVector(ox, oy, t.rotate);
  return { x: t.x + v.x, y: t.y + v.y };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Largest zoom that fits the page in the given viewport box. */
export function fitScale(
  page: { width: number; height: number },
  availableWidth: number,
  availableHeight: number,
  padding = 72,
): number {
  const scale = Math.min(
    (availableWidth - padding) / page.width,
    (availableHeight - padding) / page.height,
  );
  return clamp(scale, 0.2, 2.5);
}
