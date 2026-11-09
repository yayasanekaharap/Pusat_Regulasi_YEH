import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // './' supaya seluruh rujukan aset relatif terhadap halaman — aman di
  // Cloudflare Workers maupun saat dibuka dari subfolder.
  base: './',
  // Berkas src/ berekstensi .js meskipun memuat JSX. plugin-react HARUS
  // diberi tahu secara eksplisit; setelan esbuild di bawah saja tidak cukup
  // pada Vite 7 — JSX-nya akan sampai ke Rollup dan ditolak "Expression
  // expected". Puluhan berkas TIDAK diganti nama menjadi .jsx hanya untuk ini.
  plugins: [react({ include: /src\/.*\.jsx?$/ })],
  build: {
    outDir: 'build',
    sourcemap: false,
    emptyOutDir: true,
    // Polyfill modulepreload disuntikkan sebagai SKRIP INLINE, dan CSP di
    // index.html hanya mengizinkan script-src 'self'. Dimatikan supaya
    // halamannya tidak ditolak browsernya sendiri.
    modulePreload: { polyfill: false }
  },
  // Berkas di src/ berekstensi .js meskipun memuat JSX. Tanpa dua setelan di
  // bawah, esbuild menolaknya — dan puluhan berkas TIDAK perlu diganti nama
  // menjadi .jsx hanya untuk itu.
  esbuild: { loader: 'jsx', include: /src\/.*\.jsx?$/ },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } }
});
