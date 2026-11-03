import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileUp,
  Loader2,
  Maximize2,
  Minus,
  Plus,
} from 'lucide-react';
import type { RenderTask } from 'pdfjs-dist';
import { useAppStore } from '../lib/store';
import { startPageRender } from '../lib/pdfEngine';
import { fitScale } from '../lib/coords';
import { openPdfFile } from '../lib/openFile';
import PlacedItem from './PlacedItem';

export default function PdfStage() {
  const pages = useAppStore((s) => s.pages);
  const currentPage = useAppStore((s) => s.currentPage);
  const zoom = useAppStore((s) => s.zoom);
  const fitRequest = useAppStore((s) => s.fitRequest);
  const docId = useAppStore((s) => s.docId);
  const placements = useAppStore((s) => s.placements);
  const assets = useAppStore((s) => s.assets);
  const selectedId = useAppStore((s) => s.selectedId);
  const pendingAssetId = useAppStore((s) => s.pendingAssetId);
  const pendingDate = useAppStore((s) => s.pendingDate);
  const tool = useAppStore((s) => s.tool);
  const setZoom = useAppStore((s) => s.setZoom);
  const setPage = useAppStore((s) => s.setPage);
  const requestFit = useAppStore((s) => s.requestFit);
  const select = useAppStore((s) => s.select);
  const addSignatureAt = useAppStore((s) => s.addSignatureAt);
  const addTextAt = useAppStore((s) => s.addTextAt);
  const addDateAt = useAppStore((s) => s.addDateAt);
  const showToast = useAppStore((s) => s.showToast);
  const loadingPdf = useAppStore((s) => s.loadingPdf);

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(false);
  const page = pages[currentPage ?? 0];

  useEffect(() => {
    if (!pages.length) return;
    const container = scrollRef.current;
    if (!container) return;
    const current = pages[currentPage];
    if (!current) return;
    const scale = fitScale(current, container.clientWidth, container.clientHeight, 120);
    setZoom(scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest, docId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTo({ top: 0, left: 0 });
  }, [currentPage]);

  useEffect(() => {
    if (!page) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    setRendering(true);

    (async () => {
      const render = await startPageRender(page.index, canvas, zoom * dpr);
      if (cancelled) {
        render.task.promise.catch(() => undefined);
        render.task.cancel();
        return;
      }
      task = render.task;
      await render.task.promise;
      if (!cancelled) setRendering(false);
    })().catch((err) => {
      if (!cancelled && (err as { name?: string })?.name !== 'RenderingCancelledException') {
        console.warn('Page render failed', err);
        setRendering(false);
      }
    });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [page, zoom]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const state = useAppStore.getState();
      state.setZoom(state.zoom - event.deltaY * 0.0018);
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  if (!pages.length) {
    return (
      <main className="stage stage-empty">
        <div className="drop-card">
          <div className="drop-icon">
            {loadingPdf ? <Loader2 size={28} className="spin" /> : <FileUp size={28} />}
          </div>
          <h2>Open a PDF to sign</h2>
          <p>Drag a PDF here, or pick one from your computer. Everything stays on this machine.</p>
          <label className="btn btn-primary btn-large">
            <FileUp size={17} />
            <span>Choose PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void openPdfFile(file);
                event.target.value = '';
              }}
            />
          </label>
          <div className="privacy-note">Local only · no uploads · no account</div>
        </div>
      </main>
    );
  }

  if (!page) return null;

  const pageItems = placements.filter((p) => p.pageIndex === page.index);
  const cursorClass = pendingAssetId || pendingDate
    ? 'is-placing'
    : tool === 'text'
      ? 'is-text-tool'
      : '';

  const onOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const px = (event.clientX - rect.left) / zoom;
    const py = (event.clientY - rect.top) / zoom;

    if (pendingAssetId) {
      addSignatureAt(pendingAssetId, page.index, px, py);
      showToast('Signature placed — drag it to adjust.', 'success');
      return;
    }
    if (pendingDate) {
      addDateAt(page.index, px, py, pendingDate);
      showToast('Date placed — drag it to adjust.', 'success');
      return;
    }
    if (tool === 'text') {
      addTextAt(page.index, px, py);
      showToast('Text added — type in the panel on the right.', 'success');
      return;
    }
    if (tool === 'signature') {
      showToast('Pick a signature from the left, or create a new one.', 'info');
      return;
    }
    select(null);
  };

  return (
    <main className="stage">
      <div className={`stage-scroll ${cursorClass}`} ref={scrollRef}>
        <div
          className="page-surface"
          style={{ width: page.width * zoom, height: page.height * zoom }}
        >
          <canvas
            ref={canvasRef}
            className="pdf-canvas"
            style={{ width: page.width * zoom, height: page.height * zoom }}
          />
          <div
            ref={overlayRef}
            className="overlay"
            onClick={onOverlayClick}
            style={{ width: page.width * zoom, height: page.height * zoom }}
          >
            {pageItems.map((item) => (
              <PlacedItem
                key={item.id}
                item={item}
                page={page}
                zoom={zoom}
                selected={selectedId === item.id}
                asset={item.type === 'signature' ? assets[item.assetId] : undefined}
              />
            ))}
          </div>
          {rendering && (
            <div className="render-badge">
              <Loader2 size={14} className="spin" /> Rendering
            </div>
          )}
        </div>
      </div>

      <div className="stage-toolbar">
        <div className="stage-toolbar-group">
          <button
            className="icon-btn"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage <= 0}
            title="Previous page"
          >
            <ChevronLeft size={17} />
          </button>
          <span className="page-indicator">
            <strong>{currentPage + 1}</strong> / {pages.length}
          </span>
          <button
            className="icon-btn"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= pages.length - 1}
            title="Next page"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <span className="toolbar-divider" />

        <div className="stage-toolbar-group">
          <button
            className="icon-btn"
            onClick={() => setZoom(zoom - 0.1)}
            disabled={zoom <= 0.2}
            title="Zoom out"
          >
            <Minus size={16} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            className="icon-btn"
            onClick={() => setZoom(zoom + 0.1)}
            disabled={zoom >= 3}
            title="Zoom in"
          >
            <Plus size={16} />
          </button>
          <button className="icon-btn" onClick={requestFit} title="Fit page">
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {pendingAssetId && (
        <div className="placing-banner">
          Click on the page to place your signature
          <kbd>Esc</kbd> to cancel
        </div>
      )}
      {pendingDate && (
        <div className="placing-banner">
          Click on the page to place the date
          <kbd>Esc</kbd> to cancel
        </div>
      )}
      {tool === 'text' && !pendingAssetId && !pendingDate && (
        <div className="placing-banner">Click on the page to insert text</div>
      )}
    </main>
  );
}
