import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA Manifest & Assets', () => {
  const rootDir = path.resolve(__dirname, '..');
  const manifestPath = path.join(rootDir, 'public', 'manifest.webmanifest');

  it('contains valid manifest.webmanifest file', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(content.name).toBe('PDFSign — Private PDF Signature & Annotation');
    expect(content.short_name).toBe('PDFSign');
    expect(content.display).toBe('standalone');
    expect(content.start_url).toBe('/');
    expect(Array.isArray(content.icons)).toBe(true);
    expect(content.icons.length).toBeGreaterThanOrEqual(4);
  });

  it('has all referenced icon files present in public/icons', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const icon of manifest.icons) {
      const iconFile = path.join(rootDir, 'public', icon.src.replace(/^\//, ''));
      expect(fs.existsSync(iconFile), `Missing icon file: ${icon.src}`).toBe(true);
    }
  });

  it('contains a functional service worker sw.js in public/', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js');
    expect(fs.existsSync(swPath)).toBe(true);
    const swContent = fs.readFileSync(swPath, 'utf8');
    expect(swContent).toContain('addEventListener(\'install\'');
    expect(swContent).toContain('addEventListener(\'activate\'');
    expect(swContent).toContain('addEventListener(\'fetch\'');
  });

  it('has Desktop entry and launcher script configured', () => {
    const desktopEntryPath = path.join(rootDir, 'PDFSign.desktop');
    const launchScriptPath = path.join(rootDir, 'scripts', 'launch-pdfsign.sh');
    const serverScriptPath = path.join(rootDir, 'scripts', 'desktop-server.mjs');

    expect(fs.existsSync(desktopEntryPath)).toBe(true);
    expect(fs.existsSync(launchScriptPath)).toBe(true);
    expect(fs.existsSync(serverScriptPath)).toBe(true);

    const desktopContent = fs.readFileSync(desktopEntryPath, 'utf8');
    expect(desktopContent).toContain('Exec=');
    expect(desktopContent).toContain('launch-pdfsign.sh');
    expect(desktopContent).toContain('Icon=');
    expect(desktopContent).toContain('icon-512.png');
  });
});
