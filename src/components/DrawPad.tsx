import { useEffect, useRef, useState } from 'react';
import { Eraser, RotateCcw } from 'lucide-react';
import { getStroke } from 'perfect-freehand';
import { trimTransparentCanvas } from '../lib/image';

type Point = [number, number, number];

interface DrawPadProps {
  onChange: (dataUrl: string, width: number, height: number) => void;
  penColor?: string;
}

const WIDTH = 1400;
const HEIGHT = 560;

function strokeOutline(points: Point[], size: number): number[][] {
  return getStroke(points, {
    size,
    thinning: 0.55,
    smoothing: 0.55,
    streamline: 0.34,
    simulatePressure: true,
    last: true,
  });
}

function paint(
  canvas: HTMLCanvasElement,
  strokes: Point[][],
  current: Point[],
  penSize: number,
  penColor: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = penColor;
  ctx.strokeStyle = penColor;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const points of [...strokes, ...(current.length ? [current] : [])]) {
    if (!points.length) continue;
    const outline = strokeOutline(points, penSize);
    if (outline.length < 3) {
      const [x, y] = points[0];
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, penSize / 2), 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) {
      ctx.lineTo(outline[i][0], outline[i][1]);
    }
    ctx.closePath();
    ctx.fill();
  }
}

export default function DrawPad({ onChange, penColor = '#18181b' }: DrawPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [current, setCurrent] = useState<Point[]>([]);
  const [penSize, setPenSize] = useState(5);
  const drawing = useRef(false);
  const emitRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paint(canvas, strokes, current, penSize, penColor);
    if (emitRef.current || strokes.length > 0) {
      emitRef.current = false;
      const trimmed = trimTransparentCanvas(canvas, 14);
      if (trimmed === canvas) {
        onChange('', 0, 0);
      } else {
        onChange(trimmed.toDataURL('image/png'), trimmed.width, trimmed.height);
      }
    }
  }, [strokes, current, penSize, penColor, onChange]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const pressure = event.pressure > 0 ? event.pressure : 0.5;
    return [x, y, pressure];
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    setCurrent([pointFromEvent(event)]);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const point = pointFromEvent(event);
    setCurrent((prev) => {
      const last = prev[prev.length - 1];
      if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 1.2) return prev;
      return [...prev, point];
    });
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (current.length) {
      emitRef.current = true;
      setStrokes((prev) => [...prev, current]);
    }
    setCurrent([]);
  };

  const undo = () => {
    emitRef.current = true;
    setStrokes((prev) => prev.slice(0, -1));
    setCurrent([]);
  };

  const clear = () => {
    emitRef.current = true;
    setStrokes([]);
    setCurrent([]);
    onChange('', 0, 0);
  };

  return (
    <div className="draw-pad">
      <div className="draw-surface">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
          onPointerLeave={finish}
        />
        {!strokes.length && !current.length && (
          <div className="draw-hint">Sign here with your mouse or touchpad</div>
        )}
      </div>
      <div className="draw-controls">
        <label className="pen-size">
          <span>Pen</span>
          <input
            type="range"
            min={2}
            max={14}
            step={1}
            value={penSize}
            onChange={(event) => {
              emitRef.current = true;
              setPenSize(Number(event.target.value));
            }}
          />
        </label>
        <div className="draw-buttons">
          <button className="btn btn-ghost btn-small" onClick={undo} disabled={!strokes.length}>
            <RotateCcw size={14} /> Undo
          </button>
          <button
            className="btn btn-ghost btn-small"
            onClick={clear}
            disabled={!strokes.length && !current.length}
          >
            <Eraser size={14} /> Clear
          </button>
        </div>
      </div>
      <p className="section-hint">
        Tip: a touchscreen or stylus gives the smoothest result. The background stays transparent.
      </p>
    </div>
  );
}
