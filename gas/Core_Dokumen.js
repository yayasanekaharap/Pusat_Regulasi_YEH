/**
 * Dokumen asli (tautan PDF/Drive/Docs/situs per regulasi) dan penanda pasal per pengguna.
 * Sheet: Cfg_Dokumen_Asli dan Cfg_Penanda (dibuat sekali oleh RevisiDataV1_4_0).
 */
const YEH_DOC_SHEET_ = 'Cfg_Dokumen_Asli';
const YEH_MARK_SHEET_ = 'Cfg_Penanda';
const YEH_SHEET_MISSING_ = ' belum ada. Jalankan berkas RevisiDataV1_4_0 sesuai PANDUAN.';

/* ---------- Pengenalan tautan ---------- */

function yehLinkId_(url) {
  const u = String(url || '');
  let m = u.match(/docs\.google\.com\/(?:document|spreadsheets|presentation|forms)\/d\/([\w-]+)/);
  if (m) return m[1];
  m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]+)/);
  if (m) return m[1];
  m = u.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)/);
  return m ? m[1] : '';
}

function yehTypeFromMime_(mime) {
  const m = String(mime || '');
  if (m === 'application/pdf') return 'PDF';
  if (/msword|wordprocessingml|opendocument\.text/.test(m)) return 'WORD';
  if (/ms-excel|spreadsheetml|opendocument\.spreadsheet|text\/csv/.test(m)) return 'EXCEL';
  if (/powerpoint|presentationml/.test(m)) return 'PPT';
  if (/^image\//.test(m)) return 'GAMBAR';
  if (m === 'application/vnd.google-apps.document') return 'GDOC';
  if (m === 'application/vnd.google-apps.spreadsheet') return 'GSHEET';
  if (m === 'application/vnd.google-apps.presentation') return 'GSLIDE';
  if (m === 'application/vnd.google-apps.form') return 'GFORM';
  if (m === 'application/vnd.google-apps.folder') return 'FOLDER';
  return 'BERKAS';
}

function yehTypeFromUrl_(url) {
  const u = String(url || '').toLowerCase();
  let m = u.match(/docs\.google\.com\/(document|spreadsheets|presentation|forms)\//);
  if (m) return { document: 'GDOC', spreadsheets: 'GSHEET', presentation: 'GSLIDE', forms: 'GFORM' }[m[1]];
  if (/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(u)) return 'FOLDER';
  if (/drive\.google\.com\//.test(u)) return 'DRIVE';
  const path = u.split(/[?#]/)[0];
  if (/\.pdf$/.test(path)) return 'PDF';
  if (/\.(docx?|odt|rtf)$/.test(path)) return 'WORD';
  if (/\.(xlsx?|ods|csv)$/.test(path)) return 'EXCEL';
  if (/\.(pptx?|odp)$/.test(path)) return 'PPT';
  if (/\.(png|jpe?g|gif|webp)$/.test(path)) return 'GAMBAR';
  return 'WEB';
}

/** Mengenali jenis, nama, ukuran, dan status berbagi. Berkas Drive dibaca lewat izin Drive akun pemilik skrip. */
function yehDetectLink_(url) {
  const u = String(url || '').trim();
  if (!/^https:\/\/\S+$/i.test(u)) throw Error('Tautan harus diawali https:// dan tanpa spasi: ' + u);
  const out = { type: yehTypeFromUrl_(u), name: '', size: 0, sharing: '' };
  const id = yehLinkId_(u);
  if (!id) return out;
  try {
    if (out.type === 'FOLDER') {
      const f = DriveApp.getFolderById(id);
      out.name = f.getName(); out.sharing = String(f.getSharingAccess());
    } else {
      const f = DriveApp.getFileById(id);
      out.name = f.getName(); out.type = yehTypeFromMime_(f.getMimeType()); out.size = f.getSize() || 0;
      out.sharing = String(f.getSharingAccess());
    }
  } catch (e) { out.sharing = 'TIDAK_TERJANGKAU'; }
  return out;
}

/* ---------- Data dokumen asli ---------- */

function yehDocItem_(r) {
  return { title: r.Judul || r.Nama_Berkas || 'Dokumen asli', url: r.URL, type: r.Jenis || yehTypeFromUrl_(r.URL),
    name: r.Nama_Berkas || '', size: yehNum_(r._raw.Ukuran), sharing: r.Berbagi || '', fileId: yehLinkId_(r.URL) };
}
/** {ID_Regulasi: [item]} — includeInactive hanya untuk admin. */
function yehOrigDocsByReg_(includeInactive) {
  const map = {};
  yehObjRowsOpt_(YEH_DOC_SHEET_)
    .filter(function (r) { return r.URL && (includeInactive || yehNorm_(r.Aktif) !== 'tidak'); })
    .sort(function (a, b) { return yehNum_(a._raw.Urutan) - yehNum_(b._raw.Urutan); })
    .forEach(function (r) { (map[r.ID_Regulasi] = map[r.ID_Regulasi] || []).push(yehDocItem_(r)); });
  return map;
}
/** Tautan lama di kolom Link_PDF tetap tampil selama belum dipindah ke Cfg_Dokumen_Asli. */
function yehLegacyDocs_(r) {
  const u = String(r.Link_PDF || '').trim();
  return u ? [{ title: 'Dokumen asli', url: u, type: yehTypeFromUrl_(u), name: '', size: 0, sharing: '', fileId: yehLinkId_(u) }] : [];
}

/** Menyimpan daftar tautan satu regulasi. Deteksi dilakukan sebelum kunci; dipanggil dengan items yang sudah dideteksi. */
function yehPrepareDocs_(regId, items) {
  if (!yehSheetOpt_(YEH_DOC_SHEET_)) throw Error('Sheet ' + YEH_DOC_SHEET_ + YEH_SHEET_MISSING_);
  const old = {};
  yehObjRows_(YEH_DOC_SHEET_).filter(function (r) { return r.ID_Regulasi === regId; })
    .forEach(function (r) { old[String(r.URL).trim()] = r; });
  const seen = {};
  return items.map(function (it) {
    const url = String(it.url || '').trim(), title = String(it.title || '').trim();
    if (!url) return null;
    if (seen[url]) throw Error('Tautan ganda: ' + url);
    seen[url] = true;
    const prev = old[url];
    const meta = prev && prev.Jenis && !it.recheck ? { type: prev.Jenis, name: prev.Nama_Berkas, size: yehNum_(prev._raw.Ukuran), sharing: prev.Berbagi } : yehDetectLink_(url);
    return { url: url, title: title || meta.name || 'Dokumen asli', meta: meta };
  }).filter(Boolean);
}
function yehWriteDocs_(regId, prepared) { // di dalam kunci
  const rows = yehObjRows_(YEH_DOC_SHEET_).filter(function (r) { return r.ID_Regulasi === regId; });
  const keep = {};
  prepared.forEach(function (it, i) {
    keep[it.url] = true;
    const vals = { Judul: it.title, Jenis: it.meta.type, Nama_Berkas: it.meta.name || '', Ukuran: it.meta.size || 0,
      Berbagi: it.meta.sharing || '', Urutan: i + 1, Aktif: 'YA' };
    const ex = rows.find(function (r) { return String(r.URL).trim() === it.url; });
    if (ex) yehPatch_(YEH_DOC_SHEET_, ex._row, vals);
    else yehAppendObj_(YEH_DOC_SHEET_, Object.assign({ ID_Regulasi: regId, URL: it.url }, vals));
  });
  rows.forEach(function (r) {
    if (!keep[String(r.URL).trim()] && yehNorm_(r.Aktif) !== 'tidak') yehPatch_(YEH_DOC_SHEET_, r._row, { Aktif: 'TIDAK' });
  });
}

/** Admin: periksa ulang jenis & status berbagi semua tautan aktif. */
function yehAdminRecheckDocs_(user) {
  yehAdmin_(user);
  if (!yehSheetOpt_(YEH_DOC_SHEET_)) throw Error('Sheet ' + YEH_DOC_SHEET_ + YEH_SHEET_MISSING_);
  const rows = yehObjRows_(YEH_DOC_SHEET_).filter(function (r) { return r.URL && yehNorm_(r.Aktif) !== 'tidak'; });
  const metas = rows.map(function (r) { return yehDetectLink_(r.URL); });
  yehWithLock_(function () {
    rows.forEach(function (r, i) {
      yehPatch_(YEH_DOC_SHEET_, r._row, { Jenis: metas[i].type, Nama_Berkas: metas[i].name || '', Ukuran: metas[i].size || 0, Berbagi: metas[i].sharing || '' });
    });
  });
  const warn = metas.filter(function (m) { return ['PRIVATE', 'TIDAK_TERJANGKAU'].indexOf(m.sharing) >= 0; }).length;
  yehAudit_('RECHECK_DOCS', user.id, 'n=' + rows.length);
  return { checked: rows.length, warnings: warn, admin: yehAdminData_() };
}

/* ---------- Penanda pasal ---------- */

function yehUserBookmarks_(uid) {
  const n = yehNorm_(uid);
  return yehObjRowsOpt_(YEH_MARK_SHEET_)
    .filter(function (r) { return yehNorm_(r.User_ID) === n && yehNorm_(r.Aktif) !== 'tidak'; })
    .map(function (r) { return { id: r.ID_Regulasi, row: yehNum_(r._raw.Baris), label: r.Label || '', time: yehDateIso_(r._raw.Waktu) }; })
    .sort(function (a, b) { return a.time < b.time ? 1 : -1; });
}

function yehBookmarkSave_(user, p) {
  if (!yehSheetOpt_(YEH_MARK_SHEET_)) throw Error('Fitur penanda belum aktif: sheet ' + YEH_MARK_SHEET_ + YEH_SHEET_MISSING_);
  const reg = yehRegAll_().find(function (r) { return r.ID_Regulasi === p.id; });
  if (!reg || !yehAccess_(user, reg)) throw Error('Dokumen tidak ditemukan atau Anda tidak memiliki akses.');
  const row = Math.floor(Number(p.row) || 0);
  if (row < 2) throw Error('Pasal tidak valid.');
  const on = !!p.on, label = String(p.label || '').slice(0, 200), n = yehNorm_(user.id);
  yehWithLock_(function () {
    const ex = yehObjRows_(YEH_MARK_SHEET_).find(function (r) {
      return yehNorm_(r.User_ID) === n && r.ID_Regulasi === p.id && yehNum_(r._raw.Baris) === row;
    });
    if (ex) yehPatch_(YEH_MARK_SHEET_, ex._row, { Aktif: on ? 'YA' : 'TIDAK', Label: label || ex.Label, Waktu: new Date() });
    else if (on) yehAppendObj_(YEH_MARK_SHEET_, { User_ID: user.id, ID_Regulasi: p.id, Baris: row, Label: label, Waktu: new Date(), Aktif: 'YA' });
  });
  return { bookmarks: yehUserBookmarks_(user.id) };
}
