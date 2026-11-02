import { create } from 'zustand';
import { DEFAULT_FONT, measureTextBlock } from './fonts';
import type {
  DateFormat,
  PageInfo,
  PdfMeta,
  Placement,
  SignatureAsset,
  SignaturePlacement,
  TextPlacement,
  Tool,
} from './types';
import { DEFAULT_PEN_COLOR, formatDate } from './types';
import { clamp } from './coords';

interface Snapshot {
  placements: Placement[];
  selectedId: string | null;
}

interface ToastMessage {
  id: number;
  kind: 'info' | 'error' | 'success';
  message: string;
}

interface AppState {
  fileName: string | null;
  baseName: string;
  pages: PageInfo[];
  docId: number;
  currentPage: number;
  zoom: number;
  fitRequest: number;
  assets: Record<string, SignatureAsset>;
  placements: Placement[];
  selectedId: string | null;
  tool: Tool;
  pendingAssetId: string | null;
  pendingDate: DateFormat | null;
  signatureModalOpen: boolean;
  history: Snapshot[];
  future: Snapshot[];
  toast: ToastMessage | null;
  exporting: boolean;
  loadingPdf: boolean;
  focusText: number;
  penColor: string;

  setPdf: (meta: PdfMeta) => void;
  clearPdf: () => void;
  setPage: (index: number) => void;
  setZoom: (zoom: number) => void;
  requestFit: () => void;
  setTool: (tool: Tool) => void;
  setPenColor: (color: string) => void;
  addAsset: (asset: SignatureAsset) => void;
  beginPlacing: (assetId: string) => void;
  armDate: (format: DateFormat) => void;
  cancelPlacing: () => void;
  select: (id: string | null) => void;
  addSignatureAt: (assetId: string, pageIndex: number, px: number, py: number) => void;
  addTextAt: (pageIndex: number, px: number, py: number, text?: string) => void;
  addDateAt: (pageIndex: number, px: number, py: number, format: DateFormat) => void;
  updatePlacement: (id: string, patch: Partial<Placement>, recordHistory?: boolean) => void;
  removePlacement: (id: string) => void;
  duplicatePlacement: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  openSignatureModal: () => void;
  closeSignatureModal: () => void;
  showToast: (message: string, kind?: ToastMessage['kind']) => void;
  hideToast: () => void;
  setExporting: (exporting: boolean) => void;
  setLoadingPdf: (loading: boolean) => void;
  bumpFocusText: () => void;
}

const MAX_HISTORY = 60;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function snapshot(state: AppState): Snapshot {
  return {
    placements: structuredClone(state.placements),
    selectedId: state.selectedId,
  };
}

function uid(): string {
  return crypto.randomUUID();
}

export const useAppStore = create<AppState>((set, get) => ({
  fileName: null,
  baseName: '',
  pages: [],
  docId: 0,
  currentPage: 0,
  zoom: 1,
  fitRequest: 0,
  assets: {},
  placements: [],
  selectedId: null,
  tool: 'select',
  pendingAssetId: null,
  pendingDate: null,
  signatureModalOpen: false,
  history: [],
  future: [],
  toast: null,
  exporting: false,
  loadingPdf: false,
  focusText: 0,
  penColor: DEFAULT_PEN_COLOR,

  setPdf: (meta) =>
    set((state) => ({
      fileName: meta.fileName,
      baseName: meta.baseName,
      pages: meta.pages,
      docId: state.docId + 1,
      currentPage: 0,
      zoom: 1,
      fitRequest: state.fitRequest + 1,
      assets: {},
      placements: [],
      selectedId: null,
      tool: 'select',
      pendingAssetId: null,
      pendingDate: null,
      history: [],
      future: [],
    })),

  clearPdf: () =>
    set({
      fileName: null,
      baseName: '',
      pages: [],
      currentPage: 0,
      zoom: 1,
      assets: {},
      placements: [],
      selectedId: null,
      pendingAssetId: null,
      pendingDate: null,
      history: [],
      future: [],
      tool: 'select',
    }),

  setPage: (index) =>
    set((state) => {
      const page = clamp(index, 0, Math.max(0, state.pages.length - 1));
      const selected = state.placements.find((p) => p.id === state.selectedId);
      return {
        currentPage: page,
        selectedId: selected && selected.pageIndex === page ? state.selectedId : null,
      };
    }),

  setZoom: (zoom) => set({ zoom: clamp(zoom, 0.2, 3) }),
  requestFit: () => set((state) => ({ fitRequest: state.fitRequest + 1 })),

  setTool: (tool) =>
    set((state) => ({
      tool,
      pendingAssetId: tool === 'signature' ? state.pendingAssetId : null,
      selectedId: tool === 'select' ? state.selectedId : null,
    })),

  setPenColor: (color) => {
    const state = get();
    const current = state.penColor;
    if (state.selectedId) {
      const selected = state.placements.find((p) => p.id === state.selectedId);
      if (selected && selected.color === color && current === color) return;
      state.pushHistory();
      set((s) => ({
        penColor: color,
        placements: s.placements.map((p) =>
          p.id === s.selectedId ? { ...p, color } : p,
        ),
      }));
    } else {
      if (current === color) return;
      set({ penColor: color });
    }
  },

  addAsset: (asset) =>
    set((state) => ({ assets: { ...state.assets, [asset.id]: asset } })),

  beginPlacing: (assetId) =>
    set({ pendingAssetId: assetId, pendingDate: null, tool: 'signature', selectedId: null }),

  armDate: (format) =>
    set({ pendingDate: format, pendingAssetId: null, tool: 'select', selectedId: null }),

  cancelPlacing: () => set({ pendingAssetId: null, pendingDate: null, tool: 'select' }),

  select: (id) => set({ selectedId: id }),

  addSignatureAt: (assetId, pageIndex, px, py) => {
    const state = get();
    const page = state.pages[pageIndex];
    const asset = state.assets[assetId];
    if (!page || !asset) return;
    get().pushHistory();

    const aspect = asset.width / asset.height;
    let width = 150;
    let height = width / aspect;
    const maxHeight = Math.min(110, page.height * 0.22);
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }
    if (width > 240) {
      width = 240;
      height = width / aspect;
    }
    width = Math.max(24, width);
    height = Math.max(10, height);

    const item: SignaturePlacement = {
      id: uid(),
      type: 'signature',
      assetId,
      pageIndex,
      x: clamp(px - width / 2, 0, Math.max(0, page.width - width)),
      y: clamp(py - height / 2, 0, Math.max(0, page.height - height)),
      width,
      height,
      rotation: 0,
      opacity: 1,
      color: state.penColor,
    };
    set((s) => ({
      placements: [...s.placements, item],
      selectedId: item.id,
      pendingAssetId: null,
      pendingDate: null,
      tool: 'select',
    }));
  },

  addTextAt: (pageIndex, px, py, text = 'Your text') => {
    const state = get();
    const page = state.pages[pageIndex];
    if (!page) return;
    get().pushHistory();
    const fontSize = 18;
    const metrics = measureTextBlock(text, DEFAULT_FONT, fontSize);
    const item: TextPlacement = {
      id: uid(),
      type: 'text',
      pageIndex,
      text,
      fontId: DEFAULT_FONT,
      fontSize,
      lineHeight: metrics.lineHeight,
      color: state.penColor,
      x: clamp(px, 0, Math.max(0, page.width - metrics.width)),
      y: clamp(py, 0, Math.max(0, page.height - metrics.height)),
      width: metrics.width,
      height: metrics.height,
      rotation: 0,
      opacity: 1,
    };
    set((s) => ({
      placements: [...s.placements, item],
      selectedId: item.id,
      pendingDate: null,
      tool: 'select',
      focusText: s.focusText + 1,
    }));
  },

  addDateAt: (pageIndex, px, py, format) => {
    const state = get();
    const page = state.pages[pageIndex];
    if (!page) return;
    get().pushHistory();
    const text = formatDate(new Date(), format);
    const fontSize = 16;
    const fontId = DEFAULT_FONT;
    const metrics = measureTextBlock(text, fontId, fontSize);
    const item: TextPlacement = {
      id: uid(),
      type: 'text',
      pageIndex,
      text,
      fontId,
      fontSize,
      lineHeight: metrics.lineHeight,
      color: state.penColor,
      x: clamp(px - metrics.width / 2, 0, Math.max(0, page.width - metrics.width)),
      y: clamp(py - metrics.height / 2, 0, Math.max(0, page.height - metrics.height)),
      width: metrics.width,
      height: metrics.height,
      rotation: 0,
      opacity: 1,
    };
    set((s) => ({
      placements: [...s.placements, item],
      selectedId: item.id,
      pendingDate: null,
      tool: 'select',
    }));
  },

  updatePlacement: (id, patch, recordHistory = false) => {
    if (recordHistory) get().pushHistory();
    set((state) => {
      const index = state.placements.findIndex((p) => p.id === id);
      if (index < 0) return {};
      const current = state.placements[index];
      let merged = { ...current, ...patch } as Placement;

      if (
        merged.type === 'text' &&
        (patch.type === 'text' ||
          'text' in patch ||
          'fontId' in patch ||
          'fontSize' in patch)
      ) {
        const textItem = merged as TextPlacement;
        const metrics = measureTextBlock(textItem.text, textItem.fontId, textItem.fontSize);
        const cx = current.x + current.width / 2;
        const cy = current.y + current.height / 2;
        merged = {
          ...textItem,
          lineHeight: metrics.lineHeight,
          width: metrics.width,
          height: metrics.height,
          x: cx - metrics.width / 2,
          y: cy - metrics.height / 2,
        };
        const page = state.pages[merged.pageIndex];
        if (page) {
          merged.x = clamp(merged.x, 0, Math.max(0, page.width - merged.width));
          merged.y = clamp(merged.y, 0, Math.max(0, page.height - merged.height));
        }
      }

      const placements = [...state.placements];
      placements[index] = merged;
      return { placements };
    });
  },

  removePlacement: (id) => {
    get().pushHistory();
    set((state) => ({
      placements: state.placements.filter((p) => p.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));
  },

  duplicatePlacement: (id) => {
    const state = get();
    const item = state.placements.find((p) => p.id === id);
    const page = item ? state.pages[item.pageIndex] : null;
    if (!item || !page) return;
    get().pushHistory();
    const copy: Placement = {
      ...structuredClone(item),
      id: uid(),
      x: clamp(item.x + 14, 0, Math.max(0, page.width - item.width)),
      y: clamp(item.y + 14, 0, Math.max(0, page.height - item.height)),
    };
    set((s) => ({ placements: [...s.placements, copy], selectedId: copy.id }));
  },

  bringForward: (id) => {
    get().pushHistory();
    set((state) => {
      const index = state.placements.findIndex((p) => p.id === id);
      if (index < 0 || index === state.placements.length - 1) return {};
      const placements = [...state.placements];
      [placements[index], placements[index + 1]] = [placements[index + 1], placements[index]];
      return { placements };
    });
  },

  sendBackward: (id) => {
    get().pushHistory();
    set((state) => {
      const index = state.placements.findIndex((p) => p.id === id);
      if (index <= 0) return {};
      const placements = [...state.placements];
      [placements[index], placements[index - 1]] = [placements[index - 1], placements[index]];
      return { placements };
    });
  },

  bringToFront: (id) => {
    get().pushHistory();
    set((state) => {
      const item = state.placements.find((p) => p.id === id);
      if (!item) return {};
      return { placements: [...state.placements.filter((p) => p.id !== id), item] };
    });
  },

  sendToBack: (id) => {
    get().pushHistory();
    set((state) => {
      const item = state.placements.find((p) => p.id === id);
      if (!item) return {};
      return { placements: [item, ...state.placements.filter((p) => p.id !== id)] };
    });
  },

  pushHistory: () =>
    set((state) => ({
      history: [...state.history.slice(-(MAX_HISTORY - 1)), snapshot(state)],
      future: [],
    })),

  undo: () =>
    set((state) => {
      const previous = state.history[state.history.length - 1];
      if (!previous) return {};
      return {
        history: state.history.slice(0, -1),
        future: [snapshot(state), ...state.future],
        placements: structuredClone(previous.placements),
        selectedId: previous.selectedId,
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return {};
      return {
        future: state.future.slice(1),
        history: [...state.history, snapshot(state)],
        placements: structuredClone(next.placements),
        selectedId: next.selectedId,
      };
    }),

  openSignatureModal: () => set({ signatureModalOpen: true }),
  closeSignatureModal: () => set({ signatureModalOpen: false }),

  showToast: (message, kind = 'info') => {
    if (toastTimer) clearTimeout(toastTimer);
    const id = Date.now();
    set({ toast: { id, kind, message } });
    toastTimer = setTimeout(() => {
      set((state) => (state.toast?.id === id ? { toast: null } : {}));
    }, 3600);
  },

  hideToast: () => set({ toast: null }),
  setExporting: (exporting) => set({ exporting }),
  setLoadingPdf: (loadingPdf) => set({ loadingPdf }),
  bumpFocusText: () => set((state) => ({ focusText: state.focusText + 1 })),
}));
