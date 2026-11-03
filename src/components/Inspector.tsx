import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Layers,
  Minus,
  PenLine,
  Plus,
  RotateCcw,
  Trash2,
  Type,
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { clamp } from '../lib/coords';
import { FONT_BY_ID } from '../lib/fonts';
import type { FontCategory, FontId, SignaturePlacement, TextPlacement } from '../lib/types';
import PenColorPicker from './PenColorPicker';
import FontPicker from './FontPicker';
import { getCachedRecoloredSignature, recolorSignatureDataUrl } from '../lib/image';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="inspector-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export default function Inspector() {
  const placements = useAppStore((s) => s.placements);
  const selectedId = useAppStore((s) => s.selectedId);
  const pages = useAppStore((s) => s.pages);
  const assets = useAppStore((s) => s.assets);
  const focusText = useAppStore((s) => s.focusText);
  const updatePlacement = useAppStore((s) => s.updatePlacement);
  const pushHistory = useAppStore((s) => s.pushHistory);
  const removePlacement = useAppStore((s) => s.removePlacement);
  const duplicatePlacement = useAppStore((s) => s.duplicatePlacement);
  const bringForward = useAppStore((s) => s.bringForward);
  const sendBackward = useAppStore((s) => s.sendBackward);
  const bringToFront = useAppStore((s) => s.bringToFront);
  const sendToBack = useAppStore((s) => s.sendToBack);
  const penColor = useAppStore((s) => s.penColor);
  const setPenColor = useAppStore((s) => s.setPenColor);

  const selected = placements.find((p) => p.id === selectedId) ?? null;
  const page = selected ? pages[selected.pageIndex] : null;
  const [lockAspect, setLockAspect] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textSession = useRef(false);

  const signature = selected?.type === 'signature' ? (selected as SignaturePlacement) : null;
  const text = selected?.type === 'text' ? (selected as TextPlacement) : null;
  const asset = signature ? assets[signature.assetId] : null;
  const sigColor = signature?.color || penColor;
  const sigThickness = signature?.thickness ?? 0;
  const [sigPreviewUrl, setSigPreviewUrl] = useState<string>('');
  const [fontCategory, setFontCategory] = useState<FontCategory>('handwriting');

  useEffect(() => {
    if (text?.fontId) {
      const cat = FONT_BY_ID[text.fontId]?.category || 'handwriting';
      setFontCategory(cat);
    }
  }, [text?.id]);

  useEffect(() => {
    if (!asset?.dataUrl) {
      setSigPreviewUrl('');
      return;
    }
    const cached = getCachedRecoloredSignature(asset.dataUrl, sigColor, sigThickness);
    if (cached) {
      setSigPreviewUrl(cached);
      return;
    }
    let cancelled = false;
    recolorSignatureDataUrl(asset.dataUrl, sigColor, sigThickness).then((res) => {
      if (!cancelled) setSigPreviewUrl(res);
    });
    return () => {
      cancelled = true;
    };
  }, [asset?.dataUrl, sigColor, sigThickness]);

  useEffect(() => {
    if (selected?.type === 'text' && focusText > 0) {
      const area = textareaRef.current;
      if (area) {
        area.focus();
        area.select();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusText]);

  useEffect(() => {
    setLockAspect(true);
  }, [selectedId]);

  if (!selected || !page) {
    return (
      <aside className="inspector">
        <div className="inspector-empty">
          <div className="inspector-empty-icon">
            <PenLine size={20} />
          </div>
          <h2>Ready when you are</h2>
          <p>
            Pick a signature from the library, or use the <strong>Insert Text</strong> tool to add
            handwritten or standard text.
          </p>
          <ol className="quick-steps">
            <li>
              <span>1</span> Place a signature or text on the page.
            </li>
            <li>
              <span>2</span> Drag, resize and rotate until it fits.
            </li>
            <li>
              <span>3</span> Download the signed PDF.
            </li>
          </ol>
          <div className="shortcut-card">
            <div>
              <kbd>Ctrl</kbd> + <kbd>Z</kbd> <span>Undo</span>
            </div>
            <div>
              <kbd>Del</kbd> <span>Remove selected</span>
            </div>
            <div>
              <kbd>←</kbd> <kbd>→</kbd> <span>Nudge 1 pt</span>
            </div>
            <div>
              <kbd>Shift</kbd> + <kbd>←</kbd> <span>Nudge 10 pt</span>
            </div>
          </div>
          <div className="privacy-card">
            <Layers size={15} />
            <p>Files never leave this computer. Signatures are saved in your browser only.</p>
          </div>
        </div>
      </aside>
    );
  }

  const setSize = (width: number, height: number) => {
    const cx = selected.x + selected.width / 2;
    const cy = selected.y + selected.height / 2;
    const w = clamp(width, 16, page.width);
    const h = clamp(height, 8, page.height);
    updatePlacement(selected.id, {
      width: w,
      height: h,
      x: clamp(cx - w / 2, 0, Math.max(0, page.width - w)),
      y: clamp(cy - h / 2, 0, Math.max(0, page.height - h)),
    });
  };

  const aspect = asset ? asset.width / asset.height : 1;

  const updateWidth = (value: number) => {
    const width = clamp(value, 16, page.width);
    if (signature && lockAspect) setSize(width, width / aspect);
    else setSize(width, selected.height);
  };

  const updateHeight = (value: number) => {
    const height = clamp(value, 8, page.height);
    if (signature && lockAspect) setSize(height * aspect, height);
    else setSize(selected.width, height);
  };

  const beginTextSession = () => {
    if (!textSession.current) {
      pushHistory();
      textSession.current = true;
    }
  };

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <span className={`inspector-type ${selected.type}`}>
          {selected.type === 'signature' ? <PenLine size={14} /> : <Type size={14} />}
          {selected.type === 'signature' ? 'Signature' : 'Text'}
        </span>
        <span className="inspector-page">Page {selected.pageIndex + 1}</span>
      </div>

      {signature && (
        <>
          <Section title="Appearance">
            <div className="signature-preview">
              {asset ? (
                <img src={sigPreviewUrl || asset.dataUrl} alt={asset.name} />
              ) : (
                <span>Missing image</span>
              )}
            </div>
            <Field label="Pen colour">
              <PenColorPicker
                value={sigColor}
                onChange={setPenColor}
                showLabel
              />
            </Field>
            <Field label="Stroke thickness">
              <div className="range-row">
                <input
                  type="range"
                  min={-3}
                  max={3}
                  step={1}
                  value={sigThickness}
                  onPointerDown={pushHistory}
                  onChange={(e) =>
                    updatePlacement(selected.id, { thickness: Number(e.target.value) })
                  }
                />
                <div className="thickness-btn-group">
                  <button
                    type="button"
                    className="mini-icon"
                    title="Decrease thickness (thinner)"
                    disabled={sigThickness <= -3}
                    onClick={() => {
                      pushHistory();
                      updatePlacement(selected.id, {
                        thickness: Math.max(-3, sigThickness - 1),
                      });
                    }}
                  >
                    <Minus size={12} />
                  </button>
                  <span className="range-value">
                    {sigThickness === 0
                      ? 'Normal'
                      : sigThickness > 0
                      ? `+${sigThickness}`
                      : `${sigThickness}`}
                  </span>
                  <button
                    type="button"
                    className="mini-icon"
                    title="Increase thickness (bolder)"
                    disabled={sigThickness >= 3}
                    onClick={() => {
                      pushHistory();
                      updatePlacement(selected.id, {
                        thickness: Math.min(3, sigThickness + 1),
                      });
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </Field>
            <div className="size-grid">
              <Field label="Width">
                <div className="input-with-unit">
                  <input
                    type="number"
                    min={16}
                    value={Math.round(signature.width)}
                    onFocus={pushHistory}
                    onChange={(e) => updateWidth(Number(e.target.value))}
                  />
                  <span>pt</span>
                </div>
              </Field>
              <Field label="Height">
                <div className="input-with-unit">
                  <input
                    type="number"
                    min={8}
                    value={Math.round(signature.height)}
                    onFocus={pushHistory}
                    onChange={(e) => updateHeight(Number(e.target.value))}
                  />
                  <span>pt</span>
                </div>
              </Field>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={lockAspect}
                onChange={(e) => setLockAspect(e.target.checked)}
              />
              Keep proportions
            </label>
          </Section>

          <Section title="Transform">
            <Field label="Rotation">
              <div className="range-row">
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={signature.rotation}
                  onPointerDown={pushHistory}
                  onChange={(e) => updatePlacement(selected.id, { rotation: Number(e.target.value) })}
                />
                <div className="input-with-unit compact">
                  <input
                    type="number"
                    value={Math.round(signature.rotation)}
                    onFocus={pushHistory}
                    onChange={(e) =>
                      updatePlacement(selected.id, { rotation: Number(e.target.value) })
                    }
                  />
                  <span>°</span>
                </div>
              </div>
            </Field>
            <Field label="Opacity">
              <div className="range-row">
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={signature.opacity}
                  onPointerDown={pushHistory}
                  onChange={(e) =>
                    updatePlacement(selected.id, { opacity: Number(e.target.value) })
                  }
                />
                <span className="range-value">{Math.round(signature.opacity * 100)}%</span>
              </div>
            </Field>
            <button
              className="btn btn-ghost btn-full"
              onClick={() => {
                pushHistory();
                updatePlacement(selected.id, { rotation: 0, opacity: 1 });
              }}
            >
              <RotateCcw size={15} /> Reset transform
            </button>
          </Section>
        </>
      )}

      {text && (
        <>
          <Section title="Text">
            <textarea
              ref={textareaRef}
              className="text-input"
              rows={3}
              value={text.text}
              spellCheck={false}
              onFocus={beginTextSession}
              onBlur={() => {
                textSession.current = false;
              }}
              onChange={(e) => updatePlacement(selected.id, { text: e.target.value })}
            />
          </Section>

          <Section title="Font & Style">
            <Field label="Font family">
              <FontPicker
                value={text.fontId}
                onChange={(fontId) => {
                  pushHistory();
                  updatePlacement(selected.id, { fontId });
                }}
              />
            </Field>

            <Field label="Size">
              <div className="input-with-unit">
                <input
                  type="number"
                  min={6}
                  max={300}
                  value={Math.round(text.fontSize)}
                  onFocus={pushHistory}
                  onChange={(e) =>
                    updatePlacement(selected.id, {
                      fontSize: clamp(Number(e.target.value), 6, 300),
                    })
                  }
                />
                <span>pt</span>
              </div>
            </Field>
            <Field label="Pen colour">
              <PenColorPicker
                value={text.color || penColor}
                onChange={setPenColor}
                showLabel
              />
            </Field>
          </Section>

          <Section title="Transform">
            <Field label="Rotation">
              <div className="range-row">
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={text.rotation}
                  onPointerDown={pushHistory}
                  onChange={(e) => updatePlacement(selected.id, { rotation: Number(e.target.value) })}
                />
                <div className="input-with-unit compact">
                  <input
                    type="number"
                    value={Math.round(text.rotation)}
                    onFocus={pushHistory}
                    onChange={(e) => updatePlacement(selected.id, { rotation: Number(e.target.value) })}
                  />
                  <span>°</span>
                </div>
              </div>
            </Field>
            <Field label="Opacity">
              <div className="range-row">
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={text.opacity}
                  onPointerDown={pushHistory}
                  onChange={(e) => updatePlacement(selected.id, { opacity: Number(e.target.value) })}
                />
                <span className="range-value">{Math.round(text.opacity * 100)}%</span>
              </div>
            </Field>
          </Section>
        </>
      )}

      <Section title="Arrange">
        <div className="arrange-grid">
          <button
            className="icon-btn"
            onClick={() => bringToFront(selected.id)}
            title="Bring to front"
          >
            <ArrowUp size={16} />
          </button>
          <button
            className="icon-btn"
            onClick={() => bringForward(selected.id)}
            title="Bring forward"
          >
            <ArrowUp size={16} strokeWidth={1.5} />
          </button>
          <button
            className="icon-btn"
            onClick={() => sendBackward(selected.id)}
            title="Send backward"
          >
            <ArrowDown size={16} strokeWidth={1.5} />
          </button>
          <button
            className="icon-btn"
            onClick={() => sendToBack(selected.id)}
            title="Send to back"
          >
            <ArrowDown size={16} />
          </button>
        </div>
        <div className="action-row">
          <button className="btn btn-ghost" onClick={() => duplicatePlacement(selected.id)}>
            <Copy size={15} /> Duplicate
          </button>
          <button className="btn btn-danger" onClick={() => removePlacement(selected.id)}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </Section>
    </aside>
  );
}
