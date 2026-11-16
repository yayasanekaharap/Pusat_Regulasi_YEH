import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './style.css';

createRoot(document.getElementById('akar')).render(<App />);

// Kerangka web tanpa internet (v1.7.0). Pustaka naskah sudah tersimpan di
// perangkat; service worker menyimpan kerangka halamannya. Halaman utama
// selalu diambil dari jaringan lebih dahulu, jadi pengguna yang tersambung
// tidak pernah tertahan di versi lama — salinan hanya dipakai saat luring.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* web tetap berjalan tanpa service worker */ });
  });
}
