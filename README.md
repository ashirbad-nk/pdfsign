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
- 📝 **Handwritten & Typed Text**: Add annotations in cursive, script, or clean print styles with customizable font sizes, letter spacing, and line spacing.
- 🔒 **100% Client-Side & Private**: All rendering and PDF generation happens directly in your browser.
- 📱 **Responsive & Accessible**: Works on desktop, tablets, and mobile devices with keyboard navigation and light/dark theme support.
- ⚡ **Optimized for Cloudflare Pages**: Ready for zero-config Git deployments on Cloudflare Pages.

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
- Static routing via `public/_redirects`
- Performance and caching headers via `public/_headers`
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
