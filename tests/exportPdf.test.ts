import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildSignedPdf } from '../src/lib/exportPdf';
import type { PageInfo, SignatureAsset, SignaturePlacement, TextPlacement } from '../src/lib/types';
import { PDFDocument } from 'pdf-lib';

describe('buildSignedPdf export', () => {
  const samplePdfPath = path.resolve(process.cwd(), 'tests/fixtures/sample.pdf');
  const sampleBytes = new Uint8Array(fs.readFileSync(samplePdfPath));
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      if (urlStr.includes('/fonts/')) {
        const fileName = urlStr.split('/fonts/')[1];
        const filePath = path.resolve(process.cwd(), 'public/fonts', fileName);
        const buffer = fs.readFileSync(filePath);
        return new Response(buffer);
      }
      return originalFetch(input, init);
    };
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  const pageInfo: PageInfo = {
    index: 0,
    width: 612,
    height: 792,
    rotation: 0,
    transform: [1, 0, 0, 1, 0, 0],
  };

  const sampleAsset: SignatureAsset = {
    id: 'sig-1',
    name: 'My signature',
    // 1x1 transparent PNG
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    width: 120,
    height: 60,
    createdAt: Date.now(),
  };

  it('successfully builds a signed PDF with signature and text matching pen colour', async () => {
    const sigItem: SignaturePlacement = {
      id: 'p-1',
      type: 'signature',
      assetId: 'sig-1',
      pageIndex: 0,
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      rotation: 0,
      opacity: 1,
      color: '#1d4ed8', // Blue pen
    };

    const textItem: TextPlacement = {
      id: 'p-2',
      type: 'text',
      text: '02/11/2026',
      fontId: 'caveat-brush',
      fontSize: 22,
      lineHeight: 28,
      pageIndex: 0,
      x: 100,
      y: 200,
      width: 120,
      height: 30,
      rotation: 0,
      opacity: 1,
      color: '#1d4ed8', // Blue pen matching signature
    };

    const outputBytes = await buildSignedPdf({
      bytes: sampleBytes,
      pages: [pageInfo],
      placements: [sigItem, textItem],
      assets: { 'sig-1': sampleAsset },
    });

    expect(outputBytes).toBeInstanceOf(Uint8Array);
    expect(outputBytes.length).toBeGreaterThan(0);

    // Verify it loads back as a valid PDF
    const loadedPdf = await PDFDocument.load(outputBytes);
    expect(loadedPdf.getPageCount()).toBeGreaterThan(0);
  });
});
