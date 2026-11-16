"use strict";
/*
 * Tanda dan catatan pribadi di sisi web.
 *
 * - Penyimpanan optimistik: tampilan berubah lebih dahulu, permintaan ke Apps
 *   Script berjalan di belakang. Bila ditolak, perubahan dikembalikan dan
 *   alasannya ditampilkan — operasi yang ditolak tidak menggantung di antrean.
 * - Jangkar: tanda dicari ulang lewat alamat pasal dan cuplikan teks, bukan
 *   hanya nomor baris. Lihat cariJangkar().
 *
 * Berkas ini tidak menyentuh DOM, supaya pencarian jangkarnya dapat diuji di
 * Node terhadap naskah yang barisnya digeser.
 */

export const LABEL_BAWAAN = { 1: 'Penting', 2: 'Perlu dicek', 3: 'Kewajiban', 4: 'Tenggat waktu' };
const KUNCI_JALUR = ['bab', 'pasal', 'ayat', 'poin', 'subpoin'];

export const rapikan = s => String(s || '').replace(/\s+/g, ' ').trim();

export function idBaru() {
  const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  let s = 'T';
  for (const x of b) s += a[x % a.length];
  return s;
}

/** Alamat dan teks setiap baris sebuah naskah, BAB dan Pasal diisi-turun. */
export function indeksNaskah(rows, teksBaris) {
  const out = new Map();
  let bab = '', pasal = '';
  for (const r of rows || []) {
    if (r.bab && r.bab !== bab) { bab = r.bab; pasal = ''; }
    if (r.pasal) pasal = r.pasal;
    const j = {};
    if (bab) j.bab = bab;
    if (pasal) j.pasal = pasal;
    for (const k of ['ayat', 'poin', 'subpoin']) if (r[k]) j[k] = r[k];
    out.set(r.row, { row: r.row, jalur: j, r });
  }
  return out;
}
const samaJalur = (a, b) => KUNCI_JALUR.every(k => String(a[k] || '') === String(b[k] || ''));
// Pencarian lebih luas tetap mensyaratkan pasal dan ayat yang sama. BAB boleh
// berbeda karena penomoran BAB dapat bergeser bila BAB baru disisipkan; tetapi
// tanda tidak pernah dipindah diam-diam ke PASAL lain.
const samaPasal = (a, b) => ['pasal', 'ayat'].every(k => String(a[k] || '') === String(b[k] || ''));

/**
 * Menemukan letak tanda di naskah saat ini.
 * Hasil: { row, awal, status } dengan status
 *   'tepat'   — ditemukan di baris yang dicatat
 *   'pindah'  — baris di sheet sumber bergeser, ditemukan lewat alamat/cuplikan
 *   'periksa' — teksnya sudah berubah; ditampilkan dengan peringatan, tidak
 *               dipindah diam-diam ke tempat lain
 * teksBaris(r, versi) mengembalikan teks satu baris pada versi tertentu.
 */
export function cariJangkar(item, indeks, teksBaris) {
  const versi = item.jenis === 'STABILO' ? (item.versi || 'utuh') : 'utuh';
  const teks = x => String(teksBaris(x.r, versi) || '');
  const petunjuk = indeks.get(item.row);
  if (item.jenis === 'STABILO') {
    const c = String(item.cuplikan || '');
    if (!c) return { row: item.row, awal: -1, status: 'periksa' };
    // Baris petunjuk hanya dipercaya bila alamat pasalnya juga sama. Naskah
    // undang-undang penuh kalimat berulang ("… mengatur hak …"), sehingga
    // sesudah baris bergeser, teks di posisi yang sama pada baris lama bisa
    // kebetulan identik padahal baris itu kini milik pasal lain.
    const jalurAda = Object.keys(item.jalur || {}).length > 0;
    if (petunjuk && (!jalurAda || samaJalur(petunjuk.jalur, item.jalur))) {
      const t = teks(petunjuk);
      if (item.awal >= 0 && t.substr(item.awal, c.length) === c) return { row: item.row, awal: item.awal, status: 'tepat' };
      const i = t.indexOf(c);
      if (i >= 0) return { row: item.row, awal: i, status: 'tepat' };
    }
    const calon = [...indeks.values()].filter(x => samaJalur(x.jalur, item.jalur || {}) && teks(x).includes(c));
    if (calon.length === 1) return { row: calon[0].row, awal: teks(calon[0]).indexOf(c), status: 'pindah' };
    const semua = [...indeks.values()].filter(x => samaPasal(x.jalur, item.jalur || {}) && teks(x).includes(c));
    if (semua.length === 1) return { row: semua[0].row, awal: teks(semua[0]).indexOf(c), status: 'pindah' };
    return { row: item.row, awal: -1, status: 'periksa' };
  }
  // PASAL / CATATAN: dicocokkan dengan awal teks barisnya.
  const c = rapikan(item.cuplikan).slice(0, 60);
  const cocok = x => !c || rapikan(teks(x)).startsWith(c);
  if (petunjuk && cocok(petunjuk) && (!c || samaJalur(petunjuk.jalur, item.jalur || {}) || !Object.keys(item.jalur || {}).length))
    return { row: item.row, awal: -1, status: 'tepat' };
  if (c) {
    const calon = [...indeks.values()].filter(x => samaJalur(x.jalur, item.jalur || {}) && cocok(x));
    if (calon.length === 1) return { row: calon[0].row, awal: -1, status: calon[0].row === item.row ? 'tepat' : 'pindah' };
    const semua = [...indeks.values()].filter(x => samaPasal(x.jalur, item.jalur || {}) && cocok(x));
    if (semua.length === 1) return { row: semua[0].row, awal: -1, status: 'pindah' };
  }
  return { row: item.row, awal: -1, status: 'periksa' };
}

/**
 * Wadah tanda milik pengguna yang sedang masuk.
 * kirim(op, item) memanggil Apps Script dan mengembalikan { item }.
 * Setiap perubahan memanggil berubah(daftar).
 */
export function buatWadah(kirim, berubah, galat) {
  let daftar = [];
  // Perubahan lokal yang dibuat sesudah daftar terakhir diminta dari server.
  // Dipasang ulang di atas jawaban init yang datang belakangan, supaya tanda
  // yang baru saja dibuat tidak hilang hanya karena init berangkat lebih dulu.
  const lokal = new Map();
  const beri = () => { try { berubah(daftar.slice()); } catch (e) { /* tampilan menangani sendiri */ } };
  // Permintaan untuk tanda yang SAMA dikirim berurutan. Tanpa ini, "buat
  // stabilo" lalu langsung "beri catatan" berangkat hampir bersamaan, dan yang
  // tiba belakangan di server dapat menimpa yang lain.
  const antre = new Map();
  function urut(id, fn) {
    const p = (antre.get(id) || Promise.resolve()).then(fn, fn);
    antre.set(id, p.catch(() => {}));
    return p;
  }

  function muat(items, sejak) {
    const m = new Map((items || []).map(x => [x.id, x]));
    for (const [id, x] of lokal) {
      if (x.t <= sejak) { lokal.delete(id); continue; }
      if (x.hapus) m.delete(id); else m.set(id, x.item);
    }
    daftar = [...m.values()];
    beri();
  }
  async function simpan(item) {
    const lama = daftar.find(x => x.id === item.id);
    const baru = Object.assign({}, lama || {}, item, { diubah: new Date().toISOString() });
    if (!lama) baru.dibuat = baru.diubah;
    daftar = lama ? daftar.map(x => x.id === item.id ? baru : x) : daftar.concat([baru]);
    lokal.set(item.id, { t: Date.now(), item: baru });
    beri();
    try {
      const r = await urut(item.id, () => kirim('simpan', baru));
      if (r && r.item) {
        daftar = daftar.map(x => x.id === item.id ? r.item : x);
        lokal.set(item.id, { t: Date.now(), item: r.item });
        beri();
      }
      return true;
    } catch (e) {
      daftar = lama ? daftar.map(x => x.id === item.id ? lama : x) : daftar.filter(x => x.id !== item.id);
      lokal.delete(item.id);
      beri();
      galat(e);
      return false;
    }
  }
  async function hapus(id) {
    const lama = daftar.find(x => x.id === id);
    if (!lama) return true;
    daftar = daftar.filter(x => x.id !== id);
    lokal.set(id, { t: Date.now(), hapus: true });
    beri();
    try { await urut(id, () => kirim('hapus', { id })); return true; }
    catch (e) {
      daftar = daftar.concat([lama]);
      lokal.delete(id);
      beri();
      galat(e);
      return false;
    }
  }
  return {
    muat, simpan, hapus,
    semua: () => daftar.slice(),
    untuk: reg => daftar.filter(x => x.reg === reg && x.jenis !== 'LABEL' && x.jenis !== 'FAVORIT'),
    favorit: () => new Set(daftar.filter(x => x.jenis === 'FAVORIT').map(x => x.reg)),
    label: () => {
      const o = Object.assign({}, LABEL_BAWAAN);
      daftar.filter(x => x.jenis === 'LABEL' && x.catatan).forEach(x => { o[x.warna] = x.catatan; });
      return o;
    }
  };
}
