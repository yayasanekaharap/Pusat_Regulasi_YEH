/**
 * Cermin baca Supabase, penanda revisi PER SHEET, dan pemicu.
 *
 * Spreadsheet tetap sumber kebenaran. Arah tulis satu saja: Sheet -> Supabase.
 * Web tidak pernah menulis ke tabel reg_*.
 *
 * Nilai yang wajib ada di Script Properties (File > Project Settings):
 *   REG_SB_URL           https://<ref>.supabase.co
 *   REG_SB_SERVICE_KEY   service_role key. TIDAK PERNAH di sheet maupun repo.
 *   REG_TOKEN_SECRET     rahasia penanda tangan kunci sesi; sama persis dengan
 *                        secret Edge Function bernama sama.
 *
 * Sebelum ketiganya diisi, seluruh berkas ini diam: yehSbSiap_() palsu, cermin
 * tidak didorong, dan web memakai jalur /exec seperti sebelumnya.
 */

const YEH_P_SB_URL_ = 'REG_SB_URL';
const YEH_P_SB_KEY_ = 'REG_SB_SERVICE_KEY';
const YEH_P_TOKEN_ = 'REG_TOKEN_SECRET';
const YEH_P_REV_ = 'REG_REV_SHEET';
const YEH_P_KOTOR_ = 'REG_SHEET_KOTOR';
const YEH_P_DORONG_ = 'REG_DORONG_TERAKHIR';

/** Jeda minimum antar dorongan sheet yang sama, supaya satu rentetan suntingan
 *  tidak menjadi satu dorongan per sel. Sisanya dibereskan penyapu 10 menit. */
const YEH_DORONG_JEDA_MS_ = 60000;

function yehProp_(k) {
  return String(PropertiesService.getScriptProperties().getProperty(k) || '').trim();
}
function yehPropSet_(k, v) {
  PropertiesService.getScriptProperties().setProperty(k, String(v));
}
function yehPropObj_(k) {
  try { return JSON.parse(yehProp_(k) || '{}') || {}; } catch (e) { return {}; }
}
function yehSbSiap_() { return !!(yehProp_(YEH_P_SB_URL_) && yehProp_(YEH_P_SB_KEY_)); }
function yehTokenSiap_() { return !!yehProp_(YEH_P_TOKEN_); }

/* ---------- Penanda revisi per sheet ----------
   Inilah perbaikan pokok paket ini. Sebelumnya revisi diambil dari waktu ubah
   SELURUH spreadsheet sumber, sehingga satu suntingan di satu sheet mengubah
   penanda semua regulasi dan memaksa setiap pengguna mengunduh ulang seluruh
   pustaka. Sekarang setiap sheet punya penandanya sendiri. */

function yehRevMap_() {
  if (!YEH_MEMO_.revMap) YEH_MEMO_.revMap = yehPropObj_(YEH_P_REV_);
  return YEH_MEMO_.revMap;
}
function yehSheetRev_(nama) {
  const m = yehRevMap_(), k = yehNorm_(nama);
  if (m[k]) return String(m[k]);
  // Jatuh balik: sebelum rekonsiliasi pertama mengisi peta, perilakunya sama
  // seperti versi lama. Tidak ada yang rusak, hanya belum lebih cepat.
  return yehSrcUpdated_();
}
function yehSetSheetRev_(nama, rev) {
  const m = yehRevMap_(), k = yehNorm_(nama);
  m[k] = String(rev || Date.now());
  YEH_MEMO_.revMap = m;
  yehPropSet_(YEH_P_REV_, JSON.stringify(m));
  return m[k];
}

/* ---------- Permintaan ke Supabase ---------- */

function yehSbFetch_(jalur, opt) {
  const o = opt || {};
  const key = yehProp_(YEH_P_SB_KEY_);
  const url = yehProp_(YEH_P_SB_URL_).replace(/\/+$/, '') + jalur;
  const kepala = { apikey: key, Authorization: 'Bearer ' + key };
  Object.keys(o.headers || {}).forEach(function (k) { kepala[k] = o.headers[k]; });
  const param = { method: o.method || 'get', contentType: 'application/json',
    headers: kepala, muteHttpExceptions: true };
  if (o.payload !== undefined) param.payload = JSON.stringify(o.payload);
  const res = UrlFetchApp.fetch(url, param);
  const kode = res.getResponseCode();
  const teks = String(res.getContentText() || '');
  if (kode < 200 || kode >= 300) throw Error('Supabase ' + kode + ' pada ' + jalur + ': ' + teks.slice(0, 300));
  if (!teks) return null;
  try { return JSON.parse(teks); } catch (e) { return null; }
}
function yehSbUpsert_(tabel, baris, konflik) {
  if (!baris || !baris.length) return;
  const q = konflik ? '?on_conflict=' + encodeURIComponent(konflik) : '';
  yehSbFetch_('/rest/v1/' + tabel + q, { method: 'post',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, payload: baris });
}
function yehSbHapus_(tabel, kueri) {
  yehSbFetch_('/rest/v1/' + tabel + '?' + kueri, { method: 'delete', headers: { Prefer: 'return=minimal' } });
}
function yehSbMeta_(obj) {
  const baris = Object.keys(obj).map(function (k) {
    return { kunci: k, nilai: String(obj[k]), diperbarui: new Date().toISOString() };
  });
  try { yehSbUpsert_('reg_meta', baris, 'kunci'); } catch (e) { console.warn('reg_meta gagal: ' + e); }
}

/* ---------- Pencerminan ---------- */

/** Naskah untuk pencarian. Mengikuti yehSearch_ persis: satu naskah berlaku
 *  (atau naskah dasar bila berlaku kosong), bukan gabungan semua kolom —
 *  supaya kutipan yang muncul selalu berasal dari naskah yang dicocokkan. */
function yehTeksCari_(r) {
  const t = r.t || {};
  const txt = String(t.utuh || t.dasar || '');
  return txt.replace(/\s+/g, ' ').trim().toLowerCase();
}

function yehCerminRegulasi_(reg) {
  const d = yehSource_(reg), rev = d.rev;
  yehSbUpsert_('reg_regulasi', [{
    id_regulasi: reg.ID_Regulasi,
    judul: reg.Nama_Regulasi || reg.Nama_Sheet,
    kelompok: reg.Kelompok || '',
    rev: rev,
    terbatas: yehNorm_(reg.Akses_Dokumen) === 'terbatas',
    versi_default: d.defaultVersion || 'utuh',
    versi_tersedia: d.versions || [],
    jumlah_baris: d.rows.length,
    diperbarui: new Date().toISOString()
  }], 'id_regulasi');

  // BAB dan Pasal diisi-turun di sini, bukan di sisi pembaca, supaya pencarian
  // di Postgres tidak perlu menelusuri baris di atasnya.
  let bab = '', pasal = '', total = 0;
  let batch = [];
  const kirim = function () {
    if (!batch.length) return;
    yehSbUpsert_('reg_baris', batch, 'id_regulasi,baris');
    total += batch.length;
    batch = [];
  };
  d.rows.forEach(function (r) {
    if (r.bab && r.bab !== bab) { bab = r.bab; pasal = ''; }
    if (r.pasal) pasal = r.pasal;
    batch.push({
      id_regulasi: reg.ID_Regulasi, baris: r.row, rev: rev,
      bab: r.bab || '', pasal: r.pasal || '', ayat: r.ayat || '',
      poin: r.poin || '', subpoin: r.subpoin || '',
      bab_berlaku: bab, pasal_berlaku: pasal,
      t: r.t || {}, sama: !!r.sama,
      teks_cari: yehTeksCari_(r)
    });
    if (batch.length >= 400) kirim();
  });
  kirim();

  // Sisipkan dulu, hapus yang basi kemudian: tidak ada jeda ketika regulasi
  // kosong di cermin.
  yehSbHapus_('reg_baris', 'id_regulasi=eq.' + encodeURIComponent(reg.ID_Regulasi) +
    '&rev=neq.' + encodeURIComponent(rev));
  return { id: reg.ID_Regulasi, nama: reg.Nama_Sheet, baris: total, rev: rev };
}

/** Aturan akses. Disisipkan lebih dahulu, baru yang sudah tidak ada dihapus —
 *  urutan itu menjaga agar tidak pernah ada saat di mana aturan TOLAK hilang
 *  sementara barisnya masih terbaca. */
function yehCerminAturan_() {
  const baris = yehObjRows_('Cfg_Akses')
    .filter(function (x) { return x.ID_Regulasi && yehNorm_(x.Aktif) !== 'tidak'; })
    .map(function (x) {
      return { id_regulasi: String(x.ID_Regulasi).trim(),
        tipe_subjek: String(x.Tipe_Subjek).trim().toUpperCase(),
        id_subjek: String(x.ID_Subjek).trim(),
        efek: String(x.Efek).trim().toUpperCase() };
    })
    .filter(function (x) { return x.id_subjek && (x.efek === 'IZIN' || x.efek === 'TOLAK'); });

  const jauh = yehSbFetch_('/rest/v1/reg_aturan?select=id_regulasi,tipe_subjek,id_subjek') || [];
  yehSbUpsert_('reg_aturan', baris, 'id_regulasi,tipe_subjek,id_subjek');

  const ada = {};
  baris.forEach(function (b) { ada[[b.id_regulasi, b.tipe_subjek, b.id_subjek].join('\u0001')] = true; });
  jauh.forEach(function (r) {
    const k = [String(r.id_regulasi), String(r.tipe_subjek).toUpperCase(), String(r.id_subjek)].join('\u0001');
    if (ada[k]) return;
    yehSbHapus_('reg_aturan',
      'id_regulasi=eq.' + encodeURIComponent(r.id_regulasi) +
      '&tipe_subjek=eq.' + encodeURIComponent(r.tipe_subjek) +
      '&id_subjek=eq.' + encodeURIComponent(r.id_subjek));
  });
  return baris.length;
}

/** Rekonsiliasi penuh. Aman dijalankan ulang dan aman terpotong di tengah:
 *  setiap regulasi dicerminkan utuh satu per satu, jadi yang belum terproses
 *  hanya tertinggal versi lamanya, tidak menjadi separuh. */
function yehCerminRekonsiliasi_() {
  if (!yehSbSiap_()) throw Error('Isi REG_SB_URL dan REG_SB_SERVICE_KEY pada Script Properties lebih dahulu.');
  const regs = yehRegAll_();

  // Isi penanda revisi untuk sheet yang belum punya, supaya penanda global
  // berhenti dipakai mulai sekarang.
  regs.forEach(function (r) {
    if (!yehRevMap_()[yehNorm_(r.Nama_Sheet)]) yehSetSheetRev_(r.Nama_Sheet, Date.now());
  });

  const jumlahAturan = yehCerminAturan_();
  const hasil = [];
  regs.forEach(function (r) {
    try { hasil.push(yehCerminRegulasi_(r)); }
    catch (e) { hasil.push({ id: r.ID_Regulasi, nama: r.Nama_Sheet, galat: String((e && e.message) || e) }); }
  });

  // Regulasi yang sudah tidak aktif dibuang dari cermin, bukan dibiarkan.
  const aktif = {};
  regs.forEach(function (r) { aktif[r.ID_Regulasi] = true; });
  try {
    (yehSbFetch_('/rest/v1/reg_regulasi?select=id_regulasi') || []).forEach(function (x) {
      if (!aktif[x.id_regulasi]) yehSbHapus_('reg_regulasi', 'id_regulasi=eq.' + encodeURIComponent(x.id_regulasi));
    });
  } catch (e) { console.warn('Pembersihan regulasi nonaktif gagal: ' + e); }

  yehPropSet_(YEH_P_KOTOR_, '{}');
  yehSbMeta_({ cermin_terakhir: new Date().toISOString(), versi_kode: YEH_VERSION,
    pemicu_sumber: yehPemicuSumberTerpasang_() ? 'YA' : 'TIDAK' });
  return { regulasi: hasil, aturan: jumlahAturan };
}

function yehCerminKeepAlive_() {
  if (!yehSbSiap_()) return false;
  try {
    yehSbFetch_('/rest/v1/reg_meta?select=kunci&limit=1');
    yehSbMeta_({ keep_alive_terakhir: new Date().toISOString() });
    return true;
  } catch (e) { console.error('Keep-alive cermin gagal: ' + e); return false; }
}

/** Dorongan cermin TIDAK BOLEH menggagalkan penyimpanan ke Spreadsheet.
 *  Spreadsheet adalah sumber kebenaran; cermin menyusul. Bila Supabase sedang
 *  tidur atau belum disetel, penyimpanan tetap berhasil dan web memakai jalur
 *  Apps Script sampai rekonsiliasi berikutnya menyusulkan isinya. */
function yehCerminCoba_(fn) {
  if (!yehSbSiap_()) return false;
  try { fn(); return true; }
  catch (e) { console.error('Cermin tertunda: ' + e); return false; }
}

/* ---------- Dorongan saat berubah ---------- */

/** Dipanggil pemicu sumber dan jalur simpan. Penanda revisi SELALU dinaikkan;
 *  dorongannya boleh tertunda. Itu yang membuat data tidak pernah salah:
 *  penanda di /exec sudah berubah, sehingga web melihat cermin ketinggalan dan
 *  memakai jalur cadangan untuk regulasi itu saja. */
function yehTandaiSheetBerubah_(namaSheet) {
  const nama = String(namaSheet || '').trim();
  if (!nama) return;
  yehSetSheetRev_(nama, Date.now());
  // Tidak ada cache yang perlu dibersihkan: kunci cache naskah memuat rev,
  // jadi menaikkan rev sudah membuat entri lama tidak pernah terpakai lagi.

  const kotor = yehPropObj_(YEH_P_KOTOR_);
  kotor[yehNorm_(nama)] = nama;
  yehPropSet_(YEH_P_KOTOR_, JSON.stringify(kotor));

  if (!yehSbSiap_()) return;
  const dorong = yehPropObj_(YEH_P_DORONG_);
  const lalu = Number(dorong[yehNorm_(nama)] || 0);
  if (Date.now() - lalu < YEH_DORONG_JEDA_MS_) return;   // rentetan suntingan ditahan
  yehDorongSheet_(nama);
}

function yehDorongSheet_(nama) {
  const reg = yehRegAll_().find(function (r) { return yehNorm_(r.Nama_Sheet) === yehNorm_(nama); });
  if (!reg) return false;
  try {
    yehCerminRegulasi_(reg);
    const dorong = yehPropObj_(YEH_P_DORONG_);
    dorong[yehNorm_(nama)] = Date.now();
    yehPropSet_(YEH_P_DORONG_, JSON.stringify(dorong));
    const kotor = yehPropObj_(YEH_P_KOTOR_);
    delete kotor[yehNorm_(nama)];
    yehPropSet_(YEH_P_KOTOR_, JSON.stringify(kotor));
    return true;
  } catch (e) { console.error('Dorong cermin "' + nama + '" gagal: ' + e); return false; }
}

/** Penyapu: membereskan sheet yang sempat ditahan jeda dorongan. Tidak
 *  melakukan apa pun bila tidak ada yang kotor, jadi biayanya hampir nol dan
 *  kuota pemicu tidak terkuras. */
function yehSapuSheetKotor_() {
  if (!yehSbSiap_()) return 0;
  const kotor = yehPropObj_(YEH_P_KOTOR_);
  const nama = Object.keys(kotor);
  if (!nama.length) return 0;
  let n = 0;
  nama.slice(0, 6).forEach(function (k) { if (yehDorongSheet_(kotor[k])) n++; });
  return n;
}

/* ---------- Pemicu ---------- */

const YEH_PEMICU_ = {
  sunting: 'yehPemicuSuntingSumber',
  ubah: 'yehPemicuUbahSumber',
  sapu: 'yehPemicuSapu',
  rekonsiliasi: 'yehPemicuRekonsiliasi',
  keepAlive: 'yehPemicuKeepAlive'
};

function yehPemicuSumberTerpasang_() {
  const nama = [YEH_PEMICU_.sunting, YEH_PEMICU_.ubah];
  return ScriptApp.getProjectTriggers().some(function (t) { return nama.indexOf(t.getHandlerFunction()) >= 0; });
}
function yehDaftarPemicu_() {
  return ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
}

/** Memasang ulang semua pemicu. Dijalankan dari menu spreadsheet, bukan
 *  otomatis — memasang pemicu meminta izin dan itu keputusan admin. */
function yehPasangPemicu_() {
  const src = yehSourceSpreadsheet_().getId();
  const milik = [];
  Object.keys(YEH_PEMICU_).forEach(function (k) { milik.push(YEH_PEMICU_[k]); });
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (milik.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(YEH_PEMICU_.sunting).forSpreadsheet(src).onEdit().create();
  ScriptApp.newTrigger(YEH_PEMICU_.ubah).forSpreadsheet(src).onChange().create();
  ScriptApp.newTrigger(YEH_PEMICU_.sapu).timeBased().everyMinutes(10).create();
  // Dua lapis di jam berbeda: pemicu bisa mati tanpa memberi tahu.
  ScriptApp.newTrigger(YEH_PEMICU_.rekonsiliasi).timeBased().atHour(2).everyDays(1).create();
  ScriptApp.newTrigger(YEH_PEMICU_.keepAlive).timeBased().atHour(14).everyDays(1).create();
  yehSbMeta_({ pemicu_sumber: 'YA' });
  return yehDaftarPemicu_();
}

function yehPemicuSuntingSumber(e) {
  try {
    const nama = e && e.range ? e.range.getSheet().getName() : '';
    yehTandaiSheetBerubah_(nama);
  } catch (err) { console.error('Pemicu sunting: ' + err); }
}
function yehPemicuUbahSumber(e) {
  try {
    let nama = '';
    try { nama = e && e.source ? e.source.getActiveSheet().getName() : ''; } catch (_) { nama = ''; }
    if (nama) yehTandaiSheetBerubah_(nama);
    else yehBumpCacheGen_();   // tidak diketahui sheet mana; paksa periksa ulang
  } catch (err) { console.error('Pemicu ubah: ' + err); }
}
function yehPemicuSapu() {
  try { yehSapuSheetKotor_(); } catch (err) { console.error('Pemicu sapu: ' + err); }
}
function yehPemicuRekonsiliasi() {
  try { yehCerminRekonsiliasi_(); } catch (err) { console.error('Pemicu rekonsiliasi: ' + err); }
}
function yehPemicuKeepAlive() {
  try { yehCerminKeepAlive_(); } catch (err) { console.error('Pemicu keep-alive: ' + err); }
}
