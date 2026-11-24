import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register Service Worker for offline-first PWA precaching & auto-update
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      // App shell cached and ready for 100% offline use
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
