/** Konfigurasi sistem (sheet Cfg_App) dan pembaca spreadsheet sumber regulasi (hanya baca). */

function yehConfig_(key) {
  const o = yehObjRows_('Cfg_App').find(function (r) { return yehNorm_(r.Key) === yehNorm_(key); });
  return o ? String(o.Value || '').trim() : '';
}

function yehSourceSpreadsheet_() {
  if (YEH_MEMO_.src) return YEH_MEMO_.src;
  const url = yehConfig_('SPREADSHEET_REGULASI_URL');
  if (!url) throw Error('Isi SPREADSHEET_REGULASI_URL pada sheet Cfg_App terlebih dahulu.');
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) throw Error('URL spreadsheet regulasi tidak valid. Gunakan URL Google Sheets lengkap.');
  const ss = SpreadsheetApp.openById(m[1]);
  if (ss.getId() === yehSs_().getId()) throw Error('Sumber regulasi harus berupa spreadsheet terpisah dari spreadsheet konfigurasi.');
  YEH_MEMO_.src = ss;
  return ss;
}

/** Judul kolom ganda di sheet sumber tidak lagi menghentikan pembacaan; pemilihan kolom diatur di yehSource_. */
function yehSourceTable_(name) {
  const sh = yehSourceSpreadsheet_().getSheetByName(name);
  if (!sh) throw Error('Sheet regulasi sumber tidak ditemukan: ' + name);
  const v = sh.getDataRange().getDisplayValues();
  if (!v.length) return { headers: [], rows: [] };
  return {
    headers: v[0].map(function (x) { return String(x).trim(); }),
    rows: v.slice(1).map(function (values, i) { return { row: i + 2, values: values }; })
  };
}
