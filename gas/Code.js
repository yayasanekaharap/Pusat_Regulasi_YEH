/**
 * PUSAT REFERENSI REGULASI YEH — Code.gs
 * Pintu masuk web app (doGet/doPost) dan menu spreadsheet.
 * Web memanggil lewat fetch POST (teks JSON) — pola yang sama dengan aplikasi YEH lainnya.
 */
const YEH_VERSION = '1.5.0';

function doGet(e) {
  return yehOut_({ ok: true, success: true, message: 'API tersedia',
    data: { versiKode: YEH_VERSION, version: YEH_VERSION, service: 'Pusat Regulasi YEH' } });
}

function doPost(e) {
  let data;
  try {
    const raw = String((e && e.postData && e.postData.contents) || '');
    if (raw.length > 200000) throw Error('Permintaan terlalu besar.');
    data = JSON.parse(raw || '{}');
  } catch (err) {
    return yehOut_({ ok: false, success: false, message: 'Permintaan tidak valid.' });
  }
  return yehOut_(yehApi_(data));
}

function yehApi_(data) {
  try {
    data = data || {};
    const action = String(data.action || '');
    let result;
    if (action === 'ping') result = { versiKode: YEH_VERSION, fitur: yehFitur_() };
    else if (action === 'login') result = yehLogin_(data);
    else if (action === 'logout') result = yehLogout_(data);
    else {
      const user = yehRequireSession_(data.token);
      if (user.changeRequired && ['init', 'changePassword', 'logout'].indexOf(action) < 0) {
        const e = Error('Anda wajib mengganti sandi awal terlebih dahulu.'); e.code = 'CHANGE_REQUIRED'; throw e;
      }
      if (action === 'init') result = yehInit_(user);
      else if (action === 'document') result = yehDocument_(user, data);
      else if (action === 'docs') result = yehDocs_(user, data);
      else if (action === 'search') result = yehSearch_(user, data);
      else if (action === 'logRead') result = yehLogRead_(user, data);
      else if (action === 'bookmarkSave') result = yehBookmarkSave_(user, data);
      else if (action === 'changePassword') result = yehChangePassword_(user, data);
      else if (action === 'adminData') result = yehAdminLoad_(user);
      else if (action === 'adminSaveUser') result = yehAdminSaveUser_(user, data);
      else if (action === 'adminResetPassword') result = yehAdminResetPassword_(user, data);
      else if (action === 'adminSaveGroup') result = yehAdminSaveGroup_(user, data);
      else if (action === 'adminSaveRegulation') result = yehAdminSaveRegulation_(user, data);
      else if (action === 'adminSaveAccess') result = yehAdminSaveAccess_(user, data);
      else if (action === 'adminSync') result = yehAdminSync_(user);
      else if (action === 'adminClearCache') result = yehAdminClearCache_(user);
      else if (action === 'adminRecheckDocs') result = yehAdminRecheckDocs_(user);
      else if (action === 'adminActivity') result = yehAdminActivity_(user);
      else throw Error('Tindakan tidak dikenal: ' + action);
    }
    return { ok: true, success: true, data: result, message: 'OK' };
  } catch (err) {
    return { ok: false, success: false, code: String((err && err.code) || ''), message: String((err && err.message) || err) };
  }
}

function yehOut_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Kemampuan backend, diperiksa dari kode yang benar-benar terbit.
 *
 * Angka versi saja berbohong: ia diketik tangan dan berada di berkas lain
 * daripada logikanya, sehingga tetap naik walaupun deployment tidak pernah
 * dinaikkan atau clasp push menuju proyek yang salah. Daftar di bawah
 * menyentuh definisinya sendiri — berkas yang tidak ikut terbit langsung
 * terlihat merah di panel Diagnosa.
 */
function yehFitur_() {
  const ada = function (ambil) {
    try { return typeof ambil() === 'function'; } catch (e) { return false; }
  };
  const nyala = function (ambil) {
    try { return !!ambil(); } catch (e) { return false; }
  };
  return {
    revPerSheet: ada(function () { return yehSheetRev_; }),
    naskahTunggal: ada(function () { return yehSamaTeks_; }),
    cerminKode: ada(function () { return yehCerminRegulasi_; }),
    cerminDisetel: nyala(function () { return yehSbSiap_(); }),
    kunciSesiKode: ada(function () { return yehKunciCermin_; }),
    kunciSesiDisetel: nyala(function () { return yehTokenSiap_(); })
  };
}

/* ---------- Menu spreadsheet (dipakai berulang, bukan skrip data sekali pakai) ---------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Pusat Regulasi')
    .addItem('Atur ulang sandi Admin', 'menuAturUlangSandiAdmin')
    .addItem('Bersihkan cache naskah', 'menuBersihkanCache')
    .addSeparator()
    .addItem('Pasang pemicu cermin', 'menuPasangPemicu')
    .addItem('Segarkan cermin Supabase sekarang', 'menuRekonsiliasiCermin')
    .addSeparator()
    .addItem('Informasi', 'menuInformasi')
    .addToUi();
}

/** Membuat sandi sementara acak untuk akun ADMIN. Sandi hanya tampil sekali di layar ini. */
function menuAturUlangSandiAdmin() {
  const ui = SpreadsheetApp.getUi();
  const ask = ui.prompt('Atur ulang sandi Admin',
    'User ID admin yang akan diatur ulang.\nKosongkan untuk "admin". Bila User ID belum ada, akun admin baru dibuat.',
    ui.ButtonSet.OK_CANCEL);
  if (ask.getSelectedButton() !== ui.Button.OK) return;
  const id = String(ask.getResponseText() || '').trim() || 'admin';
  try {
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(id)) throw Error('User ID 3–40 karakter: huruf, angka, titik, garis bawah, atau tanda minus.');
    const temp = yehTempPassword_();
    const salt = yehSalt_();
    const hash = yehPassHash_(temp, salt);
    const hasil = yehWithLock_(function () {
      const o = yehFindUser_(id);
      if (o) {
        if (String(o.Peran).toUpperCase() !== 'ADMIN') throw Error('Akun "' + o.User_ID + '" bukan admin. Sandi pengguna biasa diatur ulang dari halaman Admin di aplikasi.');
        yehPatch_('Cfg_Pengguna', o._row, { Salt: salt, Password_Hash: hash, Wajib_Ganti_Password: 'YA', Gagal_Login: 0, Kunci_Sampai: 0, Aktif: 'YA' });
        yehInvalidateSessions_(o.User_ID);
        return 'diatur ulang';
      }
      yehAppendObj_('Cfg_Pengguna', { User_ID: id, Nama: 'Administrator', Peran: 'ADMIN', Aktif: 'YA', Salt: salt,
        Password_Hash: hash, Wajib_Ganti_Password: 'YA', Gagal_Login: 0, Kunci_Sampai: 0 });
      return 'dibuat';
    });
    yehAudit_('RESET_ADMIN_MENU', 'EDITOR_SPREADSHEET', id);
    ui.alert('Sandi sementara',
      'Akun admin "' + id + '" ' + hasil + '.\n\nSandi sementara:   ' + temp +
      '\n\nCatat sekarang. Sandi ini tidak disimpan di sheet dan tidak akan ditampilkan lagi.\nSaat masuk pertama kali, aplikasi meminta sandi baru.',
      ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Gagal', String(err && err.message || err), ui.ButtonSet.OK);
  }
}

function menuBersihkanCache() {
  yehBumpCacheGen_();
  const ui = SpreadsheetApp.getUi();
  // Membersihkan cache mengubah penanda revisi semua regulasi, sehingga cermin
  // ikut dianggap basi. Disegarkan sekalian supaya web tidak jatuh ke jalur
  // cadangan untuk seluruh pustaka.
  if (!yehSbSiap_()) {
    ui.alert('Cache naskah dibersihkan. Pembacaan berikutnya mengambil isi terbaru dari spreadsheet sumber.');
    return;
  }
  try {
    const h = yehCerminRekonsiliasi_();
    const galat = h.regulasi.filter(function (x) { return x.galat; });
    ui.alert('Cache naskah dibersihkan dan cermin Supabase disegarkan.\n\n' +
      'Regulasi tercermin: ' + (h.regulasi.length - galat.length) + ' dari ' + h.regulasi.length +
      (galat.length ? '\nGagal: ' + galat.map(function (x) { return x.nama; }).join(', ') : ''));
  } catch (e) {
    ui.alert('Cache naskah dibersihkan, tetapi penyegaran cermin gagal:\n' + String(e && e.message || e) +
      '\n\nWeb tetap berjalan memakai jalur Apps Script.');
  }
}

function menuPasangPemicu() {
  const ui = SpreadsheetApp.getUi();
  try {
    const daftar = yehPasangPemicu_();
    ui.alert('Pemicu terpasang',
      'Pemicu berikut sekarang aktif:\n\n• ' + daftar.join('\n• ') +
      '\n\nSuntingan di spreadsheet sumber kini mendorong perubahannya sendiri ke cermin.',
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Gagal memasang pemicu', String(e && e.message || e), ui.ButtonSet.OK);
  }
}

function menuRekonsiliasiCermin() {
  const ui = SpreadsheetApp.getUi();
  try {
    const h = yehCerminRekonsiliasi_();
    const galat = h.regulasi.filter(function (x) { return x.galat; });
    const baris = h.regulasi.reduce(function (n, x) { return n + (x.baris || 0); }, 0);
    ui.alert('Cermin Supabase disegarkan',
      'Regulasi: ' + (h.regulasi.length - galat.length) + ' dari ' + h.regulasi.length + '\n' +
      'Baris naskah: ' + baris + '\n' +
      'Aturan akses: ' + h.aturan +
      (galat.length ? '\n\nGagal:\n• ' + galat.map(function (x) { return x.nama + ' — ' + x.galat; }).join('\n• ') : ''),
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Gagal menyegarkan cermin', String(e && e.message || e), ui.ButtonSet.OK);
  }
}

function menuInformasi() {
  SpreadsheetApp.getUi().alert('Pusat Referensi Regulasi — versi kode ' + YEH_VERSION +
    '\n\n• Sumber regulasi: isi SPREADSHEET_REGULASI_URL pada sheet Cfg_App.' +
    '\n• Lupa sandi admin: menu Pusat Regulasi › Atur ulang sandi Admin.' +
    '\n• Perubahan isi sheet sumber terbaca otomatis (±1 menit). Bila belum, pakai menu Pusat Regulasi › Bersihkan cache naskah.');
}
