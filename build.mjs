/* Build: menyalin berkas web ke build/ — itu yang diterbitkan Cloudflare.
 * Tidak ada bundler, karena aplikasi ini JavaScript biasa tanpa modul.
 * Gunanya tetap nyata: hanya berkas yang didaftarkan di bawah yang terbit,
 * sehingga berkas kerja, catatan, atau berkas sampah di akar repo tidak ikut
 * tersaji ke publik seperti yang terjadi pada penerbitan GitHub Pages dulu
 * (workflow lamanya menerbitkan seluruh isi repo dengan path: .).
 */
import { mkdirSync, copyFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

const KELUAR = 'build';
const BERKAS = [
  'index.html',
  'config.js',
  'api.js',
  'store.js',
  'cermin.js',
  'app.js',
  'style.css'
];
const FOLDER = ['assets'];

rmSync(KELUAR, { recursive: true, force: true });
mkdirSync(KELUAR, { recursive: true });

let n = 0;
for (const f of BERKAS) {
  if (!existsSync(f)) {
    console.error('✘ [ERROR] Berkas wajib tidak ada: ' + f);
    process.exit(1);
  }
  copyFileSync(f, join(KELUAR, f));
  n++;
}
function salinFolder(dir) {
  for (const nama of readdirSync(dir)) {
    const asal = join(dir, nama), tujuan = join(KELUAR, asal);
    if (statSync(asal).isDirectory()) { mkdirSync(tujuan, { recursive: true }); salinFolder(asal); }
    else { mkdirSync(dirname(tujuan), { recursive: true }); copyFileSync(asal, tujuan); n++; }
  }
}
for (const d of FOLDER) if (existsSync(d)) { mkdirSync(join(KELUAR, d), { recursive: true }); salinFolder(d); }

console.log('build selesai: ' + n + ' berkas di ' + KELUAR + '/');
