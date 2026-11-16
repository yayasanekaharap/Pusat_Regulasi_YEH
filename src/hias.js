"use strict";
/*
 * Pengenal rujukan pasal dan istilah yang didefinisikan.
 *
 * Berkas ini MURNI: tidak menyentuh DOM, sehingga bisa diuji langsung terhadap
 * naskah sungguhan di Node. Yang dihasilkan hanya daftar rentang
 * { s, e, ... } di dalam satu teks paragraf; app.js yang mengubahnya menjadi
 * tautan dan penanda istilah.
 *
 * Prinsip kehati-hatian: lebih baik tidak menautkan daripada menautkan ke pasal
 * yang salah. Rujukan ke peraturan lain ("Pasal 5 Undang-Undang Nomor …")
 * tidak boleh melompat ke Pasal 5 naskah yang sedang dibuka, jadi setiap
 * rujukan yang diikuti atau didahului nama peraturan lain dibiarkan sebagai
 * teks biasa.
 */

const normPasal = v => String(v || '').replace(/^pasal\s*/i, '').replace(/\s+/g, '').toUpperCase();
const normAyat = v => String(v || '').replace(/[()\s.]/g, '').toLowerCase();

/** Peta pasal dan ayat sebuah naskah: { pasal: {NUM: row}, ayat: {'NUM|n': row} }.
 *  BAB dan Pasal diisi-turun dari baris di atasnya, seperti pada pembaca. */
export function petaPasal(rows) {
  const pasal = {}, ayat = {};
  let cur = '';
  for (const r of rows || []) {
    if (r.pasal) {
      cur = normPasal(r.pasal);
      if (!(cur in pasal)) pasal[cur] = r.row;
    }
    if (cur && r.ayat) {
      const k = cur + '|' + normAyat(r.ayat);
      if (!(k in ayat)) ayat[k] = r.row;
    }
  }
  return { pasal, ayat };
}

// "Pasal 5", "Pasal 5A", "Pasal 5 ayat (2)", "Pasal 5 ayat (2) huruf a", "Pasal 81 angka 3"
const POLA_PASAL = /\bPasal\s+(\d+[A-Z]?)(?![\w])(?:\s+ayat\s+\((\d+[a-z]?)\))?(?:\s+(?:huruf|angka)\s+[a-z0-9]+\b)?/g;
// Penghubung antar-rujukan dalam satu rangkaian.
const PENGHUBUNG = /^\s*(?:,\s*(?:dan\s+|atau\s+)?|dan\/atau\s+|dan\s+|atau\s+|sampai\s+dengan\s+|s\.d\.?\s+|hingga\s+)$/i;
// Nama peraturan lain sesudah rangkaian rujukan.
const PERATURAN_LAIN = /^\s*[,;]?\s*(?:Undang|UU\b|Perpu|Perppu|Peraturan|Keputusan|Kitab|KUH|Instruksi|Surat\s+Edaran|Permen|Permendik|Permenaker|PP\b|Perpres|Perda|Perka|Qanun|Konvensi|Lampiran\s+Undang|Staatsblad|Stb\b|Ordonansi|Statuta|Anggaran\s+(?:Dasar|Rumah)|AD\b|ART\b)/i;
// "… Pasal 5 Undang-Undang ini" justru merujuk ke naskah yang sedang dibuka.
const PERATURAN_INI = /^\s*,?\s*(?:Undang-Undang|Peraturan(?:\s+[A-Z][\w-]*){0,3}|Keputusan(?:\s+[A-Z][\w-]*){0,3}|Anggaran\s+Dasar|Anggaran\s+Rumah\s+Tangga|Statuta)\s+ini\b/i;
// Nama peraturan lain tepat sebelum rujukan ("… Nomor 13 Tahun 2003 Pasal 5").
const PERATURAN_SEBELUM = /(?:Undang-Undang|Peraturan|Keputusan|Nomor\s+\S+\s+Tahun\s+\d{4})[^.;:]{0,40}$/i;

/** Rujukan pasal yang aman ditautkan di dalam satu teks.
 *  peta: hasil petaPasal naskah yang sedang dibuka.
 *  Mengembalikan { rentang: [{ s, e, row, label }], statistik } — statistik
 *  dipakai pengujian untuk menghitung yang dilewati dan alasannya. */
export function cariRujukan(teks, peta) {
  const out = [], stat = { ditemukan: 0, ditautkan: 0, luar: 0, tidakAda: 0 };
  const t = String(teks || '');
  if (!t || !peta) return { rentang: out, statistik: stat };
  POLA_PASAL.lastIndex = 0;
  const temuan = [];
  let m;
  while ((m = POLA_PASAL.exec(t))) temuan.push({ s: m.index, e: m.index + m[0].length, pasal: m[1], ayat: m[2] || '' });
  // Kelompokkan menjadi rangkaian ("Pasal 5 dan Pasal 6 ayat (2)") supaya nama
  // peraturan di ujung rangkaian berlaku bagi seluruh anggotanya.
  const rangkaian = [];
  for (const x of temuan) {
    const akhir = rangkaian[rangkaian.length - 1];
    if (akhir && PENGHUBUNG.test(t.slice(akhir[akhir.length - 1].e, x.s))) akhir.push(x);
    else rangkaian.push([x]);
  }
  for (const r of rangkaian) {
    stat.ditemukan += r.length;
    const sesudah = t.slice(r[r.length - 1].e, r[r.length - 1].e + 60);
    const sebelum = t.slice(Math.max(0, r[0].s - 80), r[0].s);
    if ((PERATURAN_LAIN.test(sesudah) && !PERATURAN_INI.test(sesudah)) || PERATURAN_SEBELUM.test(sebelum)) { stat.luar += r.length; continue; }
    for (const x of r) {
      const np = normPasal(x.pasal);
      if (!(np in peta.pasal)) { stat.tidakAda++; continue; }
      const rowAyat = x.ayat ? peta.ayat[np + '|' + normAyat(x.ayat)] : 0;
      out.push({ s: x.s, e: x.e, row: rowAyat || peta.pasal[np], kepala: !rowAyat,
        label: 'Pasal ' + x.pasal + (x.ayat ? ' ayat (' + x.ayat + ')' : '') });
      stat.ditautkan++;
    }
  }
  return { rentang: out, statistik: stat };
}

/* ---------------- Istilah yang didefinisikan ---------------- */

const POLA_DEFINISI = /^\s*(.{2,90}?)(?:,?\s+yang\s+selanjutnya\s+(?:disingkat|disebut)(?:\s+dengan)?\s+(.{2,60}?),?)?\s+adalah\b\s*:?\s*(.*)$/i;

/** Istilah dari "Ketentuan Umum": baris berangka di Pasal 1 berbentuk
 *  "X adalah …" atau "X yang selanjutnya disebut Y adalah …".
 *  Mengembalikan [{ istilah, row, definisi }]. */
export function cariIstilah(rows, teksBaris) {
  const out = [], sudah = new Set();
  let cur = '';
  for (const r of rows || []) {
    if (r.pasal) cur = normPasal(r.pasal);
    if (cur !== '1' || !(r.poin || r.subpoin || r.ayat)) continue;
    const teks = String(teksBaris(r) || '').replace(/\s+/g, ' ').trim();
    const m = teks.match(POLA_DEFINISI);
    if (!m) continue;
    const calon = [m[2], m[1]].filter(Boolean).map(x => x.replace(/^["“'‘]|["”'’.,;:]$/g, '').trim());
    for (const c of calon) {
      // Istilah wajar: diawali huruf besar, tidak diawali angka, tidak memuat
      // tanda baca kalimat, dan tidak terlalu umum.
      // Singkatan dua huruf (K3) diterima bila seluruhnya huruf besar/angka.
      const singkatan = /^[A-Z0-9]{2,}$/.test(c);
      if ((c.length < 3 && !singkatan) || c.length > 70 || /^\d/.test(c) || /[;:]/.test(c) || !/^[A-Z]/.test(c)) continue;
      if (c.split(/\s+/).length > 9) continue;
      if (sudah.has(c)) continue;
      sudah.add(c);
      out.push({ istilah: c, row: r.row, definisi: teks });
    }
  }
  // Yang panjang dicocokkan lebih dahulu: "Pekerja/Buruh" sebelum "Pekerja".
  return out.sort((a, b) => b.istilah.length - a.istilah.length);
}

/** Pola pencocok untuk semua istilah, peka huruf besar-kecil, utuh per kata. */
export function polaIstilah(daftar) {
  if (!daftar || !daftar.length) return null;
  const esc = daftar.map(d => d.istilah.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/\s+/g, '\\s+'));
  return new RegExp('(?<![\\p{L}\\p{N}])(?:' + esc.join('|') + ')(?![\\p{L}\\p{N}])', 'gu');
}

/** Kemunculan PERTAMA tiap istilah di dalam satu teks: [{ s, e, i }]. */
export function tandaiIstilah(teks, daftar, pola) {
  const out = [];
  if (!pola) return out;
  const t = String(teks || ''), dipakai = new Set();
  pola.lastIndex = 0;
  let m;
  while ((m = pola.exec(t))) {
    const kata = m[0].replace(/\s+/g, ' ');
    const i = daftar.findIndex(d => d.istilah === kata);
    if (i < 0 || dipakai.has(i)) continue;
    dipakai.add(i);
    out.push({ s: m.index, e: m.index + m[0].length, i });
  }
  return out;
}

/** Menggabungkan rentang yang tidak boleh tumpang-tindih (rujukan menang
 *  atas istilah), diurutkan menurut posisi. */
export function gabungRentang(rujukan, istilah) {
  const semua = rujukan.map(x => ({ ...x, jenis: 'ref' }));
  for (const d of istilah) {
    if (!semua.some(x => d.s < x.e && x.s < d.e)) semua.push({ ...d, jenis: 'def' });
  }
  return semua.sort((a, b) => a.s - b.s);
}
