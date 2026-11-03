# PDFSign

A modern, fast, private, and 100% client-side PDF signing and annotation tool built with React, Vite, PDF.js, and PDF-Lib.

No server uploads, no logins, no telemetry — your documents never leave your browser.

---

## ✨ Features

- ✍️ **Natural Signatures**: Draw smoothly using pressure-sensitive freehand strokes, type your name in elegant script fonts, or upload signature image files with automatic background removal.
- 🖊️ **Authentic Pen Colors**: Realistic ballpoint & gel pen tones:
  - ⬛ Black (`#18181b`)
  - 🟦 Royal Blue (`#1d4ed8`)
  - 🟥 Crimson Red (`#dc2626`)
  - 🟩 Forest Green (`#15803d`)
  - Colors are configurable individually per signature, date, or text block.
- 🔍 **Stroke Thickness Adjustment**: Adjust signature line thickness from delicate/slender (`-3`) to bold/heavy (`+3`) with real-time preview and exact rendering in exported PDFs.
- 📅 **Date Stamps**: Insert dates with one click in common formats (`DD/MM/YYYY`, `DD MMM YYYY`, `YYYY-MM-DD`, etc.).
- 📝 **Insert Text (Fine Handwriting & Standard Print)**: Add annotations, form entries, or signature names. Choose from 10 delicate, non-bold handwriting scripts or standard document print fonts (Standard Sans, Serif, and Monospace) with instant visual previews.
- 🔒 **100% Client-Side & Private**: All rendering and PDF generation happens directly in your browser.
- 📱 **Responsive & Accessible**: Works on desktop, tablets, and mobile devices with keyboard navigation and light/dark theme support.
- 📱 **Progressive Web App (PWA)**: Installable directly from Cloudflare Pages on Chrome, Edge, Safari (iOS), and Android with offline caching and native window controls.
- 🖥️ **Local Desktop Shortcut & Auto-Stop Server**: Includes a Linux `.desktop` launcher that starts the server, opens a standalone chromeless app window, and automatically terminates the server the instant the GUI window is closed.
- ⚡ **Optimized for Cloudflare Pages**: Ready for zero-config Git deployments on Cloudflare Pages.

---

## 🖥️ Local Desktop App (Clickable Launcher)

To run PDFSign as a standalone local desktop application with automatic server lifecycle management:

```bash
# Copy the desktop launcher to your Desktop
cp PDFSign.desktop ~/Desktop/
chmod +x ~/Desktop/PDFSign.desktop
```
*(On GNOME / Ubuntu desktops, right-click `PDFSign.desktop` on your desktop and select **"Allow Launching"**).*

- **How it works**:
  - Clicking the shortcut starts an ultra-fast local server and opens PDFSign in a chromeless app window.
  - When you close the app window (clicking the `X` button), the local server detects the window close via heartbeat/beacon and **automatically terminates**. No leftover background processes or stuck ports!

---

## 📱 Progressive Web App (PWA)

When deployed to Cloudflare Pages (or running over HTTPS):
- An **"Install App"** button appears in the toolbar on Chromium browsers and mobile.
- Users can install PDFSign to their home screen or app launcher.
- Full offline caching is enabled via Service Worker (`sw.js`).

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- npm or pnpm

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Run Tests
```bash
npm test
```

### Production Build
```bash
npm run build
```
The output will be generated in `dist/`.

---

## ☁️ Deploy to Cloudflare Pages

This repository is pre-configured for Cloudflare Pages:
- Native SPA routing and offline Service Worker
- Performance, security, and caching headers via `public/_headers`
- Node 20 runtime pinned via `.node-version`
- Automatic PDF.js worker asset copying on `prebuild`

### Deployment Steps:
1. Push this repository to GitHub.
2. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select your repository.
4. Configure build settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Click **Save and Deploy**.

---

## 📄 License
MIT
