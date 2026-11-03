import { useRef } from 'react';
import {
  Download,
  DownloadCloud,
  FolderOpen,
  Loader2,
  PenLine,
  Redo2,
  Undo2,
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { getPdfBytes } from '../lib/pdfEngine';
import { buildSignedPdf } from '../lib/exportPdf';
import { openPdfFile } from '../lib/openFile';
import PenColorPicker from './PenColorPicker';
import { usePwa } from '../lib/usePwa';

export default function Toolbar() {
  const { canInstall, promptInstall } = usePwa();
  const fileName = useAppStore((s) => s.fileName);
  const baseName = useAppStore((s) => s.baseName);
  const pages = useAppStore((s) => s.pages);
  const placements = useAppStore((s) => s.placements);
  const assets = useAppStore((s) => s.assets);
  const history = useAppStore((s) => s.history);
  const future = useAppStore((s) => s.future);
  const exporting = useAppStore((s) => s.exporting);
  const loadingPdf = useAppStore((s) => s.loadingPdf);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const showToast = useAppStore((s) => s.showToast);
  const setExporting = useAppStore((s) => s.setExporting);
  const selectedId = useAppStore((s) => s.selectedId);
  const penColor = useAppStore((s) => s.penColor);
  const setPenColor = useAppStore((s) => s.setPenColor);

  const selectedPlacement = placements.find((p) => p.id === selectedId);
  const activePenColor = selectedPlacement?.color || penColor;

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    await openPdfFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDownload = async () => {
    if (!pages.length) return;
    const bytes = getPdfBytes();
    if (!bytes) {
      showToast('The PDF could not be read. Try opening it again.', 'error');
      return;
    }
    if (placements.length === 0) {
      showToast('Add a signature or some text before downloading.', 'info');
      return;
    }
    setExporting(true);
    try {
      const signed = await buildSignedPdf({ bytes, pages, placements, assets });
      const blob = new Blob([new Uint8Array(signed)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName || 'document'}-signed.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast('Signed PDF downloaded.', 'success');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Could not create the signed PDF.';
      showToast(message, 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <PenLine size={18} strokeWidth={2.2} />
        </span>
        <span className="brand-name">pdfsign</span>
      </div>

      <div className="topbar-file">
        {fileName ? (
          <>
            <span className="file-dot" />
            <span className="file-name" title={fileName}>
              {fileName}
            </span>
            <span className="file-pages">
              {pages.length} {pages.length === 1 ? 'page' : 'pages'}
            </span>
          </>
        ) : (
          <span className="file-empty">No PDF open</span>
        )}
      </div>

      <div className="topbar-actions">
        <div className="btn-group">
          <button
            className="icon-btn"
            onClick={undo}
            disabled={!history.length}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={redo}
            disabled={!future.length}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={17} />
          </button>
        </div>

        <div className="pen-toolbar-group" title="Pen colour">
          <span className="pen-toolbar-label">Pen</span>
          <PenColorPicker value={activePenColor} onChange={setPenColor} compact />
        </div>

        {canInstall && (
          <button
            className="btn btn-ghost btn-install-pwa"
            onClick={promptInstall}
            title="Install PDFSign on your device"
          >
            <DownloadCloud size={16} />
            <span>Install App</span>
          </button>
        )}

        <button className="btn btn-ghost" onClick={() => inputRef.current?.click()}>
          {loadingPdf ? <Loader2 size={16} className="spin" /> : <FolderOpen size={16} />}
          <span>Open PDF</span>
        </button>

        <button
          className="btn btn-primary"
          onClick={handleDownload}
          disabled={!pages.length || exporting || !placements.length}
          title="Download the signed PDF"
        >
          {exporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
          <span>{exporting ? 'Saving…' : 'Download PDF'}</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </header>
  );
}
