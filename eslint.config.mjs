/*
 * ESLint 9 flat config. Mencakup src DAN gas, sesuai skrip "lint": "eslint src gas".
 * Cloudflare tidak menjalankannya; asisten yang menjalankannya sebelum serah.
 *
 * Soal berkas gas: Apps Script memuat seluruh berkas proyek ke SATU lingkup
 * global, sedangkan ESLint memeriksa tiap berkas terpisah. Tanpa penanganan,
 * no-undef akan menyalahkan setiap pemanggilan fungsi yang definisinya ada di
 * berkas lain — ratusan galat palsu. Daftar global di bawah karena itu DIPANEN
 * dari berkas gas itu sendiri saat konfigurasi dimuat, bukan ditulis tangan:
 * daftarnya tidak pernah basi, dan pemanggilan ke nama yang tidak terdefinisi
 * di berkas mana pun tetap tertangkap.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function panenGlobalGas() {
  const g = {};
  let berkas = [];
  try { berkas = readdirSync('gas').filter(f => f.endsWith('.js')); } catch (e) { return g; }
  for (const f of berkas) {
    const isi = readFileSync(join('gas', f), 'utf8');
    // Deklarasi tingkat atas saja: tanpa indentasi di depannya.
    for (const m of isi.matchAll(/^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm)) {
      const nama = m[1] || m[2];
      if (nama) g[nama] = 'readonly';
    }
  }
  return g;
}

const LAYANAN_APPS_SCRIPT = {
  SpreadsheetApp: 'readonly', DriveApp: 'readonly', CacheService: 'readonly',
  PropertiesService: 'readonly', LockService: 'readonly', ScriptApp: 'readonly',
  Utilities: 'readonly', UrlFetchApp: 'readonly', ContentService: 'readonly',
  HtmlService: 'readonly', Session: 'readonly', MailApp: 'readonly'
};

const BAWAAN_JS = {
  console: 'readonly', JSON: 'readonly', Math: 'readonly', Date: 'readonly',
  Object: 'readonly', Array: 'readonly', String: 'readonly', Number: 'readonly',
  Boolean: 'readonly', Error: 'readonly', Set: 'readonly', Map: 'readonly',
  Promise: 'readonly', RegExp: 'readonly', isNaN: 'readonly',
  parseInt: 'readonly', parseFloat: 'readonly'
};

const PERAMBAN = {
  window: 'readonly', document: 'readonly', location: 'readonly', history: 'readonly',
  fetch: 'readonly', AbortController: 'readonly', performance: 'readonly',
  localStorage: 'readonly', sessionStorage: 'readonly', indexedDB: 'readonly',
  IntersectionObserver: 'readonly', getComputedStyle: 'readonly', matchMedia: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', requestAnimationFrame: 'readonly',
  navigator: 'readonly', Node: 'readonly', NodeFilter: 'readonly',
  Uint8Array: 'readonly', Uint16Array: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly',
  URL: 'readonly', Blob: 'readonly', atob: 'readonly', btoa: 'readonly', crypto: 'readonly'
};

const ATURAN = {
  'no-undef': 'error',
  // caughtErrors: 'none' — ESLint 9 mengubah bawaannya, sehingga blok catch
  // yang memang sengaja kosong akan ditandai sebagai galat.
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-unreachable': 'error',
  'no-cond-assign': 'error',
  'no-constant-condition': 'error',
  'no-irregular-whitespace': 'error'
};

export default [
  { ignores: ['build/**', 'node_modules/**', 'supabase/functions/**'] },

  // Sumber web biasa (modul ES, tanpa JSX)
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...BAWAAN_JS, ...PERAMBAN }
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: ATURAN
  },

  // Komponen React
  {
    files: ['src/**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...BAWAAN_JS, ...PERAMBAN }
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      ...ATURAN,
      // ESLint inti tidak melihat pemakaian identifier di dalam JSX, sehingga
      // React dan setiap komponen yang dipakai sebagai <Komponen /> akan
      // dianggap tidak terpakai. Nama berawalan huruf besar karena itu
      // dikecualikan; nama berhuruf kecil tetap diperiksa.
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^[A-Z]' }]
    }
  },

  // Berkas Apps Script: satu lingkup global, deklarasinya dipanen di atas
  {
    files: ['gas/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...BAWAAN_JS, ...LAYANAN_APPS_SCRIPT, ...panenGlobalGas() }
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      ...ATURAN,
      // Deklarasi tingkat atas dipanen sebagai global, jadi no-unused-vars di
      // sini akan menuduh setiap fungsi "tidak terpakai". Pemeriksaannya
      // dijalankan terpisah atas berkas gas yang digabung menjadi satu.
      'no-unused-vars': 'off',
      'no-redeclare': 'off'
    }
  },

  // Berkas konfigurasi Node
  {
    files: ['*.config.js', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022, sourceType: 'module',
      globals: { ...BAWAAN_JS, process: 'readonly' }
    },
    rules: { 'no-undef': 'error', 'no-unused-vars': 'error' }
  }
];
