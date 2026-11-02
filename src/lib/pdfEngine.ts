import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PageInfo, PdfMeta } from './types';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`;

let documentProxy: PDFDocumentProxy | null = null;
let loadingTaskRef: PDFDocumentLoadingTask | null = null;
let pdfBytes: Uint8Array | null = null;
let pdfName = '';
let pdfBaseName = '';

export function getPdfDocument(): PDFDocumentProxy | null {
  return documentProxy;
}

export function getPdfBytes(): Uint8Array | null {
  return pdfBytes;
}

export function getPdfBaseName(): string {
  return pdfBaseName;
}

export function getPdfName(): string {
  return pdfName;
}

export async function openPdf(file: File): Promise<PdfMeta> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const bytesForPdfLib = buffer.slice();
  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    cMapUrl: `${ASSET_BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
    wasmUrl: `${ASSET_BASE}wasm/`,
    iccUrl: `${ASSET_BASE}iccs/`,
  });

  let doc: PDFDocumentProxy;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === 'PasswordException') {
      throw new Error('This PDF is password-protected. Locked PDFs are not supported yet.');
    }
    throw new Error('Could not open this PDF. The file may be corrupt.');
  }

  if (loadingTaskRef) {
    await loadingTaskRef.destroy().catch(() => undefined);
  }
  loadingTaskRef = loadingTask;
  documentProxy = doc;
  pdfBytes = bytesForPdfLib;
  pdfName = file.name;
  pdfBaseName = file.name.replace(/\.pdf$/i, '') || 'document';

  const pages: PageInfo[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({
      index: i - 1,
      width: viewport.width,
      height: viewport.height,
      rotation: ((page.rotate % 360) + 360) % 360,
      transform: [...viewport.transform] as PageInfo['transform'],
    });
  }

  return { fileName: pdfName, baseName: pdfBaseName, pages, bytes: bytesForPdfLib };
}

export interface PageRender {
  task: RenderTask;
  width: number;
  height: number;
}

export async function startPageRender(
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<PageRender> {
  if (!documentProxy) throw new Error('No PDF is open');
  const page = await documentProxy.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is not available');

  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const task = page.render({ canvasContext: ctx, canvas, viewport });
  return { task, width: viewport.width, height: viewport.height };
}

export async function renderPage(
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<PageRender> {
  const render = await startPageRender(pageIndex, canvas, scale);
  await render.task.promise;
  return render;
}

export async function closePdf(): Promise<void> {
  if (loadingTaskRef) {
    await loadingTaskRef.destroy().catch(() => undefined);
    loadingTaskRef = null;
    documentProxy = null;
  }
  pdfBytes = null;
  pdfName = '';
  pdfBaseName = '';
}
