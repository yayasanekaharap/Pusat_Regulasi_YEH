/** Fitur admin: pengguna, kelompok, regulasi, izin dokumen, sinkronisasi manual, dan cache. */

function yehAdminData_() {
  const groupsOf = {};
  yehObjRows_('Cfg_Anggota_Grup').forEach(function (r) {
    if (yehNorm_(r.Aktif) === 'tidak') return;
    const k = yehNorm_(r.User_ID);
    (groupsOf[k] = groupsOf[k] || []).push(r.ID_Kelompok);
  });
  const links = yehOrigDocsByReg_(false);
  return {
    docsReady: !!yehSheetOpt_(YEH_DOC_SHEET_),
    users: yehObjRows_('Cfg_Pengguna').map(function (x) {
      return { id: x.User_ID, name: x.Nama, role: String(x.Peran).toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER',
        active: yehNorm_(x.Aktif) === 'tidak' ? 'TIDAK' : 'YA', groups: groupsOf[yehNorm_(x.User_ID)] || [],
        mustChange: yehNorm_(x.Wajib_Ganti_Password) === 'ya', locked: yehNum_(x._raw.Kunci_Sampai) > Date.now() };
    }),
    groups: yehObjRows_('Cfg_Kelompok').map(function (x) {
      return { id: x.ID_Kelompok, name: x.Nama_Kelompok || x.ID_Kelompok, active: yehNorm_(x.Aktif) === 'tidak' ? 'TIDAK' : 'YA' };
    }),
    regulations: yehObjRows_('Cfg_Regulasi').map(function (r) {
      return { id: r.ID_Regulasi, title: r.Nama_Regulasi, sheet: r.Nama_Sheet, group: r.Kelompok, docs: links[r.ID_Regulasi] || yehLegacyDocs_(r),
        access: yehNorm_(r.Akses_Dokumen) === 'terbatas' ? 'TERBATAS' : 'INTERNAL', active: yehNorm_(r.Aktif) === 'tidak' ? 'TIDAK' : 'YA',
        baseHeader: r.Header_Dasar || '', fullHeader: r.Header_Format_Utuh || '', verification: r.Tanggal_Verifikasi || '', notes: r.Catatan || '' };
    }),
    access: yehObjRows_('Cfg_Akses').map(function (x) {
      return { regulationId: x.ID_Regulasi, subjectType: String(x.Tipe_Subjek).toUpperCase(), subjectId: x.ID_Subjek,
        effect: String(x.Efek).toUpperCase(), active: yehNorm_(x.Aktif) === 'tidak' ? 'TIDAK' : 'YA' };
    })
  };
}
function yehAdminLoad_(user) { yehAdmin_(user); return yehAdminData_(); }
function yehValidGroups_() { return yehObjRows_('Cfg_Kelompok').map(function (x) { return x.ID_Kelompok; }); }

/** Tambah/ubah pengguna. Pengguna baru mendapat sandi sementara acak (tampil sekali kepada admin). */
function yehAdminSaveUser_(user, p) {
  yehAdmin_(user);
  const d = p.user || {}, isNew = !!p.isNew;
  const id = String(d.id || '').trim();
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(id)) throw Error('User ID 3–40 karakter: huruf, angka, titik, garis bawah, atau tanda minus.');
  const name = String(d.name || '').trim() || id;
  const role = d.role === 'ADMIN' ? 'ADMIN' : 'USER';
  const active = d.active === 'TIDAK' ? 'TIDAK' : 'YA';
  const valid = yehValidGroups_();
  const groups = Array.isArray(d.groups) ? d.groups.map(String).filter(function (g, i, a) { return g && a.indexOf(g) === i; }) : null;
  (groups || []).forEach(function (g) { if (valid.indexOf(g) < 0) throw Error('Kelompok tidak ditemukan: ' + g); });
  let temp = '', salt = '', hash = '';
  if (isNew) { temp = yehTempPassword_(); salt = yehSalt_(); hash = yehPassHash_(temp, salt); }
  const uid = yehWithLock_(function () {
    const ex = yehFindUser_(id);
    if (isNew && ex) throw Error('User ID "' + id + '" sudah dipakai.');
    if (!isNew && !ex) throw Error('Pengguna tidak ditemukan.');
    if (ex) {
      if (yehNorm_(ex.User_ID) === yehNorm_(user.id) && (active === 'TIDAK' || role !== 'ADMIN'))
        throw Error('Anda tidak dapat menonaktifkan atau menurunkan peran akun sendiri.');
      yehPatch_('Cfg_Pengguna', ex._row, { Nama: name, Peran: role, Aktif: active });
      if (active === 'TIDAK') yehInvalidateSessions_(ex.User_ID);
    } else {
      yehAppendObj_('Cfg_Pengguna', { User_ID: id, Nama: name, Peran: role, Aktif: active, Salt: salt, Password_Hash: hash,
        Wajib_Ganti_Password: 'YA', Gagal_Login: 0, Kunci_Sampai: 0 });
    }
    const u = ex ? ex.User_ID : id;
    // Keanggotaan kelompok ikut menentukan regulasi mana yang boleh dibaca, dan
    // sejak v1.5.0 kelompok itu dibawa di dalam klaim kunci sesi. Bila
    // keanggotaannya berubah, sesi lama ditutup supaya kunci berikutnya memuat
    // kelompok yang baru — tanpa ini, pengguna yang dikeluarkan dari sebuah
    // kelompok masih dapat membaca regulasi terbatasnya sampai sesinya habis.
    if (groups && yehSyncMembers_(u, groups)) yehInvalidateSessions_(u);
    return u;
  });
  yehAudit_(isNew ? 'CREATE_USER' : 'SAVE_USER', user.id, uid);
  return { id: uid, tempPassword: temp, admin: yehAdminData_() };
}

/** Keanggotaan kelompok: baris lama diaktifkan/nonaktifkan, baris baru ditambah bila belum ada. Dipanggil di dalam kunci.
 *  Mengembalikan true bila ada yang benar-benar berubah — pemanggil memakainya
 *  untuk menutup sesi pengguna itu, lihat catatan di yehAdminSaveUser_. */
function yehSyncMembers_(uid, groups) {
  const n = yehNorm_(uid), have = {};
  let berubah = false;
  yehObjRows_('Cfg_Anggota_Grup').filter(function (r) { return yehNorm_(r.User_ID) === n; }).forEach(function (r) {
    const want = groups.indexOf(r.ID_Kelompok) >= 0 && !have[r.ID_Kelompok] ? 'YA' : 'TIDAK';
    if (want === 'YA') have[r.ID_Kelompok] = true;
    if ((yehNorm_(r.Aktif) === 'tidak' ? 'TIDAK' : 'YA') !== want) {
      yehPatch_('Cfg_Anggota_Grup', r._row, { Aktif: want });
      berubah = true;
    }
  });
  groups.forEach(function (g) {
    if (!have[g]) { yehAppendObj_('Cfg_Anggota_Grup', { User_ID: uid, ID_Kelompok: g, Aktif: 'YA' }); berubah = true; }
  });
  return berubah;
}

/** Atur ulang sandi pengguna oleh admin: sandi sementara acak, wajib diganti saat masuk, kunci akun dibuka. */
function yehAdminResetPassword_(user, p) {
  yehAdmin_(user);
  const o = yehFindUser_(p.id);
  if (!o) throw Error('Pengguna tidak ditemukan.');
  const temp = yehTempPassword_(), salt = yehSalt_(), hash = yehPassHash_(temp, salt);
  yehWithLock_(function () {
    yehForget_('Cfg_Pengguna');
    const x = yehFindUser_(o.User_ID);
    yehPatch_('Cfg_Pengguna', x._row, { Salt: salt, Password_Hash: hash, Wajib_Ganti_Password: 'YA', Gagal_Login: 0, Kunci_Sampai: 0 });
    yehInvalidateSessions_(x.User_ID);
  });
  yehAudit_('RESET_PASSWORD', user.id, o.User_ID);
  return { id: o.User_ID, tempPassword: temp, admin: yehAdminData_() };
}

function yehAdminSaveGroup_(user, p) {
  yehAdmin_(user);
  const g = p.group || {};
  const id = String(g.id || '').trim();
  if (!/^[a-zA-Z0-9_-]{2,40}$/.test(id)) throw Error('ID kelompok 2–40 karakter: huruf, angka, garis bawah, atau tanda minus.');
  const values = { Nama_Kelompok: String(g.name || '').trim() || id, Aktif: g.active === 'TIDAK' ? 'TIDAK' : 'YA' };
  yehWithLock_(function () {
    const o = yehFindObj_('Cfg_Kelompok', 'ID_Kelompok', id);
    if (p.isNew && o) throw Error('ID kelompok "' + id + '" sudah dipakai.');
    if (o) yehPatch_('Cfg_Kelompok', o._row, values);
    else yehAppendObj_('Cfg_Kelompok', { ID_Kelompok: id, Nama_Kelompok: values.Nama_Kelompok, Aktif: values.Aktif });
  });
  yehAudit_('SAVE_GROUP', user.id, id);
  return { id: id, admin: yehAdminData_() };
}

function yehAdminSaveRegulation_(user, p) {
  yehAdmin_(user);
  const d = p.reg || {};
  const r = yehObjRows_('Cfg_Regulasi').find(function (x) { return x.ID_Regulasi === d.id; });
  if (!r) throw Error('Regulasi tidak ditemukan.');
  const title = String(d.title || '').trim();
  if (!title) throw Error('Judul regulasi wajib diisi.');
  const group = String(d.group || '').trim();
  if (yehValidGroups_().indexOf(group) < 0) throw Error('Kategori tidak dikenal: ' + group);
  const docs = Array.isArray(d.docs) ? yehPrepareDocs_(d.id, d.docs.slice(0, 20)) : null;
  const patch = {
    Nama_Regulasi: title, Kelompok: group,
    Akses_Dokumen: String(d.access).toUpperCase() === 'TERBATAS' ? 'TERBATAS' : 'INTERNAL',
    Aktif: d.active === 'TIDAK' ? 'TIDAK' : 'YA',
    Header_Format_Utuh: String(d.fullHeader || '').trim(), Header_Dasar: String(d.baseHeader || '').trim(),
    Tanggal_Verifikasi: String(d.verification || '').trim(), Catatan: String(d.notes || '').trim()
  };
  yehWithLock_(function () { yehPatch_('Cfg_Regulasi', r._row, patch); if (docs) yehWriteDocs_(d.id, docs); });
  // Judul, kategori, dan status TERBATAS ikut tersimpan di cermin, dan status
  // TERBATAS itulah yang dipakai RLS. Didorong sekarang, bukan menunggu malam.
  yehCerminCoba_(function () {
    const baru = yehObjRows_('Cfg_Regulasi').find(function (x) { return x.ID_Regulasi === d.id; });
    if (baru && yehNorm_(baru.Aktif) !== 'tidak') yehCerminRegulasi_(baru);
    else yehSbHapus_('reg_regulasi', 'id_regulasi=eq.' + encodeURIComponent(d.id));
  });
  yehAudit_('SAVE_REGULATION', user.id, d.id);
  return { id: d.id, admin: yehAdminData_() };
}

function yehAdminSaveAccess_(user, p) {
  yehAdmin_(user);
  const x = p.rule || {};
  const type = String(x.subjectType || '').toUpperCase(), effect = String(x.effect || '').toUpperCase();
  const subject = String(x.subjectId || '').trim();
  if (!yehObjRows_('Cfg_Regulasi').some(function (r) { return r.ID_Regulasi === x.regulationId; })) throw Error('Regulasi tidak ditemukan.');
  if (['USER', 'GRUP'].indexOf(type) < 0) throw Error('Subjek harus Pengguna atau Kelompok.');
  if (['IZIN', 'TOLAK'].indexOf(effect) < 0) throw Error('Efek harus Izinkan atau Tolak.');
  if (type === 'USER' && !yehFindUser_(subject)) throw Error('Pengguna tidak ditemukan: ' + subject);
  if (type === 'GRUP' && yehValidGroups_().indexOf(subject) < 0) throw Error('Kelompok tidak ditemukan: ' + subject);
  const vals = { Efek: effect, Aktif: x.active === 'TIDAK' ? 'TIDAK' : 'YA' };
  yehWithLock_(function () {
    const old = yehObjRows_('Cfg_Akses').find(function (r) {
      return r.ID_Regulasi === x.regulationId && yehNorm_(r.Tipe_Subjek) === yehNorm_(type) && yehNorm_(r.ID_Subjek) === yehNorm_(subject);
    });
    if (old) yehPatch_('Cfg_Akses', old._row, vals);
    else yehAppendObj_('Cfg_Akses', { ID_Regulasi: x.regulationId, Tipe_Subjek: type, ID_Subjek: subject, Efek: vals.Efek, Aktif: vals.Aktif });
  });
  // Aturan akses adalah penjaga baca di Supabase. Dicerminkan segera, karena
  // aturan TOLAK yang belum sampai berarti pintu masih terbuka.
  yehCerminCoba_(function () { yehCerminAturan_(); });
  yehAudit_('SAVE_ACCESS', user.id, x.regulationId + ':' + type + ':' + subject);
  return { saved: true, admin: yehAdminData_() };
}

function yehAdminClearCache_(user) {
  yehAdmin_(user);
  yehBumpCacheGen_();
  const cermin = yehCerminCoba_(function () { yehCerminRekonsiliasi_(); });
  return { cleared: true, cermin: cermin };
}

/** Sinkronisasi MANUAL: hanya menambah sheet sumber baru ke Cfg_Regulasi; metadata yang sudah diatur admin tidak diubah. */
function yehAdminSync_(user) {
  yehAdmin_(user);
  const source = yehSourceSpreadsheet_();
  const created = [], skipped = [];
  yehWithLock_(function () {
    const names = new Set(yehObjRows_('Cfg_Regulasi').map(function (r) { return r.Nama_Sheet; }));
    for (const sh of source.getSheets()) {
      const name = sh.getName();
      if (names.has(name)) continue;
      if (/^sheet\d+$/i.test(name) || /^referensi$/i.test(name)) { skipped.push(name); continue; }
      const h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getDisplayValues()[0];
      const norm = h.map(yehNorm_);
      if (norm.indexOf('pasal') < 0 && norm.indexOf('bab') < 0) { skipped.push(name); continue; }
      const restricted = /anggaran dasar|anggaran rumah tangga|(^|\W)ad\/?art(\W|$)/i.test(name);
      let group = 'PENDIDIKAN_TINGGI';
      if (/ketenagakerjaan|upah|pkwt|phk/i.test(name)) group = 'KETENAGAKERJAAN';
      else if (/yayasan|anggaran dasar|anggaran rumah tangga/i.test(name)) group = 'YAYASAN';
      else if (/mutu|akreditasi/i.test(name)) group = 'PENJAMINAN_MUTU';
      else if (/guru|dosen|jaminan|cuti/i.test(name)) group = 'KEPEGAWAIAN';
      else if (/sistem pendidikan nasional/i.test(name)) group = 'PENDIDIKAN_NASIONAL';
      const id = 'REG_' + Utilities.getUuid().slice(0, 8).toUpperCase();
      yehAppendObj_('Cfg_Regulasi', { ID_Regulasi: id, Nama_Regulasi: name, Nama_Sheet: name, Kelompok: group,
        Akses_Dokumen: restricted ? 'TERBATAS' : 'INTERNAL', Aktif: /\(lama\)/i.test(name) ? 'TIDAK' : 'YA' });
      created.push({ id: id, name: name, restricted: restricted });
      names.add(name);
    }
  });
  yehBumpCacheGen_();
  // Penanda cache naik, jadi seluruh cermin dianggap basi. Disegarkan sekalian.
  yehCerminCoba_(function () { yehCerminRekonsiliasi_(); });
  yehAudit_('SYNC', user.id, 'new=' + created.length);
  return { added: created, skipped: skipped, sourceName: source.getName(), admin: yehAdminData_() };
}

/** Aktivitas terbaru dari Cfg_Log (hanya membaca 2.000 baris terakhir). */
function yehAdminActivity_(user) {
  yehAdmin_(user);
  const sh = yehSheet_('Cfg_Log'), last = sh.getLastRow();
  if (last < 2) return { rows: [], total: 0 };
  const n = Math.min(2000, last - 1);
  const vals = sh.getRange(last - n + 1, 1, n, 4).getValues();
  return {
    total: last - 1,
    rows: vals.reverse().map(function (v) { return { t: yehDateIso_(v[0]), a: String(v[1] || ''), u: String(v[2] || ''), x: String(v[3] || '') }; })
  };
}
