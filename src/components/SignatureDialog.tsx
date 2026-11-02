import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Sparkles, X } from 'lucide-react';
import { removeBackground, type RawImage } from '../lib/bgRemove';
import { fileToImageData, rawToDataUrl, dataUrlDimensions } from '../lib/image';
import { saveSignature } from '../lib/library';
import { useAppStore } from '../lib/store';
import type { BgOptions, SignatureAsset } from '../lib/types';
import DrawPad from './DrawPad';
import PenColorPicker from './PenColorPicker';

const DEFAULT_OPTIONS: BgOptions = {
  strength: 55,
  contrast: 50,
  feather: 1,
  keepColor: false,
};

type Tab = 'upload' | 'draw';

export default function SignatureDialog() {
  const open = useAppStore((s) => s.signatureModalOpen);
  const close = useAppStore((s) => s.closeSignatureModal);
  const addAsset = useAppStore((s) => s.addAsset);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const showToast = useAppStore((s) => s.showToast);
  const penColor = useAppStore((s) => s.penColor);
  const setPenColor = useAppStore((s) => s.setPenColor);

  const [tab, setTab] = useState<Tab>('upload');
  const [raw, setRaw] = useState<RawImage | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processed, setProcessed] = useState<RawImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<BgOptions>(DEFAULT_OPTIONS);
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('My signature');
  const [save, setSave] = useState(true);
  const [drawUrl, setDrawUrl] = useState('');
  const [drawDims, setDrawDims] = useState({ width: 0, height: 0 });
  const [using, setUsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!raw) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    const timer = setTimeout(() => {
      removeBackground(raw, options)
        .then((result) => {
          if (cancelled) return;
          setProcessed(result);
          setPreviewUrl(rawToDataUrl(result, 1200));
        })
        .catch((err) => {
          if (cancelled) return;
          setProcessed(null);
          setPreviewUrl(null);
          setError(err instanceof Error ? err.message : 'Background removal failed.');
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [raw, options]);

  const loadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, or WebP).');
      return;
    }
    setError(null);
    setProcessed(null);
    setPreviewUrl(null);
    setShowOriginal(false);
    try {
      const image = await fileToImageData(file);
      setRaw(image);
      setOriginalUrl(rawToDataUrl(image, 1000));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image.');
    }
  };

  const handleDrawChange = useCallback((url: string, width: number, height: number) => {
    setDrawUrl(url);
    setDrawDims({ width, height });
  }, []);

  const reset = () => {
    setRaw(null);
    setOriginalUrl(null);
    setProcessed(null);
    setPreviewUrl(null);
    setOptions(DEFAULT_OPTIONS);
    setError(null);
    setTab('upload');
    setDrawUrl('');
    setDrawDims({ width: 0, height: 0 });
    setName('My signature');
    setSave(true);
    setUsing(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const useSignature = async () => {
    let dataUrl = '';
    if (tab === 'upload') {
      if (!processed) return;
      dataUrl = rawToDataUrl(processed, 1400);
    } else {
      if (!drawUrl) return;
      dataUrl = drawUrl;
    }
    setUsing(true);
    try {
      const dims =
        tab === 'draw' && drawDims.width
          ? drawDims
          : await dataUrlDimensions(dataUrl);
      const asset: SignatureAsset = {
        id: crypto.randomUUID(),
        name: name.trim() || 'My signature',
        dataUrl,
        width: dims.width,
        height: dims.height,
        createdAt: Date.now(),
      };
      if (save) {
        try {
          await saveSignature(asset);
        } catch (err) {
          console.warn('Could not save signature to library', err);
          showToast('Signature is ready, but it could not be saved to the library.', 'error');
        }
      }
      addAsset(asset);
      beginPlacing(asset.id);
      close();
      reset();
      showToast('Click on the page to place your signature.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare the signature.');
      setUsing(false);
    }
  };

  if (!open) return null;

  const canUse = tab === 'upload' ? Boolean(processed) : Boolean(drawUrl);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="signature-modal" role="dialog" aria-modal="true" aria-label="New signature">
        <header className="modal-head">
          <div>
            <h2>New signature</h2>
            <p>Photograph a signature on paper, or draw one right here.</p>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="modal-tabs">
          <div className="modal-tabs-group">
            <button
              className={`modal-tab ${tab === 'upload' ? 'active' : ''}`}
              onClick={() => setTab('upload')}
            >
              <ImagePlus size={15} /> Upload a photo
            </button>
            <button
              className={`modal-tab ${tab === 'draw' ? 'active' : ''}`}
              onClick={() => setTab('draw')}
            >
              <Sparkles size={15} /> Draw it
            </button>
          </div>
          <div className="modal-tabs-pen">
            <span className="modal-pen-label">Ink:</span>
            <PenColorPicker value={penColor} onChange={setPenColor} compact />
          </div>
        </div>

        <div className="modal-body">
          {tab === 'upload' && (
            <div className="upload-layout">
              <div className="upload-left">
                {!raw ? (
                  <label
                    className="upload-zone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const file = event.dataTransfer.files?.[0];
                      if (file) void loadFile(file);
                    }}
                  >
                    <ImagePlus size={28} />
                    <strong>Drop a signature photo here</strong>
                    <span>or click to choose a file</span>
                    <small>Plain paper, dark ink, even light works best.</small>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void loadFile(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                ) : (
                  <div className="upload-preview-wrap">
                    <div className="checkerboard upload-preview">
                      {busy && (
                        <div className="preview-busy">
                          <Loader2 size={20} className="spin" /> Removing background…
                        </div>
                      )}
                      {(showOriginal ? originalUrl : previewUrl) ? (
                        <img
                          src={(showOriginal ? originalUrl : previewUrl) ?? ''}
                          alt="Signature preview"
                        />
                      ) : (
                        !busy && <span className="preview-empty">No preview</span>
                      )}
                    </div>
                    <div className="preview-actions">
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() => setShowOriginal((value) => !value)}
                        disabled={busy || !previewUrl}
                      >
                        {showOriginal ? 'Show cleaned' : 'Show original'}
                      </button>
                      <button className="btn btn-ghost btn-small" onClick={() => fileRef.current?.click()}>
                        Choose another
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void loadFile(file);
                          event.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                )}
                {error && <div className="inline-error">{error}</div>}
              </div>

              <div className="upload-controls">
                <div className="control-head">
                  <span>Background removal</span>
                  <button
                    className="link-btn"
                    onClick={() => setOptions(DEFAULT_OPTIONS)}
                    disabled={!raw}
                  >
                    Reset
                  </button>
                </div>
                <label className="slider-field">
                  <span>
                    Sensitivity <b>{options.strength}%</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={options.strength}
                    disabled={!raw}
                    onChange={(event) =>
                      setOptions((o) => ({ ...o, strength: Number(event.target.value) }))
                    }
                  />
                  <small>Higher picks up lighter pencil strokes.</small>
                </label>
                <label className="slider-field">
                  <span>
                    Contrast <b>{options.contrast}%</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={options.contrast}
                    disabled={!raw}
                    onChange={(event) =>
                      setOptions((o) => ({ ...o, contrast: Number(event.target.value) }))
                    }
                  />
                  <small>Makes the ink more solid and the paper clean.</small>
                </label>
                <label className="slider-field">
                  <span>
                    Edge softness <b>{options.feather}</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    value={options.feather}
                    disabled={!raw}
                    onChange={(event) =>
                      setOptions((o) => ({ ...o, feather: Number(event.target.value) }))
                    }
                  />
                  <small>Softens jagged edges without blurring the signature.</small>
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={options.keepColor}
                    disabled={!raw}
                    onChange={(event) =>
                      setOptions((o) => ({ ...o, keepColor: event.target.checked }))
                    }
                  />
                  Keep the original ink colour
                </label>
                <div className="control-note">
                  Everything runs on this device. Photos are never uploaded.
                </div>
              </div>
            </div>
          )}

          <div className={tab === 'draw' ? '' : 'draw-hidden'}>
            <DrawPad onChange={handleDrawChange} penColor={penColor} />
          </div>
        </div>

        <footer className="modal-foot">
          <label className="name-field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              maxLength={48}
              onChange={(event) => setName(event.target.value)}
              placeholder="My signature"
            />
          </label>
          <label className="check-row save-row">
            <input type="checkbox" checked={save} onChange={(event) => setSave(event.target.checked)} />
            Save to library
          </label>
          <div className="modal-foot-actions">
            <button className="btn btn-ghost" onClick={close}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void useSignature()} disabled={!canUse || using}>
              {using ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              Use signature
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
