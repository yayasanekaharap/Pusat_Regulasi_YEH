/** Pembaca sheet berdasarkan HEADER (bukan nomor kolom), memo per eksekusi, cache naskah, dan data untuk pembaca. */

const YEH_MEMO_ = {};
const YEH_DOC_TTL_ = 1800; // detik; cache naskah sumber

function yehSs_() { if (!YEH_MEMO_.ss) YEH_MEMO_.ss = SpreadsheetApp.getActiveSpreadsheet(); return YEH_MEMO_.ss; }
function yehSheet_(n) { const sh = yehSs_().getSheetByName(n); if (!sh) throw Error('Sheet tidak ditemukan: ' + n); return sh; }
function yehNorm_(s) { return String(s == null ? '' : s).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '); }

function yehTable_(name) {
  const key = 't:' + name;
  if (YEH_MEMO_[key]) return YEH_MEMO_[key];
  const sh = yehSheet_(name);
  const rng = sh.getDataRange();
  const v = rng.getDisplayValues(), raw = rng.getValues();
  let t;
  if (!v.length) t = { headers: [], rows: [], sheet: sh };
  else {
    const h = v[0].map(function (x) { return String(x).trim(); });
    const seen = {};
    h.forEach(function (x) { if (x) { const k = yehNorm_(x); if (seen[k]) throw Error('Header ganda di sheet ' + name + ': ' + x); seen[k] = true; } });
    t = { headers: h, sheet: sh, rows: v.slice(1).map(function (r, i) { return { row: i + 2, values: r, raw: raw[i + 1] }; }) };
  }
  YEH_MEMO_[key] = t;
  return t;
}
function yehForget_(name) { delete YEH_MEMO_['t:' + name]; }
function yehSheetOpt_(n) { return yehSs_().getSheetByName(n); }
function yehObjRowsOpt_(name) { return yehSheetOpt_(name) ? yehObjRows_(name) : []; }
function yehDateIso_(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }
function yehMap_(h) { const m = {}; h.forEach(function (x, i) { if (x) m[yehNorm_(x)] = i; }); return m; }
function yehAt_(r, m, name) { const n = m[yehNorm_(name)]; return n === undefined ? '' : (r.values[n] || ''); }

function yehObjRows_(name) {
  const t = yehTable_(name);
  return t.rows.filter(function (r) { return r.values.some(Boolean); }).map(function (r) {
    const o = { _row: r.row, _raw: {} };
    t.headers.forEach(function (h, i) { if (h) { o[h] = r.values[i]; o._raw[h] = r.raw[i]; } });
    return o;
  });
}
function yehFindObj_(name, key, val) { return yehObjRows_(name).find(function (o) { return String(o[key]).trim() === String(val).trim(); }); }

/** Menambah baris dengan mencocokkan nama header; kolom lain dibiarkan kosong. */
function yehAppendObj_(name, obj) {
  const sh = yehSheet_(name);
  const heads = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const m = yehMap_(heads);
  const row = heads.map(function () { return ''; });
  Object.keys(obj).forEach(function (k) {
    const i = m[yehNorm_(k)];
    if (i === undefined) throw Error('Kolom ' + k + ' tidak ditemukan di sheet ' + name + '.');
    row[i] = obj[k];
  });
  sh.appendRow(row);
  yehForget_(name);
}

function yehHeadAt_(h, aliases) { const n = h.map(yehNorm_); for (const a of aliases) { const i = n.indexOf(yehNorm_(a)); if (i >= 0) return i; } return -1; }
function yehHeadLast_(h, aliases) { const n = h.map(yehNorm_); for (const a of aliases) { const i = n.lastIndexOf(yehNorm_(a)); if (i >= 0) return i; } return -1; }

/* ---------- Cache (CacheService dipecah per ±30 ribu karakter) ---------- */

function yehCacheGen_() {
  if (!YEH_MEMO_.gen) YEH_MEMO_.gen = PropertiesService.getScriptProperties().getProperty('CACHE_GEN') || '1';
  return YEH_MEMO_.gen;
}
function yehBumpCacheGen_() {
  const g = String(Number(yehCacheGen_()) + 1);
  PropertiesService.getScriptProperties().setProperty('CACHE_GEN', g);
  YEH_MEMO_.gen = g;
  return g;
}
function yehCacheGet_(key) {
  try {
    const c = CacheService.getScriptCache();
    const n = Number(c.get(key) || 0);
    if (!n) return null;
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(key + ':' + i);
    const parts = c.getAll(keys);
    let s = '';
    for (const k of keys) { if (parts[k] == null) return null; s += parts[k]; }
    return JSON.parse(s);
  } catch (e) { return null; }
}
function yehCachePut_(key, obj, ttl) {
  try {
    const s = JSON.stringify(obj), size = 30000, map = {};
    let n = 0;
    for (let i = 0; i < s.length; i += size) { map[key + ':' + n] = s.slice(i, i + size); n++; }
    if (n > 400) return;
    map[key] = String(n);
    CacheService.getScriptCache().putAll(map, ttl || YEH_DOC_TTL_);
  } catch (e) { console.warn('Cache gagal: ' + e); }
}

/* ---------- Versi pustaka (otomatis berubah bila sheet sumber diedit) ---------- */

function yehSrcUpdated_() {
  if (YEH_MEMO_.srcUpd != null) return YEH_MEMO_.srcUpd;
  const c = CacheService.getScriptCache();
  let v = null;
  try { v = c.get('srcupd'); } catch (_) {}
  if (!v) {
    try {
      const m = yehConfig_('SPREADSHEET_REGULASI_URL').match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      v = m ? String(DriveApp.getFileById(m[1]).getLastUpdated().getTime()) : '0';
    } catch (e) { v = '0'; }
    try { c.put('srcupd', v, 60); } catch (_) {}
  }
  YEH_MEMO_.srcUpd = v;
  return v;
}
function yehLibRev_() { return yehCacheGen_() + '.' + yehSrcUpdated_(); }

/**
 * Penanda revisi satu regulasi.
 *
 * Sebelum v1.5.0 penanda ini memuat yehLibRev_(), yang di dalamnya ada waktu
 * ubah SELURUH spreadsheet sumber. Akibatnya satu suntingan di satu sheet
 * mengubah penanda ke-17 regulasi sekaligus, membatalkan cache naskah di
 * server, dan memaksa setiap pengguna mengunduh ulang seluruh pustaka.
 * Sekarang yang dipakai adalah penanda sheet itu sendiri (yehSheetRev_),
 * sehingga suntingan hanya menyentuh regulasi yang memang berubah.
 */
function yehRegRev_(reg) {
  return yehHash_([yehCacheGen_(), yehSheetRev_(reg.Nama_Sheet), reg.Nama_Sheet,
    reg.Header_Dasar, reg.Header_Format_Utuh].join('|')).slice(0, 12);
}

/** Dua naskah dianggap sama hanya bila persis sama. Tidak ada penormalan,
 *  supaya tidak ada satu karakter pun yang hilang karena dianggap kembar. */
function yehSamaTeks_(a, b) { return String(a) === String(b); }

/* ---------- Regulasi & hak akses ---------- */

function yehRegAll_() { return yehObjRows_('Cfg_Regulasi').filter(function (r) { return yehNorm_(r.Aktif) !== 'tidak'; }); }

function yehAccess_(user, reg) {
  if (user.role === 'ADMIN') return true;
  const a = yehObjRows_('Cfg_Akses').filter(function (x) { return x.ID_Regulasi === reg.ID_Regulasi && yehNorm_(x.Aktif) !== 'tidak'; });
  const restricted = yehNorm_(reg.Akses_Dokumen) === 'terbatas';
  if (!restricted && !a.length) return true;
  const groups = (user.groups || []).map(yehNorm_);
  const matched = a.filter(function (x) {
    return (yehNorm_(x.Tipe_Subjek) === 'user' && yehNorm_(x.ID_Subjek) === yehNorm_(user.id)) ||
      (yehNorm_(x.Tipe_Subjek) === 'grup' && groups.indexOf(yehNorm_(x.ID_Subjek)) >= 0);
  });
  if (matched.some(function (x) { return yehNorm_(x.Efek) === 'tolak'; })) return false; // TOLAK selalu menang
  return restricted ? matched.some(function (x) { return yehNorm_(x.Efek) === 'izin'; }) : true;
}
function yehVisibleRegs_(user) { return yehRegAll_().filter(function (r) { return yehAccess_(user, r); }); }

function yehMetadata_(r, links) {
  return { id: r.ID_Regulasi, title: r.Nama_Regulasi || r.Nama_Sheet, group: r.Kelompok, rev: yehRegRev_(r),
    restricted: yehNorm_(r.Akses_Dokumen) === 'terbatas', verification: r.Tanggal_Verifikasi || '', notes: r.Catatan || '',
    docs: (links && links[r.ID_Regulasi]) || yehLegacyDocs_(r) };
}

function yehInit_(user) {
  const links = yehOrigDocsByReg_(false);
  return {
    version: YEH_VERSION,
    libRev: yehLibRev_(),
    // Kunci sesi untuk ditukar di Edge Function regulasi-sesi. Kosong bila
    // REG_TOKEN_SECRET belum diisi — web lalu memakai jalur /exec saja.
    sbKey: yehKunciCermin_(user),
    cermin: yehSbSiap_(),
    user: yehPublicUser_(user),
    regulations: yehVisibleRegs_(user).map(function (r) { return yehMetadata_(r, links); }),
    bookmarks: yehUserBookmarks_(user.id),
    groups: yehObjRows_('Cfg_Kelompok').filter(function (x) { return yehNorm_(x.Aktif) !== 'tidak'; })
      .map(function (x) { return { id: x.ID_Kelompok, name: x.Nama_Kelompok || x.ID_Kelompok }; })
  };
}

/* ---------- Naskah sumber ---------- */

function yehSource_(reg) {
  const rev = yehRegRev_(reg);
  const ck = 'doc:' + rev + ':' + reg.ID_Regulasi;
  const hit = yehCacheGet_(ck);
  if (hit) return hit;

  const t = yehSourceTable_(reg.Nama_Sheet), headers = t.headers;
  const roles = {
    bab: yehHeadAt_(headers, ['BAB']), pasal: yehHeadAt_(headers, ['Pasal']), ayat: yehHeadAt_(headers, ['Ayat']),
    poin: yehHeadAt_(headers, ['Poin', 'Huruf']), subpoin: yehHeadAt_(headers, ['Subpoin', 'Sub poin', 'Angka'])
  };
  const roleIdx = Object.keys(roles).map(function (k) { return roles[k]; }).filter(function (i) { return i >= 0; });
  const maxRole = roleIdx.length ? Math.max.apply(null, roleIdx) : -1;

  // Kolom naskah berlaku: header eksplisit (kemunculan terakhir) → "Format utuh" → kolom terakhir yang berjudul.
  let finalIndex = yehNorm_(reg.Header_Format_Utuh)
    ? yehHeadLast_(headers, [reg.Header_Format_Utuh])
    : yehHeadLast_(headers, ['Format utuh', 'Format lengkap', 'Teks konsolidasi']);
  if (finalIndex < 0 && yehNorm_(reg.Header_Format_Utuh))
    throw Error('Kolom "' + reg.Header_Format_Utuh + '" tidak ditemukan di sheet "' + reg.Nama_Sheet + '". Periksa Header_Format_Utuh pada Cfg_Regulasi.');
  if (finalIndex < 0) for (let i = headers.length - 1; i > maxRole; i--) if (headers[i]) { finalIndex = i; break; }
  if (finalIndex < 0) throw Error('Sheet "' + reg.Nama_Sheet + '" belum memiliki kolom naskah.');

  let baseIndex = yehNorm_(reg.Header_Dasar) ? yehHeadAt_(headers, [reg.Header_Dasar])
    : headers.findIndex(function (h, i) { return i > maxRole && i !== finalIndex && h; });
  if (baseIndex < 0 && yehNorm_(reg.Header_Dasar))
    throw Error('Kolom "' + reg.Header_Dasar + '" tidak ditemukan di sheet "' + reg.Nama_Sheet + '". Periksa Header_Dasar pada Cfg_Regulasi.');

  const cols = [{ key: 'utuh', name: 'Naskah berlaku', detail: headers[finalIndex], index: finalIndex }];
  if (baseIndex >= 0 && baseIndex !== finalIndex) cols.push({ key: 'dasar', name: headers[baseIndex], index: baseIndex });
  headers.forEach(function (h, i) {
    if (h && i > maxRole && i !== finalIndex && i !== baseIndex && roleIdx.indexOf(i) < 0) cols.push({ key: 'k' + i, name: h, index: i });
  });

  const rows = [];
  t.rows.forEach(function (r) {
    const v = r.values;
    if (!v.some(Boolean)) return;
    const o = { row: r.row };
    Object.keys(roles).forEach(function (k) { const i = roles[k]; if (i >= 0 && v[i]) o[k] = String(v[i]).trim(); });
    const tx = {};
    cols.forEach(function (c) { if (v[c.index]) tx[c.key] = v[c.index]; });
    // Pada sebagian besar baris, kolom naskah dasar isinya persis sama dengan
    // kolom naskah berlaku. Yang kembar dikirim sekali saja beserta penandanya;
    // sisi web memulihkannya saat render. Ini memotong muatan hampir separuh.
    if (tx.dasar && tx.utuh && yehSamaTeks_(tx.dasar, tx.utuh)) { delete tx.dasar; o.sama = 1; }
    o.t = tx;
    rows.push(o);
  });
  const filled = {};
  rows.forEach(function (r) {
    Object.keys(r.t).forEach(function (k) { filled[k] = true; });
    if (r.sama) filled.dasar = true;   // ada, hanya tidak dikirim dua kali
  });
  const out = {
    rev: rev,
    versions: cols.map(function (c) { return { key: c.key, name: c.name, detail: c.detail || '', filled: !!filled[c.key] }; }),
    defaultVersion: filled.utuh ? 'utuh' : (filled.dasar ? 'dasar' : 'utuh'),
    rows: rows
  };
  yehCachePut_(ck, out);
  return out;
}

function yehDocument_(user, p) {
  const reg = yehRegAll_().find(function (r) { return r.ID_Regulasi === p.id; });
  if (!reg || !yehAccess_(user, reg)) throw Error('Dokumen tidak ditemukan atau Anda tidak memiliki akses.');
  const d = yehSource_(reg);
  return { meta: yehMetadata_(reg, yehOrigDocsByReg_(false)), rev: d.rev, versions: d.versions, defaultVersion: d.defaultVersion, rows: d.rows };
}

/** Unduhan pustaka bertahap untuk salinan di perangkat (maks ±3 MB per permintaan). */
function yehDocs_(user, p) {
  const ids = Array.isArray(p.ids) ? p.ids.slice(0, 40).map(String) : [];
  const regs = yehVisibleRegs_(user), out = {}, pending = [];
  let size = 0;
  ids.forEach(function (id) {
    const reg = regs.find(function (r) { return r.ID_Regulasi === id; });
    if (!reg) return;
    if (size > 3000000) { pending.push(id); return; }
    try { const d = yehSource_(reg); out[id] = d; size += JSON.stringify(d.rows).length; }
    catch (e) { out[id] = { error: String((e && e.message) || e) }; }
  });
  return { docs: out, pending: pending };
}

/** Catatan baca (dipanggil web saat naskah dibuka; dibatasi sekali per 10 menit per naskah di sisi web). */
function yehLogRead_(user, p) {
  const reg = yehRegAll_().find(function (r) { return r.ID_Regulasi === p.id; });
  if (reg && yehAccess_(user, reg)) yehAudit_('READ', user.id, reg.ID_Regulasi);
  return {};
}

/** Pencarian isi: semua kata harus muncul (tidak peka huruf besar/kecil). */
function yehSearch_(user, p) {
  const q = yehNorm_(p.query || '');
  if (q.length < 2) throw Error('Masukkan sedikitnya 2 karakter.');
  const words = q.split(' ').filter(Boolean);
  const limit = Math.min(200, Math.max(1, Number(p.limit) || 120));
  const out = [], skipped = [];
  let truncated = false;
  for (const reg of yehVisibleRegs_(user)) {
    if (p.group && reg.Kelompok !== p.group) continue;
    let d;
    try { d = yehSource_(reg); } catch (e) { skipped.push(reg.Nama_Regulasi || reg.Nama_Sheet); continue; }
    let bab = '', pasal = '';
    for (const row of d.rows) {
      if (row.bab && row.bab !== bab) { bab = row.bab; pasal = ''; }
      if (row.pasal) pasal = row.pasal;
      const txt = String(row.t.utuh || row.t.dasar || '');
      if (!txt) continue;
      const n = yehNorm_(txt);
      if (!words.every(function (w) { return n.indexOf(w) >= 0; })) continue;
      const pos = Math.max(0, txt.toLowerCase().indexOf(words[0]));
      const start = Math.max(0, pos - 110);
      const excerpt = (start > 0 ? '… ' : '') + txt.slice(start, start + 340) + (start + 340 < txt.length ? ' …' : '');
      out.push({ id: reg.ID_Regulasi, title: reg.Nama_Regulasi, group: reg.Kelompok, row: row.row,
        bab: bab, pasal: pasal, ayat: row.ayat || '', poin: row.poin || '', excerpt: excerpt });
      if (out.length >= limit) { truncated = true; break; }
    }
    if (truncated) break;
  }
  return { results: out, truncated: truncated, skipped: skipped };
}
