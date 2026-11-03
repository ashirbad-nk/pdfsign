#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';
import net from 'node:net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

// Ensure dist/ is built
if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.log('[pdfsign] Building production bundle for desktop app...');
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
}

// Ensure desktop entry and icons are installed in ~/.local/share
function ensureDesktopEntry() {
  try {
    const installScript = path.join(__dirname, 'install-desktop.py');
    if (fs.existsSync(installScript)) {
      execSync(`python3 "${installScript}" 2>/dev/null || true`);
    }
  } catch {
    // ignore
  }
}

// MIME types lookup
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

// Check if a port is available
function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort = 5174) {
  for (let port = startPort; port < startPort + 50; port++) {
    if (await checkPortAvailable(port)) {
      return port;
    }
  }
  throw new Error('No available port found');
}

// Lifecycle state
let lastHeartbeat = Date.now();
let hasConnected = false;
let shutdownTimeout = null;
let serverInstance = null;
let browserProcess = null;

function stopServer(reason = 'Normal shutdown') {
  console.log(`[pdfsign] ${reason}. Stopping server...`);
  if (shutdownTimeout) clearTimeout(shutdownTimeout);
  if (browserProcess && !browserProcess.killed) {
    try {
      browserProcess.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  if (serverInstance) {
    serverInstance.close(() => {
      process.exit(0);
    });
    // Force exit after 1s if connections linger
    setTimeout(() => process.exit(0), 1000);
  } else {
    process.exit(0);
  }
}

// Start HTTP Server
async function start() {
  ensureDesktopEntry();
  const port = await findAvailablePort(5174);
  const appUrl = `http://127.0.0.1:${port}`;

  serverInstance = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    // Heartbeat endpoint
    if (pathname === '/api/heartbeat') {
      lastHeartbeat = Date.now();
      hasConnected = true;
      if (shutdownTimeout) {
        clearTimeout(shutdownTimeout);
        shutdownTimeout = null;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
      return;
    }

    // Shutdown signal from beforeunload / pagehide beacon
    if (pathname === '/api/shutdown') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'shutting_down' }));

      // Give 1.5s grace period: if user simply refreshed the page, the new page's heartbeat will cancel this
      if (!shutdownTimeout) {
        shutdownTimeout = setTimeout(() => {
          stopServer('Window closed (shutdown beacon received)');
        }, 1500);
      }
      return;
    }

    // Static file serving from dist/
    let filePath = path.join(DIST_DIR, pathname);

    // If path is root or has no extension, serve index.html (SPA routing)
    if (pathname === '/' || !path.extname(pathname)) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    // If file doesn't exist, check public folder fallback or fallback to index.html
    if (!fs.existsSync(filePath)) {
      const publicPath = path.join(ROOT_DIR, 'public', pathname);
      if (fs.existsSync(publicPath)) {
        filePath = publicPath;
      } else {
        filePath = path.join(DIST_DIR, 'index.html');
      }
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const headers = {
        'Content-Type': contentType,
        'Content-Length': stats.size,
      };

      if (ext === '.html' || pathname === '/sw.js' || pathname === '/manifest.webmanifest') {
        headers['Cache-Control'] = 'no-cache';
      } else {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      }

      res.writeHead(200, headers);
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  });

  serverInstance.listen(port, '127.0.0.1', () => {
    console.log(`[pdfsign] Server running locally at ${appUrl}`);
    launchBrowser(appUrl);
  });

  // Watchdog timer: checks every 1s
  setInterval(() => {
    const elapsed = Date.now() - lastHeartbeat;

    if (!hasConnected) {
      // 20-second initial grace period while browser launches
      if (elapsed > 20000) {
        stopServer('No browser window connected within initial 20s');
      }
    } else {
      // Once connected, if heartbeats stop for > 4.5 seconds, window was closed
      if (elapsed > 4500) {
        stopServer('App window closed (heartbeat lost)');
      }
    }
  }, 1000);

  // Clean signal handling
  process.on('SIGINT', () => stopServer('SIGINT received'));
  process.on('SIGTERM', () => stopServer('SIGTERM received'));
  process.on('SIGHUP', () => stopServer('SIGHUP received'));
}

// Find and launch browser in App mode
function launchBrowser(url) {
  const profileDir = path.join('/tmp', 'pdfsign-desktop-profile');
  try {
    const defaultDir = path.join(profileDir, 'Default');
    fs.mkdirSync(defaultDir, { recursive: true });
    const prefPath = path.join(defaultDir, 'Preferences');
    let prefs = {};
    if (fs.existsSync(prefPath)) {
      try {
        prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
      } catch {
        // ignore
      }
    }
    prefs.browser = prefs.browser || {};
    prefs.browser.window_placement = {
      bottom: 1080,
      left: 0,
      maximized: true,
      right: 1920,
      top: 0,
      work_area_bottom: 1040,
      work_area_left: 0,
      work_area_right: 1920,
      work_area_top: 0,
    };
    fs.writeFileSync(prefPath, JSON.stringify(prefs));
  } catch {
    // ignore
  }

  const commonArgs = [
    `--app=${url}`,
    `--user-data-dir=${profileDir}`,
    '--class=pdfsign',
    '--name=pdfsign',
    '--app-id=pdfsign',
    '--start-maximized',
    '--window-size=1920,1080',
    '--window-position=0,0',
  ];

  // Detect browsers
  const candidates = [
    // Flatpak Brave
    {
      check: 'flatpak info com.brave.Browser',
      cmd: 'flatpak',
      args: ['run', 'com.brave.Browser', ...commonArgs],
    },
    // Flatpak Chrome
    {
      check: 'flatpak info com.google.Chrome',
      cmd: 'flatpak',
      args: ['run', 'com.google.Chrome', ...commonArgs],
    },
    // Native Brave
    {
      check: 'which brave-browser',
      cmd: 'brave-browser',
      args: commonArgs,
    },
    // Native Google Chrome
    {
      check: 'which google-chrome',
      cmd: 'google-chrome',
      args: commonArgs,
    },
    // Native Chromium
    {
      check: 'which chromium',
      cmd: 'chromium',
      args: commonArgs,
    },
    // Firefox
    {
      check: 'which firefox',
      cmd: 'firefox',
      args: ['--new-window', url],
    },
    // Fallback: xdg-open
    {
      check: 'which xdg-open',
      cmd: 'xdg-open',
      args: [url],
    },
  ];

  let selected = null;
  for (const c of candidates) {
    try {
      execSync(c.check, { stdio: 'ignore' });
      selected = c;
      break;
    } catch {
      continue;
    }
  }

  if (!selected) {
    console.log(`[pdfsign] Please open your browser at: ${url}`);
    return;
  }

  console.log(`[pdfsign] Launching ${selected.cmd} in app mode...`);
  browserProcess = spawn(selected.cmd, selected.args, {
    detached: false,
    stdio: 'ignore',
  });

  // Apply window maximization and icon without delay
  const applyWindowProps = () => {
    try {
      execSync('wmctrl -r "pdfsign" -b add,maximized_vert,maximized_horz 2>/dev/null || true');
      execSync(`python3 "${path.join(__dirname, 'set-window-icon.py')}" 2>/dev/null || true`);
    } catch {
      // ignore
    }
  };

  setTimeout(applyWindowProps, 250);
  setTimeout(applyWindowProps, 600);
  setTimeout(applyWindowProps, 1200);
  setTimeout(applyWindowProps, 2500);

  browserProcess.on('exit', (code) => {
    // If the process exits, wait briefly to see if heartbeats continue (in case browser handed off to existing instance)
    setTimeout(() => {
      if (Date.now() - lastHeartbeat > 2500) {
        stopServer('Browser process terminated');
      }
    }, 1000);
  });

  browserProcess.on('error', (err) => {
    console.warn('[pdfsign] Browser spawn error, falling back to xdg-open:', err.message);
    try {
      spawn('xdg-open', [url], { stdio: 'ignore' });
    } catch {
      // ignore
    }
  });
}

start().catch((err) => {
  console.error('[pdfsign] Fatal server error:', err);
  process.exit(1);
});
