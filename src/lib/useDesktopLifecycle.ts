import { useEffect } from 'react';

/**
 * When running as a local desktop app via scripts/desktop-server.mjs,
 * this hook periodically pings /api/heartbeat and sends /api/shutdown on window close
 * so the local node server automatically shuts down when the GUI window is closed.
 */
export function useDesktopLifecycle() {
  useEffect(() => {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (!isLocalhost) return;

    // Open in window fullscreen / maximized by default in local desktop mode
    try {
      if (typeof window !== 'undefined' && window.resizeTo && window.screen) {
        window.moveTo(0, 0);
        window.resizeTo(window.screen.availWidth, window.screen.availHeight);
      }
    } catch {
      // ignore if restricted
    }

    // Send initial heartbeat
    const ping = () => {
      fetch('/api/heartbeat', { method: 'POST', keepalive: true }).catch(() => {});
    };
    ping();

    const interval = setInterval(ping, 1800);

    const onExit = () => {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/shutdown');
        } else {
          fetch('/api/shutdown', { method: 'POST', keepalive: true }).catch(() => {});
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeunload', onExit);
    window.addEventListener('pagehide', onExit);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onExit);
      window.removeEventListener('pagehide', onExit);
    };
  }, []);
}
