/*
 * Pemeriksaan tambahan untuk berkas Apps Script.
 *
 * `eslint src gas` memeriksa tiap berkas terpisah dengan deklarasi gas dipanen
 * sebagai global. Itu menangkap no-undef — pemanggilan ke nama yang tidak
 * terdefinisi di berkas mana pun — tetapi TIDAK dapat menangkap fungsi yang
 * tidak pernah dipanggil, karena setiap deklarasi sudah dianggap global.
 *
 * Berkas ini menutup celah itu: seluruh berkas gas digabung menjadi satu
 * berkas — persis cara Apps Script memuatnya — lalu di-lint dengan
 * no-unused-vars menyala, dan posisi galatnya dipetakan kembali ke berkas
 * asalnya.
 *
 * Titik masuk dan kode mati yang sudah ada sebelum paket ini didaftarkan per
 * nama di bawah, bukan dengan pola lebar, supaya fungsi BARU yang tidak pernah
 * dipanggil tetap tertangkap.
 */
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';

const DIR = 'gas';
const DIIZINKAN_TAK_TERPAKAI = [
  'doGet', 'doPost', 'onOpen',            // titik masuk Apps Script
  'menuAturUlangSandiAdmin', 'menuBersihkanCache', 'menuInformasi',
  'menuPasangPemicu', 'menuRekonsiliasiCermin',   // dipanggil dari menu spreadsheet
  'yehPemicuSuntingSumber', 'yehPemicuUbahSumber', 'yehPemicuSapu',
  'yehPemicuRekonsiliasi', 'yehPemicuKeepAlive',  // dipanggil pemicu
  // Kode mati yang sudah ada sebelum v1.5.0, sengaja belum dibersihkan:
  'yehAt_', 'yehCheckSourceHeaders_', 'yehAdminMembers_', 'yehAdminSaveMember_'
];

const berkas = readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
let gabung = '';
const peta = [];
let baris = 1;
for (const f of berkas) {
  let isi = readFileSync(join(DIR, f), 'utf8');
  if (!isi.endsWith('\n')) isi += '\n';
  const n = isi.split('\n').length - 1;
  peta.push({ f, mulai: baris, akhir: baris + n - 1 });
  gabung += isi;
  baris += n;
}

/* Berkas gabungan ditulis DI DALAM repo. Di luar folder proyek, ESLint
   menjawab "File ignored because outside of base path" dan tidak memeriksa apa
   pun — nol galat yang menyesatkan. */
const tmp = '.lintgas-tmp';
mkdirSync(tmp, { recursive: true });
const jalur = join(tmp, 'gabungan.js');
writeFileSync(jalur, gabung);

const layanan = ['SpreadsheetApp','DriveApp','CacheService','PropertiesService','LockService',
  'ScriptApp','Utilities','UrlFetchApp','ContentService','HtmlService','Session','MailApp'];
const bawaan = ['console','JSON','Math','Date','Object','Array','String','Number','Boolean',
  'Error','Set','Map','Promise','RegExp','isNaN','parseInt','parseFloat'];
const globals = {};
for (const g of layanan.concat(bawaan)) globals[g] = 'readonly';

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [{
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', {
        args: 'none', caughtErrors: 'none',
        varsIgnorePattern: '^(' + DIIZINKAN_TAK_TERPAKAI.join('|') + ')$'
      }],
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error'
    }
  }]
});

const hasil = await eslint.lintFiles([jalur]);
if (!hasil.length) {
  console.error('lint-gas GAGAL: ESLint tidak memeriksa berkas gabungan sama sekali.');
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}
const pesan = (hasil[0] && hasil[0].messages) || [];
const diabaikan = pesan.some(m => /outside of base path|File ignored/.test(String(m.message)));
if (diabaikan) {
  console.error('lint-gas GAGAL: berkas gabungan diabaikan ESLint, pemeriksaan tidak berjalan.');
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}
const asal = ln => peta.find(p => ln >= p.mulai && ln <= p.akhir) || { f: '?', mulai: 1 };
let galat = 0;
for (const m of pesan) {
  const a = asal(m.line);
  if (m.severity === 2) galat++;
  console.log(`${m.severity === 2 ? 'GALAT' : 'peringatan'}  ${a.f}:${m.line - a.mulai + 1}:${m.column}  ${m.message}  [${m.ruleId}]`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`lint-gas: ${berkas.length} berkas, ${gabung.split('\n').length - 1} baris gabungan, ${galat} galat`);
process.exit(galat ? 1 : 0);
