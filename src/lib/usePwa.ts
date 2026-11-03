import { useEffect, useState } from 'react';
import { useAppStore } from './store';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwa() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const showToast = useAppStore((s) => s.showToast);

  useEffect(() => {
    // Check if running in standalone PWA window
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    setIsStandalone(standaloneQuery.matches);

    const handleStandaloneChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
    };
    standaloneQuery.addEventListener('change', handleStandaloneChange);

    // Register Service Worker in production or non-dev
    if ('serviceWorker' in navigator && !import.meta.env.DEV) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showToast('New version available. Refresh to update.', 'info');
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.debug('Service Worker registration skipped/failed:', err);
          });
      });
    }

    // Capture install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      showToast('PDFSign installed successfully!', 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      standaloneQuery.removeEventListener('change', handleStandaloneChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.warn('PWA install error:', err);
    }
  };

  return {
    canInstall: Boolean(deferredPrompt) && !isStandalone,
    isStandalone,
    promptInstall,
  };
}
