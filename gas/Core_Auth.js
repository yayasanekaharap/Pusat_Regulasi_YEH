/**
 * Autentikasi, sesi, dan sandi.
 * - Sandi disimpan sebagai hash bergaram (SHA-256 berulang). Sandi asli tidak pernah ditulis ke sheet.
 * - Token sesi hanya disimpan dalam bentuk hash; berlaku 8 jam.
 * - 5 kali salah sandi → akun dikunci 15 menit.
 */
const YEH_SESSION_MS_ = 8 * 3600000;
const YEH_MAX_FAIL_ = 5;
const YEH_LOCK_MS_ = 15 * 60000;

function yehHash_(s) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return b.map(function (v) { return ('0' + (v & 255).toString(16)).slice(-2); }).join('');
}
function yehSalt_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }
function yehPassHash_(p, s) { let h = s + '|' + p; for (let i = 0; i < 6000; i++) h = yehHash_(h); return h; }

/** Aturan sandi: 8–128 karakter, memuat huruf dan angka, tidak sama dengan User ID. */
function yehPasswordCheck_(p, userId) {
  if (typeof p !== 'string' || p.length < 8 || p.length > 128) throw Error('Sandi minimal 8 karakter.');
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) throw Error('Sandi harus memuat huruf dan angka.');
  if (userId && yehNorm_(p) === yehNorm_(userId)) throw Error('Sandi tidak boleh sama dengan User ID.');
}

/** Sandi sementara acak, mis. "kmrtp-4827". Ditampilkan sekali kepada admin, tidak disimpan. */
function yehTempPassword_() {
  const L = 'abcdefghjkmnpqrstuvwxyz', D = '23456789';
  const hex = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const b = [];
  for (let i = 0; i < hex.length; i += 2) b.push(parseInt(hex.substr(i, 2), 16));
  let s = '';
  [0, 1, 2, 3, 4].forEach(function (i) { s += L[b[i] % L.length]; });
  s += '-';
  [16, 17, 18, 19].forEach(function (i) { s += D[b[i] % D.length]; });
  return s;
}

function yehNum_(v) {
  if (typeof v === 'number') return v;
  const s = String(v == null ? '' : v).trim();
  if (!s) return 0;
  if (/e/i.test(s)) return Number(s.replace(',', '.')) || 0;
  return Number(s.replace(/[^\d]/g, '')) || 0;
}
function yehAuthError_(m) { const e = Error(m); e.code = 'AUTH'; return e; }

function yehWithLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw Error('Sistem sedang sibuk. Coba lagi sebentar.');
  try { const r = fn(); SpreadsheetApp.flush(); return r; }
  finally { lock.releaseLock(); }
}

function yehPatch_(sheet, row, patch) {
  const sh = yehSheet_(sheet);
  const heads = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const m = yehMap_(heads);
  Object.keys(patch).forEach(function (k) {
    const i = m[yehNorm_(k)];
    if (i === undefined) throw Error('Header tidak ditemukan pada ' + sheet + ': ' + k);
    sh.getRange(row, i + 1).setValue(patch[k]);
  });
  yehForget_(sheet);
}
function yehAudit_(action, user, target) {
  try { yehSheet_('Cfg_Log').appendRow([new Date(), action, user, target]); yehForget_('Cfg_Log'); } catch (e) { console.error(e); }
}

/* ---------- Pengguna ---------- */

function yehFindUser_(id) { const n = yehNorm_(id); return yehObjRows_('Cfg_Pengguna').find(function (o) { return yehNorm_(o.User_ID) === n; }); }
function yehUserGroups_(id) {
  const n = yehNorm_(id);
  return yehObjRows_('Cfg_Anggota_Grup').filter(function (r) { return yehNorm_(r.User_ID) === n && yehNorm_(r.Aktif) !== 'tidak'; })
    .map(function (r) { return r.ID_Kelompok; });
}
function yehUserObj_(o) {
  return { id: o.User_ID, name: o.Nama || o.User_ID, role: String(o.Peran).toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER',
    groups: yehUserGroups_(o.User_ID), changeRequired: yehNorm_(o.Wajib_Ganti_Password) === 'ya' };
}
function yehPublicUser_(u) { return { id: u.id, name: u.name, role: u.role, groups: u.groups, changeRequired: !!u.changeRequired }; }
function yehAdmin_(user) { if (user.role !== 'ADMIN') throw Error('Hanya administrator yang dapat mengakses fitur ini.'); }

/* ---------- Sesi ---------- */

function yehNewSession_(userId) { // dipanggil di dalam kunci
  const token = yehSalt_(), exp = Date.now() + YEH_SESSION_MS_;
  yehAppendObj_('Cfg_Sesi', { Token_Hash: yehHash_(token), User_ID: userId, Kedaluwarsa: exp, Aktif: 'YA' });
  return { token: token, exp: exp };
}
function yehSessionPayload_(s, u) {
  u.exp = s.exp;   // dibutuhkan yehKunciCermin_ di dalam yehInit_
  const out = { token: s.token, expiresAt: s.exp, user: yehPublicUser_(u) };
  if (!u.changeRequired) out.init = yehInit_(u);
  return out;
}

/**
 * Kunci sesi bertanda tangan untuk ditukar menjadi JWT Supabase di Edge
 * Function regulasi-sesi. Bentuknya <muatan b64url>.<HMAC-SHA256 b64url>.
 *
 * Rahasianya hanya ada di Script Properties dan di secret Edge Function —
 * tidak pernah di sheet maupun di repo. Peran dan kelompok ikut di dalam
 * muatan karena RLS di Supabase memutuskan dari klaim itu; karena ikut
 * ditandatangani, web tidak dapat menaikkan perannya sendiri.
 */
function yehKunciCermin_(user) {
  const rahasia = yehProp_(YEH_P_TOKEN_);
  const exp = Math.floor(Number(user && user.exp ? user.exp : 0) / 1000);
  if (!rahasia || !exp) return '';
  const muatan = { u: user.id, p: user.role, n: user.name || user.id,
    g: user.groups || [], exp: exp };
  const m = String(Utilities.base64EncodeWebSafe(
    JSON.stringify(muatan), Utilities.Charset.UTF_8)).replace(/=+$/, '');
  const t = String(Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(m, rahasia))).replace(/=+$/, '');
  return m + '.' + t;
}

function yehLogin_(p) {
  const id = String(p.userId || '').trim(), password = String(p.password || '');
  if (!id || !password) throw Error('Isi User ID dan sandi.');
  const generic = 'User ID atau sandi salah.';
  const obj = yehFindUser_(id);
  if (!obj) { yehPassHash_(password, 'x'); throw Error(generic); }
  if (yehNorm_(obj.Aktif) === 'tidak') throw Error('Akun tidak aktif. Hubungi admin.');
  const lockedMsg = 'Akun dikunci sementara karena terlalu banyak percobaan. Coba lagi 15 menit lagi, atau minta admin mengatur ulang sandi.';
  if (yehNum_(obj._raw.Kunci_Sampai) > Date.now()) throw Error(lockedMsg);
  const ok = obj.Salt && obj.Password_Hash && yehPassHash_(password, obj.Salt) === obj.Password_Hash;
  const res = yehWithLock_(function () {
    yehForget_('Cfg_Pengguna');
    const o = yehFindUser_(id);
    if (!ok) {
      const f = yehNum_(o._raw.Gagal_Login) + 1;
      yehPatch_('Cfg_Pengguna', o._row, { Gagal_Login: f, Kunci_Sampai: f >= YEH_MAX_FAIL_ ? Date.now() + YEH_LOCK_MS_ : 0 });
      return { fail: true, locked: f >= YEH_MAX_FAIL_ };
    }
    if (yehNum_(o._raw.Gagal_Login) || yehNum_(o._raw.Kunci_Sampai)) yehPatch_('Cfg_Pengguna', o._row, { Gagal_Login: 0, Kunci_Sampai: 0 });
    return { session: yehNewSession_(o.User_ID), userId: o.User_ID };
  });
  if (res.fail) throw Error(res.locked ? lockedMsg : generic);
  yehAudit_('LOGIN', res.userId, '');
  return yehSessionPayload_(res.session, yehUserObj_(yehFindUser_(res.userId)));
}

function yehRequireSession_(token) {
  if (typeof token !== 'string' || token.length < 20) throw yehAuthError_('Silakan masuk terlebih dahulu.');
  const h = yehHash_(token), cache = CacheService.getScriptCache();
  let s = null;
  try { s = JSON.parse(cache.get('ses:' + h) || 'null'); } catch (_) { s = null; }
  if (!s || s.exp <= Date.now()) {
    const row = yehObjRows_('Cfg_Sesi').find(function (x) { return x.Token_Hash === h; });
    if (!row || yehNorm_(row.Aktif) !== 'ya' || yehNum_(row._raw.Kedaluwarsa) <= Date.now()) throw yehAuthError_('Sesi berakhir. Silakan masuk kembali.');
    s = { u: row.User_ID, exp: yehNum_(row._raw.Kedaluwarsa) };
    try { cache.put('ses:' + h, JSON.stringify(s), 600); } catch (_) {}
  }
  const o = yehFindUser_(s.u);
  if (!o || yehNorm_(o.Aktif) === 'tidak') throw yehAuthError_('Akun tidak aktif.');
  const user = yehUserObj_(o);
  user.exp = s.exp;
  return user;
}

function yehLogout_(p) {
  const token = String(p.token || '');
  if (!token) return {};
  const h = yehHash_(token);
  try { CacheService.getScriptCache().remove('ses:' + h); } catch (_) {}
  const s = yehObjRows_('Cfg_Sesi').find(function (x) { return x.Token_Hash === h; });
  if (s && yehNorm_(s.Aktif) === 'ya') yehWithLock_(function () { yehPatch_('Cfg_Sesi', s._row, { Aktif: 'TIDAK' }); });
  return {};
}

/** Menutup semua sesi aktif milik pengguna. Dipanggil di dalam kunci. */
function yehInvalidateSessions_(id) {
  const n = yehNorm_(id), cache = CacheService.getScriptCache();
  yehObjRows_('Cfg_Sesi').forEach(function (r) {
    if (yehNorm_(r.User_ID) === n && yehNorm_(r.Aktif) === 'ya') {
      yehPatch_('Cfg_Sesi', r._row, { Aktif: 'TIDAK' });
      try { cache.remove('ses:' + r.Token_Hash); } catch (_) {}
    }
  });
}

/** Ganti sandi oleh pengguna sendiri (semua peran). Sesi lain ditutup; sesi baru langsung diberikan. */
function yehChangePassword_(user, p) {
  const o = yehFindUser_(user.id);
  const oldP = String(p.oldPassword || ''), newP = String(p.newPassword || '');
  if (yehPassHash_(oldP, o.Salt) !== o.Password_Hash) throw Error('Sandi lama salah.');
  yehPasswordCheck_(newP, user.id);
  if (oldP === newP) throw Error('Sandi baru harus berbeda dari sandi lama.');
  const salt = yehSalt_(), hash = yehPassHash_(newP, salt);
  const s = yehWithLock_(function () {
    yehPatch_('Cfg_Pengguna', o._row, { Salt: salt, Password_Hash: hash, Wajib_Ganti_Password: 'TIDAK', Gagal_Login: 0, Kunci_Sampai: 0 });
    yehInvalidateSessions_(o.User_ID);
    return yehNewSession_(o.User_ID);
  });
  yehAudit_('CHANGE_PASSWORD', user.id, '');
  return yehSessionPayload_(s, yehUserObj_(yehFindUser_(o.User_ID)));
}
