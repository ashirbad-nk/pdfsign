import { useEffect, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import PdfStage from './components/PdfStage';
import Inspector from './components/Inspector';
import SignatureDialog from './components/SignatureDialog';
import Toast from './components/Toast';
import { ensureFontsLoaded } from './lib/fonts';
import { useAppStore } from './lib/store';
import { openPdfFile } from './lib/openFile';
import { clamp } from './lib/coords';

export default function App() {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    void ensureFontsLoaded();
  }, []);

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      if (useAppStore.getState().signatureModalOpen) return;
      if ((event.target as HTMLElement | null)?.closest('.signature-modal')) return;
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      dragDepth.current = 0;
      setDragging(false);
      if ((event.target as HTMLElement | null)?.closest('.signature-modal')) return;
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      event.preventDefault();
      void openPdfFile(file);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useAppStore.getState();
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const editing =
        tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(target?.isContentEditable);
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        state.redo();
        return;
      }
      if (event.key === 'Escape') {
        if (state.signatureModalOpen) {
          state.closeSignatureModal();
        } else if (state.pendingAssetId || state.pendingDate) {
          state.cancelPlacing();
        } else if (state.selectedId) {
          state.select(null);
        }
        return;
      }
      if (editing) return;

      const selected = state.placements.find((p) => p.id === state.selectedId);
      const page = selected ? state.pages[selected.pageIndex] : null;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!selected) return;
        event.preventDefault();
        state.removePlacement(selected.id);
        return;
      }

      if (mod && event.key.toLowerCase() === 'd') {
        if (!selected) return;
        event.preventDefault();
        state.duplicatePlacement(selected.id);
        return;
      }

      if (
        selected &&
        page &&
        (event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight' ||
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown')
      ) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (event.key === 'ArrowLeft') dx = -step;
        if (event.key === 'ArrowRight') dx = step;
        if (event.key === 'ArrowUp') dy = -step;
        if (event.key === 'ArrowDown') dy = step;
        state.pushHistory();
        state.updatePlacement(selected.id, {
          x: clamp(selected.x + dx, 0, Math.max(0, page.width - selected.width)),
          y: clamp(selected.y + dy, 0, Math.max(0, page.height - selected.height)),
        });
        return;
      }

      if (event.key === 'v' || event.key === 'V') {
        state.setTool('select');
      } else if (event.key === 's' || event.key === 'S') {
        state.setTool('signature');
      } else if (event.key === 't' || event.key === 'T') {
        state.setTool('text');
      } else if (event.key === '+' || event.key === '=') {
        state.setZoom(state.zoom + 0.1);
      } else if (event.key === '-' || event.key === '_') {
        state.setZoom(state.zoom - 0.1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <Toolbar />
      <div className="workspace">
        <Sidebar />
        <PdfStage />
        <Inspector />
      </div>
      <SignatureDialog />
      <Toast />
      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-card">
            <FileUp size={30} />
            <strong>Drop your PDF to open it</strong>
            <span>It stays completely local.</span>
          </div>
        </div>
      )}
    </div>
  );
}
