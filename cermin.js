"use strict";
/* Cermin baca Supabase.
 *
 * Alur: Apps Script menerbitkan kunci sesi bertanda tangan -> Edge Function
 * regulasi-sesi menukarnya jadi JWT jangka pendek -> PostgREST dibaca langsung
 * dengan JWT itu, dan RLS yang menjaga baris mana yang boleh terbaca.
 *
 * Seluruh berkas ini boleh gagal tanpa membuat aplikasi gagal. Setiap kegagalan
 * mengembalikan null atau melempar, dan pemanggil di app.js jatuh balik ke
 * jalur Apps Script. Itulah yang membuat cermin aman dipasang: web tidak ikut
 * mati ketika Supabase tidur.
 *
 * Kunci publik di config.js memang terbaca siapa pun. Itu tidak membuka data:
 * peran anon sudah dicabut dari seluruh tabel reg_*, sehingga tanpa JWT hasil
 * penukaran, kunci itu tidak membuka satu baris pun.
 */
(function () {
  const C = window.YEH_CONFIG;
  const HAL = 1000;              // besar satu halaman baris naskah
  const AMBANG_SEGAR_MS = 60000; // JWT ditukar ulang 1 menit sebelum habis

  let sbKey = '';                // kunci sesi dari Apps Script
  let jwt = '';                  // JWT Supabase
  let jwtExp = 0;                // detik
  let menukar = null;            // penukaran yang sedang berjalan

  const ukur = { tukarMs: 0, bacaMs: 0, baris: 0, sumber: '', galat: '' };

  function siap() { return !!(C.SUPABASE_URL && C.SUPABASE_KEY && sbKey); }
  function setKey(k) {
    const baru = String(k || '');
    if (baru !== sbKey) { sbKey = baru; jwt = ''; jwtExp = 0; menukar = null; }
  }
  function lupakan() { sbKey = ''; jwt = ''; jwtExp = 0; menukar = null; }

  async function ambilJwt() {
    if (!siap()) throw Error('Cermin belum disetel.');
    const sekarang = Date.now() / 1000;
    if (jwt && jwtExp - sekarang > AMBANG_SEGAR_MS / 1000) return jwt;
    if (menukar) return menukar;
    const t0 = performance.now();
    menukar = (async () => {
      const res = await fetch(C.SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/regulasi-sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_KEY },
        body: JSON.stringify({ token: sbKey }),
        cache: 'no-store', credentials: 'omit'
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || !j.ok || !j.data || !j.data.access_token) {
        throw Error((j && j.message) || ('Penukaran kunci sesi gagal (HTTP ' + res.status + ').'));
      }
      jwt = j.data.access_token;
      jwtExp = Number(j.data.exp || 0);
      ukur.tukarMs = Math.round(performance.now() - t0);
      return jwt;
    })();
    try { return await menukar; }
    finally { menukar = null; }
  }

  async function rest(jalur, opt) {
    const o = opt || {};
    const k = await ambilJwt();
    const res = await fetch(C.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1' + jalur, {
      method: o.method || 'GET',
      headers: Object.assign({
        apikey: C.SUPABASE_KEY, Authorization: 'Bearer ' + k,
        'Content-Type': 'application/json', Accept: 'application/json'
      }, o.headers || {}),
      body: o.body ? JSON.stringify(o.body) : undefined,
      cache: 'no-store', credentials: 'omit'
    });
    if (!res.ok) {
      const teks = await res.text().catch(() => '');
      // 401/403 biasanya berarti JWT sudah tidak diterima; paksa tukar ulang.
      if (res.status === 401 || res.status === 403) { jwt = ''; jwtExp = 0; }
      throw Error('Cermin menolak permintaan (HTTP ' + res.status + ') ' + String(teks).slice(0, 200));
    }
    return res.json();
  }

  /** Metadata semua regulasi yang terlihat bagi pengguna ini. */
  async function regulasi() {
    return rest('/reg_regulasi?select=id_regulasi,judul,kelompok,rev,terbatas,versi_default,versi_tersedia,jumlah_baris&order=kelompok.asc,judul.asc');
  }

  async function meta() {
    const baris = await rest('/reg_meta?select=kunci,nilai');
    const o = {};
    (baris || []).forEach(function (r) { o[r.kunci] = r.nilai; });
    return o;
  }

  /** Naskah satu regulasi, dibaca berhalaman supaya batas baris PostgREST
   *  tidak memotong regulasi yang panjang tanpa memberi tahu. */
  async function naskah(id) {
    const t0 = performance.now();
    const rows = [];
    for (let offset = 0; ; offset += HAL) {
      const hal = await rest('/reg_baris?select=baris,rev,bab,pasal,ayat,poin,subpoin,t,sama' +
        '&id_regulasi=eq.' + encodeURIComponent(id) +
        '&order=baris.asc&limit=' + HAL + '&offset=' + offset);
      if (!hal || !hal.length) break;
      hal.forEach(function (r) {
        const o = { row: r.baris, t: r.t || {} };
        if (r.bab) o.bab = r.bab;
        if (r.pasal) o.pasal = r.pasal;
        if (r.ayat) o.ayat = r.ayat;
        if (r.poin) o.poin = r.poin;
        if (r.subpoin) o.subpoin = r.subpoin;
        if (r.sama) o.sama = 1;
        o._rev = r.rev;
        rows.push(o);
      });
      if (hal.length < HAL) break;
    }
    ukur.bacaMs = Math.round(performance.now() - t0);
    ukur.baris = rows.length;
    const rev = rows.length ? rows[0]._rev : '';
    rows.forEach(function (r) { delete r._rev; });
    return { rows: rows, rev: rev };
  }

  /** Pencarian isi pasal. Semantiknya sama dengan pencarian lokal: semua kata
   *  harus muncul sebagai substring. RLS tetap menyaring di sisi Postgres. */
  async function cari(q, kelompok, batas) {
    const t0 = performance.now();
    const hasil = await rest('/rpc/cari_isi', {
      method: 'POST',
      body: { p_q: String(q || ''), p_kelompok: String(kelompok || ''), p_batas: Number(batas) || 120 }
    });
    ukur.bacaMs = Math.round(performance.now() - t0);
    return (hasil || []).map(function (r) {
      return { id: r.id_regulasi, title: r.judul, group: r.kelompok, row: r.baris,
        bab: r.bab || '', pasal: r.pasal || '', ayat: r.ayat || '', poin: r.poin || '',
        excerpt: r.kutipan || '' };
    });
  }

  window.YehCermin = { siap: siap, setKey: setKey, lupakan: lupakan,
    ambilJwt: ambilJwt, regulasi: regulasi, naskah: naskah, cari: cari, meta: meta, ukur: ukur };
})();
