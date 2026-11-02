import { useEffect, useRef, useState } from 'react';
import { ImageOff, MousePointer2, Pencil, PenLine, Plus, Trash2, Type } from 'lucide-react';
import type { RenderTask } from 'pdfjs-dist';
import { startPageRender } from '../lib/pdfEngine';
import {
  deleteSignatureFromLibrary,
  loadSignatures,
  renameSignatureInLibrary,
} from '../lib/library';
import { useAppStore } from '../lib/store';
import type { PageInfo, SignatureAsset, Tool } from '../lib/types';

const TOOLS: { id: Tool; label: string; hint: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', hint: 'V', icon: MousePointer2 },
  { id: 'signature', label: 'Signature', hint: 'S', icon: PenLine },
  { id: 'text', label: 'Handwriting', hint: 'T', icon: Type },
];

function PageThumbnail({ page, index }: { page: PageInfo; index: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | undefined;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = (124 * Math.min(2, window.devicePixelRatio || 1)) / page.width;
    setReady(false);
    (async () => {
      const render = await startPageRender(page.index, canvas, scale);
      if (cancelled) {
        render.task.promise.catch(() => undefined);
        render.task.cancel();
        return;
      }
      task = render.task;
      await render.task.promise;
      if (!cancelled) setReady(true);
    })().catch((err) => {
      if (!cancelled && (err as { name?: string })?.name !== 'RenderingCancelledException') {
        console.warn('Thumbnail render failed', err);
      }
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [page.index, page.width]);

  return (
    <div className={`page-thumb ${ready ? 'is-ready' : ''}`}>
      <canvas ref={canvasRef} />
      <span className="page-thumb-number">{index + 1}</span>
    </div>
  );
}

export default function Sidebar() {
  const pages = useAppStore((s) => s.pages);
  const currentPage = useAppStore((s) => s.currentPage);
  const docId = useAppStore((s) => s.docId);
  const tool = useAppStore((s) => s.tool);
  const pendingAssetId = useAppStore((s) => s.pendingAssetId);
  const setTool = useAppStore((s) => s.setTool);
  const setPage = useAppStore((s) => s.setPage);
  const addAsset = useAppStore((s) => s.addAsset);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const openSignatureModal = useAppStore((s) => s.openSignatureModal);
  const showToast = useAppStore((s) => s.showToast);

  const [library, setLibrary] = useState<SignatureAsset[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const items = await loadSignatures();
      if (!cancelled) {
        setLibrary(items);
        setLibraryLoaded(true);
      }
    };
    void refresh();
    window.addEventListener('pdfsign:library', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('pdfsign:library', refresh);
    };
  }, []);

  const placeSignature = (asset: SignatureAsset) => {
    addAsset(asset);
    beginPlacing(asset.id);
    showToast('Click on the page to place the signature.', 'info');
  };

  const rename = async (asset: SignatureAsset) => {
    const next = window.prompt('Signature name', asset.name);
    if (!next || next.trim() === asset.name) return;
    const items = await renameSignatureInLibrary(asset.id, next.trim());
    setLibrary(items);
  };

  const remove = async (asset: SignatureAsset) => {
    if (!window.confirm(`Delete "${asset.name}" from the signature library?`)) return;
    const items = await deleteSignatureFromLibrary(asset.id);
    setLibrary(items);
    showToast('Signature removed from the library.', 'info');
  };

  return (
    <aside className="sidebar">
      <section className="panel-section tools-section">
        <div className="section-title">Tools</div>
        <div className="tool-list">
          {TOOLS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`tool-btn ${tool === item.id ? 'active' : ''}`}
                onClick={() => {
                  if (item.id === 'signature') {
                    setTool('signature');
                  } else {
                    setTool(item.id);
                  }
                }}
              >
                <span className="tool-icon">
                  <Icon size={17} />
                </span>
                <span className="tool-label">{item.label}</span>
                <kbd>{item.hint}</kbd>
              </button>
            );
          })}
        </div>
        {tool === 'signature' && (
          <p className="section-hint">
            {pendingAssetId
              ? 'Now click anywhere on the page to place it.'
              : 'Pick a saved signature below, or create a new one.'}
          </p>
        )}
      </section>

      <section className="panel-section signatures-section">
        <div className="section-title-row">
          <div className="section-title">My signatures</div>
          <button className="mini-btn" onClick={openSignatureModal} title="New signature">
            <Plus size={14} />
            New
          </button>
        </div>

        <div className="signature-list">
          {library.map((asset) => (
            <div
              key={asset.id}
              className={`signature-card ${pendingAssetId === asset.id ? 'is-armed' : ''}`}
              onClick={() => placeSignature(asset)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') placeSignature(asset);
              }}
            >
              <div className="signature-thumb">
                <img src={asset.dataUrl} alt={asset.name} draggable={false} />
              </div>
              <div className="signature-meta">
                <span className="signature-name">{asset.name}</span>
                <span className="signature-dim">
                  {asset.width} × {asset.height}px
                </span>
              </div>
              <div className="signature-actions">
                <button
                  className="mini-icon"
                  title="Rename"
                  onClick={(event) => {
                    event.stopPropagation();
                    void rename(asset);
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="mini-icon danger"
                  title="Delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    void remove(asset);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {libraryLoaded && library.length === 0 && (
            <div className="empty-library">
              <ImageOff size={18} />
              <p>No saved signatures yet.</p>
              <button className="btn btn-small" onClick={openSignatureModal}>
                <Plus size={14} /> Create one
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="panel-section pages-section">
        <div className="section-title-row">
          <div className="section-title">Pages</div>
          {pages.length > 0 && <span className="section-count">{pages.length}</span>}
        </div>
        <div className="pages-list">
          {pages.map((page, index) => (
            <button
              key={`${docId}-${page.index}`}
              className={`page-thumb-btn ${currentPage === index ? 'active' : ''}`}
              onClick={() => setPage(index)}
              title={`Page ${index + 1}`}
            >
              <PageThumbnail page={page} index={index} />
              <span className="page-label">Page {index + 1}</span>
            </button>
          ))}
          {!pages.length && <p className="section-hint">Open a PDF to see its pages.</p>}
        </div>
      </section>
    </aside>
  );
}
