"use client";

import { useEffect } from 'react';

export default function InitSettings() {
  useEffect(() => {
    try {
      // Default volume: 100%
      if (typeof window !== 'undefined' && window.localStorage) {
        if (localStorage.getItem('canfes.volume') === null) {
          localStorage.setItem('canfes.volume', '1');
        }
        // Apply stored text scale immediately (if any)
        const ts = Number(localStorage.getItem('canfes.textScale'));
        if (!Number.isNaN(ts) && ts > 0) {
          document.documentElement.style.setProperty('--text-scale', String(ts));
        }
      }

      const isSecureContext = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if ('serviceWorker' in navigator && isSecureContext) {
        void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      }
    } catch {}
  }, []);
  return null;
}
