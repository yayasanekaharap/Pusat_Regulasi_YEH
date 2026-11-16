/* Service worker Pusat Referensi Regulasi YEH (v1.7.0).
 *
 * Tujuannya satu: kerangka web tetap terbuka tanpa internet. Naskah sudah
 * tersimpan di IndexedDB oleh aplikasi; berkas ini hanya menyimpan halaman dan
 * berkas tampilannya.
 *
 * - Halaman utama: jaringan DULU, salinan hanya bila luring. Pengguna yang
 *   tersambung selalu mendapat versi terbaru.
 * - /a/* (berkas berkode versi): salinan dulu — isinya tidak pernah berubah.
 * - Permintaan ke Apps Script dan Supabase TIDAK disentuh sama sekali.
 */
const SIMPAN = 'yeh-regulasi-kerangka';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const c = await caches.open(SIMPAN);
          await c.put('./', res.clone());
          bersihkan(c, await res.clone().text());
        }
        return res;
      } catch (err) {
        const c = await caches.open(SIMPAN);
        return (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.indexOf('/a/') >= 0 || url.pathname.indexOf('/assets/') >= 0) {
    e.respondWith((async () => {
      const c = await caches.open(SIMPAN);
      const ada = await c.match(req);
      if (ada) return ada;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
  }
});

/** Membuang berkas /a/ versi lama yang sudah tidak dirujuk halaman terbaru.
 *  Bongkahan yang dimuat belakangan (mis. ekspor Word) ikut terbuang dan akan
 *  diambil ulang dari jaringan saat dibutuhkan — tidak ada yang rusak. */
async function bersihkan(c, html) {
  try {
    const dipakai = new Set((html.match(/\/?a\/[\w.-]+\.(?:js|css)/g) || []).map(x => x.replace(/^\//, '')));
    for (const k of await c.keys()) {
      const p = new URL(k.url).pathname;
      const i = p.indexOf('/a/');
      if (i >= 0 && !dipakai.has(p.slice(i + 1))) await c.delete(k);
    }
  } catch (err) { /* pembersihan boleh gagal */ }
}
