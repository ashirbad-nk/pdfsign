import { useEffect, useMemo, useRef, useState } from 'react';
import type { PageInfo, Placement, SignatureAsset, TextPlacement } from '../lib/types';
import { cssFont } from '../lib/fonts';
import { clamp } from '../lib/coords';
import { measureTextBlock } from '../lib/fonts';
import { useAppStore } from '../lib/store';
import { getCachedRecoloredSignature, recolorSignatureDataUrl } from '../lib/image';

type Corner = 'nw' | 'ne' | 'sw' | 'se';

interface MoveGesture {
  kind: 'move';
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  moved: boolean;
}

interface ResizeGesture {
  kind: 'resize';
  startClientX: number;
  startClientY: number;
  centerX: number;
  centerY: number;
  startW: number;
  startH: number;
  startFontSize: number;
  startRotation: number;
  moved: boolean;
}

interface RotateGesture {
  kind: 'rotate';
  centerX: number;
  centerY: number;
  startAngle: number;
  startRotation: number;
  moved: boolean;
}

interface Gesture {
  move?: MoveGesture;
  resize?: ResizeGesture;
  rotate?: RotateGesture;
}

const MIN_W = 16;
const MIN_H = 8;

function normalizeDegrees(angle: number): number {
  let value = angle % 360;
  if (value > 180) value -= 360;
  if (value <= -180) value += 360;
  return value;
}

function snapRotation(angle: number, shift: boolean): number {
  const normalized = normalizeDegrees(angle);
  if (shift) return normalizeDegrees(Math.round(normalized / 15) * 15);
  for (const target of [0, 90, 180, -90]) {
    if (Math.abs(normalized - target) < 4) return target === -90 ? 270 : target;
  }
  return normalized;
}

export default function PlacedItem({
  item,
  page,
  zoom,
  selected,
  asset,
}: {
  item: Placement;
  page: PageInfo;
  zoom: number;
  selected: boolean;
  asset?: SignatureAsset;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture>({});
  const select = useAppStore((s) => s.select);
  const updatePlacement = useAppStore((s) => s.updatePlacement);
  const pushHistory = useAppStore((s) => s.pushHistory);
  const bumpFocusText = useAppStore((s) => s.bumpFocusText);

  const targetColor = item.color || '#18181b';
  const targetThickness = item.type === 'signature' ? item.thickness ?? 0 : 0;
  const [displayUrl, setDisplayUrl] = useState<string>(() => {
    if (item.type !== 'signature' || !asset) return '';
    return getCachedRecoloredSignature(asset.dataUrl, targetColor, targetThickness) || asset.dataUrl;
  });

  useEffect(() => {
    if (item.type !== 'signature' || !asset?.dataUrl) return;
    let cancelled = false;
    const cached = getCachedRecoloredSignature(asset.dataUrl, targetColor, targetThickness);
    if (cached) {
      setDisplayUrl(cached);
      return;
    }
    recolorSignatureDataUrl(asset.dataUrl, targetColor, targetThickness).then((recolored) => {
      if (!cancelled) setDisplayUrl(recolored);
    });
    return () => {
      cancelled = true;
    };
  }, [item.type, asset?.dataUrl, targetColor, targetThickness]);

  const textStyle = useMemo(() => {
    if (item.type !== 'text') return undefined;
    return {
      fontFamily: cssFont(item.fontId),
      fontSize: item.fontSize * zoom,
      lineHeight: `${item.lineHeight * zoom}px`,
      color: item.color,
      fontWeight: 400,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    } as React.CSSProperties;
  }, [item, zoom]);

  const beginMove = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    select(item.id);
    const start = {
      kind: 'move' as const,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: item.x,
      startY: item.y,
      moved: false,
    };
    gestureRef.current.move = start;

    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - start.startClientX) / zoom;
      const dy = (e.clientY - start.startClientY) / zoom;
      if (!start.moved) {
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        start.moved = true;
        pushHistory();
      }
      const x = clamp(start.startX + dx, 0, Math.max(0, page.width - item.width));
      const y = clamp(start.startY + dy, 0, Math.max(0, page.height - item.height));
      updatePlacement(item.id, { x, y });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      gestureRef.current.move = undefined;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const beginResize = (event: React.PointerEvent, corner: Corner) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    select(item.id);
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    const start = {
      kind: 'resize' as const,
      startClientX: event.clientX,
      startClientY: event.clientY,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      startW: item.width,
      startH: item.height,
      startFontSize: item.type === 'text' ? item.fontSize : 0,
      startRotation: item.rotation,
      moved: false,
    };
    gestureRef.current.resize = start;
    void corner;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - start.centerX;
      const dy = e.clientY - start.centerY;
      if (!start.moved) {
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        start.moved = true;
        pushHistory();
      }
      const rad = (start.startRotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const localX = dx * cos + dy * sin;
      const localY = -dx * sin + dy * cos;

      const startW = start.startW;
      const startH = start.startH;
      const pointerHalfW = Math.max(MIN_W / 2, Math.abs(localX));
      const pointerHalfH = Math.max(MIN_H / 2, Math.abs(localY));

      let width: number;
      let height: number;
      let fontSize = start.startFontSize;

      const lockAspect = item.type === 'signature' && !e.shiftKey;
      if (item.type === 'text' || lockAspect) {
        const factor = Math.max(pointerHalfW / (startW / 2), pointerHalfH / (startH / 2));
        width = Math.max(MIN_W, startW * factor);
        height = Math.max(MIN_H, startH * factor);
        if (item.type === 'text') {
          fontSize = clamp(start.startFontSize * factor, 6, 300);
          const metrics = measureTextBlock(item.text, item.fontId, fontSize);
          width = metrics.width;
          height = metrics.height;
        }
      } else {
        width = Math.max(MIN_W, pointerHalfW * 2);
        height = Math.max(MIN_H, pointerHalfH * 2);
      }

      width = Math.min(width, page.width);
      height = Math.min(height, page.height);
      const centerX = start.centerX;
      const centerY = start.centerY;
      const itemCenterX = item.x + item.width / 2;
      const itemCenterY = item.y + item.height / 2;
      void centerX;
      void centerY;

      const x = clamp(itemCenterX - width / 2, 0, Math.max(0, page.width - width));
      const y = clamp(itemCenterY - height / 2, 0, Math.max(0, page.height - height));

      if (item.type === 'text') {
        updatePlacement(item.id, { x, y, width, height, fontSize });
      } else {
        updatePlacement(item.id, { x, y, width, height });
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      gestureRef.current.resize = undefined;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const beginRotate = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    select(item.id);
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startAngle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;

    const start = {
      kind: 'rotate' as const,
      centerX,
      centerY,
      startAngle,
      startRotation: item.rotation,
      moved: false,
    };
    gestureRef.current.rotate = start;

    const onMove = (e: PointerEvent) => {
      const angle = (Math.atan2(e.clientY - start.centerY, e.clientX - start.centerX) * 180) / Math.PI;
      const delta = angle - start.startAngle;
      if (!start.moved) {
        if (Math.abs(delta) < 1) return;
        start.moved = true;
        pushHistory();
      }
      const rotation = snapRotation(start.startRotation + delta, e.shiftKey);
      updatePlacement(item.id, { rotation });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      gestureRef.current.rotate = undefined;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div
      ref={ref}
      className={`placed-item ${selected ? 'is-selected' : ''} ${item.type === 'text' ? 'is-text' : ''}`}
      style={{
        left: item.x * zoom,
        top: item.y * zoom,
        width: item.width * zoom,
        height: item.height * zoom,
        transform: `rotate(${item.rotation}deg)`,
        opacity: item.opacity,
      }}
      onPointerDown={beginMove}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        select(item.id);
        if (item.type === 'text') bumpFocusText();
      }}
      title={item.type === 'text' ? 'Double-click to edit the text' : 'Drag to move'}
    >
      {item.type === 'signature' && asset && (
        <img
          className="placed-signature"
          src={displayUrl || asset.dataUrl}
          alt=""
          draggable={false}
        />
      )}
      {item.type === 'text' && (
        <div className="placed-text" style={textStyle}>
          {item.text}
        </div>
      )}

      {selected && (
        <>
          <span
            className="rotate-stem"
            aria-hidden
          />
          <button
            className="handle handle-rotate"
            aria-label="Rotate"
            onPointerDown={beginRotate}
          />
          {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((corner) => (
            <button
              key={corner}
              className={`handle handle-${corner}`}
              aria-label={`Resize ${corner}`}
              onPointerDown={(event) => beginResize(event, corner)}
            />
          ))}
        </>
      )}
    </div>
  );
}
