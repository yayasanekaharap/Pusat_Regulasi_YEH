import C from './config.js';
import API from './api.js';
import { Lib, Prefs } from './store.js';
import Cermin from './cermin.js';
"use strict";
/*
 * Perender halaman dalam aplikasi — isi #content, daftar regulasi, daftar isi,
 * dialog, dan toast.
 *
 * Tahap v1.6.0-a SENGAJA tidak memindahkan logika apa pun dari berkas ini ke
 * komponen React. Yang dikerjakan tahap ini hanya sistem build dan modul:
 * kerangka halaman dirender React satu kali, lalu init() di bawah berjalan dan
 * memakai elemen itu lewat id yang sama seperti sebelumnya. Dengan begitu
 * perilakunya identik dan harness 74 pemeriksaan tetap menjadi buktinya.
 * Tahap b dan c menggantinya halaman demi halaman.
 */
export function init() {
  const $ = s => document.querySelector(s);
  const TOKEN_KEY = C.STORAGE_KEY + ':token';
  const S = {
    user: null, regs: [], regMap: {}, groups: [], groupName: {}, marks: [], libRev: '',
    lib: new Map(), syncing: false, libFail: new Set(),
    docId: '', doc: null, ver: '', cmp: '', onlyDiff: false, render: null, observer: null,
    find: { q: '', marks: [], i: -1 }, tocFold: new Set(),
    admin: null, activity: null, search: null, searchGroup: '', nav: 0, sideTab: 'regs',
    cermin: false, cerminReg: null
  };

  /* ================= Utilitas ================= */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
    for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); }
    return el;
  }
  const ICONS = {
    home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M9 22V12h6v10',
    star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    settings: 'M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6',
    book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    list: 'M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|M21 21l-4.35-4.35',
    arrowLeft: 'M19 12H5|M12 19l-7-7 7-7', arrowRight: 'M5 12h14|M12 5l7 7-7 7',
    menu: 'M3 12h18|M3 6h18|M3 18h18',
    more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z|M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z|M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    chevDown: 'M6 9l6 6 6-6', chevRight: 'M9 18l6-6-6-6', chevLeft: 'M15 18l-6-6 6-6', chevUp: 'M18 15l-6-6-6 6',
    fold: 'M7 15l5 5 5-5|M7 9l5-5 5 5',
    maximize: 'M8 3H5a2 2 0 0 0-2 2v3|M21 8V5a2 2 0 0 0-2-2h-3|M3 16v3a2 2 0 0 0 2 2h3|M16 21h3a2 2 0 0 0 2-2v-3',
    minimize: 'M8 3v3a2 2 0 0 1-2 2H3|M21 8h-3a2 2 0 0 1-2-2V3|M3 16h3a2 2 0 0 1 2 2v3|M16 21v-3a2 2 0 0 1 2-2h3',
    printer: 'M6 9V2h12v7|M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2|M6 14h12v8H6z',
    link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71|M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    copy: 'M9 9h13v13H9z|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    quote: 'M10 11H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-1.5 4-4 5|M20 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-1.5 4-4 5',
    external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6|M15 3h6v6|M10 14L21 3',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    refresh: 'M23 4v6h-6|M1 20v-6h6|M3.51 9a9 9 0 0 1 14.85-3.36L23 10|M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9',
    key: 'M15 7a2 2 0 0 1 2 2|M21 9a6 6 0 0 1-7.74 5.74L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.59a1 1 0 0 1 .29-.7l5.97-5.97A6 6 0 1 1 21 9z',
    x: 'M18 6L6 18|M6 6l12 12',
    users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75',
    folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
    check: 'M20 6L9 17l-5-5', clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 6v6l4 2',
    alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z|M12 9v4|M12 17h.01',
    columns: 'M12 3v18|M3 3h18v18H3z', layers: 'M12 2L2 7l10 5 10-5-10-5z|M2 17l10 5 10-5|M2 12l10 5 10-5',
    activity: 'M22 12h-4l-3 9L9 3l-3 9H2', file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6',
    plus: 'M12 5v14|M5 12h14', trash: 'M3 6h18|M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6|M10 11v6|M14 11v6|M9 6V4h6v2'
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  function icon(name, cls) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    (ICONS[name] || '').split('|').forEach(d => { const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); s.append(p); });
    return s;
  }
  document.querySelectorAll('[data-icon]').forEach(el => el.prepend(icon(el.dataset.icon)));

  const norm = s => String(s == null ? '' : s).normalize('NFKC').toLocaleLowerCase('id').replace(/\s+/g, ' ').trim();
  const normSp = s => String(s || '').replace(/\s+/g, ' ').trim();
  /* Backend tidak mengirim naskah dasar yang isinya persis sama dengan naskah
     berlaku; yang dikirim hanya penandanya (row.sama). Dipulihkan di sini,
     sehingga tampilan, pembanding, daftar isi, dan pencarian lokal bekerja
     seperti sebelumnya tanpa perlu tahu soal penghematan itu. */
  function tks(t, kunci, sama) {
    const v = t[kunci];
    if (v) return v;
    if (sama && (kunci === 'dasar' || kunci === 'utuh')) return t.utuh || t.dasar || '';
    return '';
  }
  const pretty = id => String(id || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const groupLabel = id => S.groupName[id] || pretty(id) || 'Tanpa kategori';
  const fmtBab = v => /^bab\b/i.test(v) ? v : 'BAB ' + v;
  const fmtPasal = v => /^pasal\b/i.test(v) ? v : 'Pasal ' + v;
  const fmtAyat = v => /^\(.*\)$/.test(v) ? v : '(' + v + ')';
  const fmtPoin = v => /[.)]$/.test(v) ? v : v + '.';
  const poinWord = v => (/^\d/.test(String(v)) ? 'angka ' : 'huruf ') + String(v).replace(/[.)]$/, '');
  const pathOf = o => [o.bab && fmtBab(o.bab), o.pasal && fmtPasal(o.pasal), o.ayat && 'ayat ' + fmtAyat(o.ayat),
    o.poin && poinWord(o.poin), o.subpoin && poinWord(o.subpoin)].filter(Boolean).join(' · ');
  const citePath = o => [o.pasal && fmtPasal(o.pasal), o.ayat && 'ayat ' + fmtAyat(o.ayat), o.poin && poinWord(o.poin), o.subpoin && poinWord(o.subpoin)].filter(Boolean).join(' ');
  const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const fmtSize = b => !b ? '' : b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
  function ago(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!isFinite(s)) return '';
    if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu'; if (s < 604800) return Math.floor(s / 86400) + ' hari lalu';
    return fmtDate(iso);
  }
  const store = {
    get(k) { try { return sessionStorage.getItem(k) || ''; } catch (_) { return ''; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (_) {} }
  };
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Memproses…'; btn.disabled = true; }
    else { if (btn.dataset.label) btn.textContent = btn.dataset.label; btn.disabled = false; }
  }
  let toastTimer;
  function toast(msg, type) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast ' + (type || ''); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, type === 'error' ? 6500 : 3000);
  }
  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg || 'Disalin.', 'ok'); return; } catch (_) {}
    const ta = h('textarea', { readonly: true, class: 'clip' }); ta.value = text;
    (document.querySelector('#dlg[open]') || document.body).append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove();
    toast(ok ? (okMsg || 'Disalin.') : 'Penyalinan tidak diizinkan oleh peramban. Pilih teks lalu tekan Ctrl+C.', ok ? 'ok' : 'error');
  }
  function show(id) { ['viewBoot', 'viewLogin', 'viewChange', 'viewApp'].forEach(v => { $('#' + v).hidden = v !== id; }); }
  function setToken(t) { API.token = t || ''; if (t) store.set(TOKEN_KEY, t); else store.del(TOKEN_KEY); }
  const isWide = () => window.matchMedia('(min-width: 1101px)').matches;
  const appLink = (id, row) => location.origin + location.pathname + '#/r/' + encodeURIComponent(id) + (row ? '/' + row : '');

  async function req(action, payload, opt) {
    try { return await API.call(action, payload, opt); }
    catch (e) {
      if (e.code === 'AUTH' && action !== 'login') { await resetSession(false); show('viewLogin'); $('#loginMsg').textContent = e.message; }
      else if (e.code === 'CHANGE_REQUIRED') showChange(true);
      throw e;
    }
  }

  /* ================= Menu kecil (popover) & dialog ================= */
  let pop = null;
  function closePop() { if (pop) { pop.el.remove(); if (pop.anchor) pop.anchor.setAttribute('aria-expanded', 'false'); pop = null; } }
  function popMenu(anchor, items) {
    const again = pop && pop.anchor === anchor;
    closePop();
    if (again) return;
    const el = h('div', { class: 'pop', role: 'menu' }, items.filter(Boolean).map(it => {
      if (it === '-') return h('div', { class: 'pop-sep' });
      if (it.head) return h('div', { class: 'pop-head' }, h('strong', { text: it.head }), it.sub ? h('small', { text: it.sub }) : null);
      if (it.foot) return h('div', { class: 'pop-foot', text: it.foot });
      return h('button', { type: 'button', role: 'menuitem', class: 'pop-item' + (it.danger ? ' danger' : '') + (it.on ? ' on' : ''),
        onclick: () => { closePop(); it.onClick(); } }, it.icon ? icon(it.icon) : null, h('span', { text: it.label }));
    }));
    document.body.append(el);
    const r = anchor.getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight;
    let left = Math.min(window.innerWidth - w - 8, Math.max(8, r.right - w));
    let top = r.bottom + 6;
    if (top + hh > window.innerHeight - 8) top = Math.max(8, r.top - hh - 6);
    el.style.left = left + 'px'; el.style.top = top + 'px';
    anchor.setAttribute('aria-expanded', 'true');
    pop = { el, anchor };
    const first = el.querySelector('.pop-item'); if (first) first.focus({ preventScroll: true });
  }
  document.addEventListener('pointerdown', e => { if (pop && !pop.el.contains(e.target) && !pop.anchor.contains(e.target)) closePop(); }, true);
  window.addEventListener('resize', closePop);
  window.addEventListener('scroll', () => closePop(), { passive: true });

  function modal(o) {
    const dlg = $('#dlg');
    closePop();
    return new Promise(resolve => {
      const msg = h('p', { class: 'form-msg', role: 'alert' });
      const okBtn = o.ok === null ? null : h('button', { class: 'btn ' + (o.danger ? 'danger' : 'primary'), type: 'submit' }, o.ok || 'Simpan');
      const cancelBtn = o.cancel === null ? null : h('button', { class: 'btn ghost', type: 'button', onclick: () => close(null) }, o.cancel || 'Batal');
      const form = h('form', { class: 'dlg-form', novalidate: true },
        h('header', { class: 'dlg-head' }, h('h2', { text: o.title }),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Tutup', onclick: () => close(null) }, icon('x'))),
        h('div', { class: 'dlg-body' + (o.flush ? ' flush' : '') }, o.body), msg,
        (okBtn || cancelBtn || o.left) ? h('footer', { class: 'dlg-foot' }, o.left ? h('div', { class: 'dlg-left' }, o.left) : null, cancelBtn, okBtn) : null);
      let done = false;
      function close(v) { if (done) return; done = true; dlg.removeEventListener('cancel', onCancel); if (dlg.open) dlg.close(); resolve(v); }
      function onCancel(e) { e.preventDefault(); if (!okBtn || !okBtn.disabled) close(null); }
      form.addEventListener('submit', async e => {
        e.preventDefault(); msg.textContent = '';
        if (!o.onOk) { close(true); return; }
        busy(okBtn, true, o.busy || 'Menyimpan…'); if (cancelBtn) cancelBtn.disabled = true;
        try { const r = await o.onOk(form); if (r !== false) close(r === undefined ? true : r); }
        catch (err) { msg.textContent = err.message; }
        finally { busy(okBtn, false); if (cancelBtn) cancelBtn.disabled = false; }
      });
      dlg.className = 'dlg' + (o.size ? ' ' + o.size : '');
      dlg.replaceChildren(form);
      dlg.addEventListener('cancel', onCancel);
      dlg.showModal();
      setTimeout(() => { const f = form.querySelector('.dlg-body input:not([readonly]):not([type=checkbox]):not([type=radio]),.dlg-body select,.dlg-body textarea'); if (f) f.focus(); }, 40);
    });
  }
  function field(label, control, hint) { return h('label', { class: 'field' }, h('span', { text: label }), control, hint ? h('small', { text: hint }) : null); }
  function select(name, options, value) {
    const s = h('select', { name });
    options.forEach(([v, l]) => s.append(h('option', { value: v }, l)));
    if (value != null) s.value = value;
    return s;
  }
  function pwInput(name, autocomplete) {
    const inp = h('input', { name, type: 'password', autocomplete, required: true });
    const btn = h('button', { type: 'button', class: 'pw-toggle' }, 'Lihat');
    btn.addEventListener('click', () => { const on = inp.type === 'password'; inp.type = on ? 'text' : 'password'; btn.textContent = on ? 'Sembunyi' : 'Lihat'; });
    return h('span', { class: 'pw' }, inp, btn);
  }

  /* ================= Masuk, sandi, keluar ================= */
  $('#loginForm .pw-toggle').addEventListener('click', e => {
    const inp = $('#loginForm [name=password]'), on = inp.type === 'password';
    inp.type = on ? 'text' : 'password'; e.currentTarget.textContent = on ? 'Sembunyi' : 'Lihat';
  });
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget, msg = $('#loginMsg'), btn = f.querySelector('button[type=submit]');
    const userId = f.userId.value.trim(), password = f.password.value;
    msg.textContent = '';
    if (!userId || !password) { msg.textContent = 'Isi User ID dan sandi.'; return; }
    busy(btn, true, 'Memeriksa…');
    try { const d = await API.call('login', { userId, password }); f.reset(); afterAuth(d); }
    catch (err) { msg.textContent = err.message; }
    finally { busy(btn, false); }
  });
  function afterAuth(d) {
    setToken(d.token); S.user = d.user;
    if (d.user.changeRequired || !d.init) { showChange(true); return; }
    enterApp(d.init);
  }
  function passwordForm(forced, onSaved) {
    const rules = [
      ['len', 'Minimal 8 karakter', p => p.length >= 8],
      ['mix', 'Memuat huruf dan angka', p => /[A-Za-z]/.test(p) && /[0-9]/.test(p)],
      ['id', 'Tidak sama dengan User ID', p => !!p && norm(p) !== norm(S.user && S.user.id)],
      ['same', 'Ulangi sandi baru sama persis', (p, c) => !!p && p === c]
    ];
    const ul = h('ul', { class: 'rules' }, rules.map(r => h('li', { 'data-r': r[0] }, r[1])));
    const oldP = pwInput('oldPassword', 'current-password'), newP = pwInput('newPassword', 'new-password'), conf = pwInput('confirm', 'new-password');
    const body = h('div', null, field(forced ? 'Sandi sementara (dari admin)' : 'Sandi lama', oldP), field('Sandi baru', newP), field('Ulangi sandi baru', conf), ul);
    const check = () => {
      const p = newP.firstChild.value, c = conf.firstChild.value;
      rules.forEach(r => ul.querySelector('[data-r=' + r[0] + ']').classList.toggle('ok', r[2](p, c)));
      return rules.every(r => r[2](p, c));
    };
    body.addEventListener('input', check);
    async function submit() {
      if (!oldP.firstChild.value) throw Error('Isi sandi lama.');
      if (!check()) throw Error('Sandi baru belum memenuhi semua syarat.');
      const d = await req('changePassword', { oldPassword: oldP.firstChild.value, newPassword: newP.firstChild.value });
      setToken(d.token); S.user = d.user;
      onSaved(d);
    }
    return { body, submit };
  }
  function showChange(forced) {
    if (!forced) {
      const pf = passwordForm(false, () => toast('Sandi berhasil diganti.', 'ok'));
      modal({ title: 'Ganti sandi', body: pf.body, ok: 'Simpan sandi', onOk: () => pf.submit() });
      return;
    }
    const card = $('#changeCard');
    const pf = passwordForm(true, d => { toast('Sandi berhasil dibuat. Selamat datang.', 'ok'); enterApp(d.init); });
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Simpan dan lanjutkan');
    const form = h('form', { novalidate: true }, pf.body, msg,
      h('div', { class: 'auth-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: logout }, 'Keluar'), btn));
    form.addEventListener('submit', async e => {
      e.preventDefault(); msg.textContent = ''; busy(btn, true, 'Menyimpan…');
      try { await pf.submit(); } catch (err) { msg.textContent = err.message; } finally { busy(btn, false); }
    });
    card.replaceChildren(h('img', { class: 'auth-logo', src: 'assets/logo.png', alt: '' }), h('h1', { text: 'Buat sandi baru' }),
      h('p', { class: 'muted', text: 'Halo ' + ((S.user && S.user.name) || '') + '. Demi keamanan, ganti sandi sementara sebelum mulai.' }), form);
    show('viewChange');
    setTimeout(() => { const i = form.querySelector('input'); if (i) i.focus(); }, 40);
  }
  async function resetSession(wipeLib) {
    setToken(''); closePop(); stopRender();
    if ($('#dlg').open) $('#dlg').close();
    Object.assign(S, { user: null, regs: [], regMap: {}, marks: [], docId: '', doc: null, admin: null, activity: null, search: null, cermin: false, cerminReg: null });
    if (Cermin) Cermin.lupakan();
    S.lib.clear();
    document.body.classList.remove('reading');
    if (wipeLib) await Lib.wipe();
  }
  async function logout() {
    const t = API.token;
    if (t) API.call('logout', { token: t }).catch(() => {});
    await resetSession(true);
    show('viewLogin'); $('#loginMsg').textContent = '';
  }

  /* ================= Masuk ke aplikasi & pustaka di perangkat ================= */
  function loadInit(init) {
    S.user = init.user; S.regs = init.regulations || []; S.groups = init.groups || []; S.libRev = init.libRev || '';
    // Kunci sesi untuk cermin. Kosong berarti REG_TOKEN_SECRET belum disetel di
    // Apps Script; web lalu berjalan sepenuhnya lewat /exec, seperti sebelumnya.
    S.cermin = !!init.cermin && !!init.sbKey;
    S.cerminReg = null;
    if (Cermin) Cermin.setKey(init.sbKey || '');
    S.marks = init.bookmarks || [];
    S.regMap = {}; S.regs.forEach(r => { S.regMap[r.id] = r; });
    S.groupName = {}; S.groups.forEach(g => { S.groupName[g.id] = g.name; });
    const name = S.user.name || S.user.id;
    $('#userName').textContent = name;
    $('#avatar').textContent = name.trim().charAt(0).toUpperCase() || '?';
    $('#navAdmin').hidden = S.user.role !== 'ADMIN';
    updateMarkCount();
    renderRegs();
  }
  async function enterApp(init) {
    loadInit(init);
    show('viewApp');
    applyPrefs();
    navTrack();
    const owner = await Lib.meta('owner');
    if (owner && owner !== S.user.id) await Lib.wipe();
    (await Lib.all()).forEach(d => S.lib.set(d.id, d));
    await Lib.setMeta('owner', S.user.id);
    route();
    syncLibrary();
  }
  /** Penanda revisi versi cermin. Dibandingkan dengan penanda dari Apps Script
   *  sebelum cermin dipakai — itulah yang membuat naskah basi tidak pernah
   *  tampil hanya karena cermin belum menyusul suntingan terakhir. */
  async function cerminMeta(force) {
    if (!S.cermin || !Cermin || !Cermin.siap()) return null;
    if (!force && S.cerminReg && Date.now() - S.cerminReg.t < 60000) return S.cerminReg.peta;
    try {
      const daftar = await Cermin.regulasi();
      const peta = {};
      (daftar || []).forEach(function (x) { peta[x.id_regulasi] = x; });
      S.cerminReg = { t: Date.now(), peta: peta };
      return peta;
    } catch (e) { S.cerminReg = null; return null; }
  }
  function docDariCermin(id, m, rows) {
    return { id: id, rev: m.rev, versions: m.versi_tersedia || [],
      defaultVersion: m.versi_default || 'utuh', rows: rows };
  }

  const libReady = () => S.regs.length > 0 && S.regs.every(r => { const d = S.lib.get(r.id); return d && d.rev === r.rev; });
  function updateLibStatus() {
    const el = $('#libStatus'); if (!el) return;
    const total = S.regs.length, ok = S.regs.filter(r => { const d = S.lib.get(r.id); return d && d.rev === r.rev; }).length;
    el.replaceChildren();
    if (ok >= total) el.append(icon('check', 'ok'), h('span', { text: 'Pustaka siap di perangkat' }));
    else if (S.syncing) el.append(h('span', { class: 'spinner sm' }), h('span', { text: 'Menyiapkan pustaka ' + ok + '/' + total }));
    else el.append(icon('alert'), h('span', { text: 'Pustaka ' + ok + '/' + total + ' · dibaca dari server' }));
    const hs = $('#homeLib'); if (hs) hs.textContent = el.textContent;
  }
  async function syncLibrary() {
    if (S.syncing || !S.user) return;
    S.syncing = true; updateLibStatus();
    const uid = S.user.id;
    try {
      for (const id of [...S.lib.keys()]) if (!S.regMap[id]) { S.lib.delete(id); await Lib.del(id); }
      let need = S.regs.filter(r => { const d = S.lib.get(r.id); return (!d || d.rev !== r.rev) && !S.libFail.has(r.id); }).map(r => r.id);

      // Jalur baku: cermin Supabase, satu regulasi satu permintaan. Yang
      // penanda revisinya belum sama dengan Apps Script dilewati ke jalur
      // cadangan, bukan diambil setengah benar.
      const peta = await cerminMeta(true);
      if (peta && need.length) {
        const sisa = [];
        for (const id of need) {
          if (!S.user || S.user.id !== uid) return;
          const reg = S.regMap[id], m = peta[id];
          if (!reg || !m || m.rev !== reg.rev) { sisa.push(id); continue; }
          try {
            const n = await Cermin.naskah(id);
            if (!n.rows.length || (n.rev && n.rev !== reg.rev)) { sisa.push(id); continue; }
            const doc = docDariCermin(id, m, n.rows);
            S.lib.set(id, doc); await Lib.put(doc);
            Cermin.ukur.sumber = 'cermin';
            updateLibStatus();
          } catch (e) { sisa.push(id); }
        }
        need = sisa;
      }

      while (need.length && S.user && S.user.id === uid) {
        const batch = need.splice(0, 4);
        let res;
        try { res = await req('docs', { ids: batch }, { timeout: 180000 }); } catch (e) { break; }
        if (Cermin) Cermin.ukur.sumber = 'Apps Script';
        for (const [id, d] of Object.entries(res.docs || {})) {
          if (d.error) { S.libFail.add(id); continue; }
          const doc = { id, rev: d.rev, versions: d.versions, defaultVersion: d.defaultVersion, rows: d.rows };
          S.lib.set(id, doc); await Lib.put(doc);
        }
        if (res.pending && res.pending.length) need = res.pending.concat(need);
        updateLibStatus();
      }
    } finally { S.syncing = false; updateLibStatus(); }
  }
  async function getDoc(id, force) {
    const reg = S.regMap[id];
    const local = S.lib.get(id);
    if (!force && local && reg && local.rev === reg.rev) return local;
    if (reg) {
      const peta = await cerminMeta(force);
      const m = peta && peta[id];
      if (m && m.rev === reg.rev) {
        try {
          const n = await Cermin.naskah(id);
          if (n.rows.length && (!n.rev || n.rev === reg.rev)) {
            const doc = docDariCermin(id, m, n.rows);
            S.lib.set(id, doc); Lib.put(doc); updateLibStatus();
            Cermin.ukur.sumber = 'cermin';
            return doc;
          }
        } catch (e) { /* lanjut ke jalur cadangan di bawah */ }
      }
    }
    try {
      const d = await req('document', { id });
      const doc = { id, rev: d.rev, versions: d.versions, defaultVersion: d.defaultVersion, rows: d.rows };
      S.lib.set(id, doc); Lib.put(doc); updateLibStatus();
      if (Cermin) Cermin.ukur.sumber = 'Apps Script';
      return doc;
    } catch (e) {
      if (local && e.network) { toast('Server tidak terjangkau. Menampilkan salinan tersimpan.', 'error'); return local; }
      throw e;
    }
  }
  function logRead(id) {
    let m = {}; try { m = JSON.parse(store.get('yeh_reads') || '{}'); } catch (_) {}
    if (m[id] && Date.now() - m[id] < 600000) return;
    m[id] = Date.now(); store.set('yeh_reads', JSON.stringify(m));
    API.call('logRead', { id }).catch(() => {});
  }

  /* ================= Preferensi tampilan ================= */
  function applyPrefs() {
    $('#shell').classList.toggle('mini', !!Prefs.get('sideMini', false));
    document.documentElement.style.setProperty('--fs', Prefs.get('fs', 16) + 'px');
    setSideTab(S.sideTab);
  }
  function setFont(delta) {
    const fs = delta === 0 ? 16 : Math.min(24, Math.max(13, Prefs.get('fs', 16) + delta));
    Prefs.set('fs', fs); document.documentElement.style.setProperty('--fs', fs + 'px');
    toast('Ukuran huruf ' + fs + ' px');
  }
  function recentKey() { return 'recent:' + (S.user ? S.user.id : ''); }
  function pushRecent(id, row) {
    const list = Prefs.get(recentKey(), []).filter(x => x.id !== id);
    list.unshift({ id, row: row || 0, t: new Date().toISOString() });
    Prefs.set(recentKey(), list.slice(0, 8));
  }

  /* ================= Bilah atas: maju/mundur, cari, akun ================= */
  const NAV_KEY = 'yeh_nav';
  function navTrack() {
    let st; try { st = JSON.parse(store.get(NAV_KEY) || 'null'); } catch (_) { st = null; }
    st = st || { list: [], idx: -1 };
    const cur = location.hash || '#/';
    if (st.list[st.idx] === cur) {}
    else if (st.list[st.idx - 1] === cur) st.idx--;
    else if (st.list[st.idx + 1] === cur) st.idx++;
    else { st.list = st.list.slice(0, st.idx + 1); st.list.push(cur); if (st.list.length > 80) st.list.shift(); st.idx = st.list.length - 1; }
    store.set(NAV_KEY, JSON.stringify(st));
    $('#btnBack').disabled = st.idx <= 0;
    $('#btnFwd').disabled = st.idx >= st.list.length - 1;
  }
  $('#btnBack').addEventListener('click', () => history.back());
  $('#btnFwd').addEventListener('click', () => history.forward());
  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    if (q.length < 2) { toast('Ketik sedikitnya 2 huruf.', 'error'); return; }
    $('#topbar').classList.remove('searching');
    const target = '#/cari/' + encodeURIComponent(q);
    if (location.hash === target) { S.search = null; route(); } else location.hash = target;
  });
  $('#btnSearchToggle').addEventListener('click', () => {
    const on = !$('#topbar').classList.contains('searching');
    $('#topbar').classList.toggle('searching', on);
    if (on) $('#searchInput').focus();
  });
  $('#btnUser').addEventListener('click', e => {
    popMenu(e.currentTarget, [
      { head: S.user.name || S.user.id, sub: (S.user.role === 'ADMIN' ? 'Admin' : 'Pengguna') + ' · ' + S.user.id },
      S.user.role === 'ADMIN' ? { icon: 'settings', label: 'Panel Admin', onClick: () => { location.hash = '#/admin'; } } : null,
      { icon: 'key', label: 'Ganti sandi', onClick: () => showChange(false) },
      { icon: 'refresh', label: 'Muat ulang data', onClick: () => refreshAll(true) },
      { icon: 'activity', label: 'Diagnosa', onClick: () => { location.hash = '#/diagnosa'; } },
      '-',
      { icon: 'logout', label: 'Keluar', danger: true, onClick: logout },
      { foot: 'Versi web ' + C.APP_VERSION + ' · data dihapus dari perangkat saat Keluar' }
    ]);
  });
  async function refreshAll(announce) {
    try {
      if (S.user.role === 'ADMIN') await req('adminClearCache');
      S.search = null; S.admin = null; S.activity = null; S.libFail.clear();
      loadInit(await req('init'));
      await route(); syncLibrary();
      if (announce) toast('Data dimuat ulang.', 'ok');
    } catch (e) { toast(e.message, 'error'); }
  }
  async function refreshInitQuiet() {
    try { S.search = null; loadInit(await req('init')); syncLibrary(); } catch (_) {}
  }

  /* ================= Panel samping ================= */
  function openDrawer() { $('#sidebar').classList.add('open'); $('#scrim').hidden = false; }
  function closeDrawer() { $('#sidebar').classList.remove('open'); $('#scrim').hidden = true; }
  $('#btnDrawer').addEventListener('click', () => $('#sidebar').classList.contains('open') ? closeDrawer() : openDrawer());
  $('#scrim').addEventListener('click', closeDrawer);
  function setMini(on) { Prefs.set('sideMini', on); $('#shell').classList.toggle('mini', on); }
  $('#btnCollapse').addEventListener('click', () => setMini(!$('#shell').classList.contains('mini')));
  function setSideTab(tab) {
    if (tab === 'toc' && !S.doc) tab = 'regs';
    S.sideTab = tab;
    document.querySelectorAll('.side-tabs [data-tab]').forEach(b => {
      b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', String(b.dataset.tab === tab));
      if (b.dataset.tab === 'toc') b.disabled = !S.doc;
    });
    $('#paneRegs').hidden = tab !== 'regs'; $('#paneToc').hidden = tab !== 'toc';
  }
  document.querySelectorAll('.side-tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
    if ($('#shell').classList.contains('mini') && isWide()) setMini(false);
    setSideTab(b.dataset.tab);
  }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePop(); closeDrawer(); if (document.body.classList.contains('reading') && !$('#dlg').open) toggleReading(false); }
  });
  $('#filterInput').addEventListener('input', renderRegs);
  $('#btnFoldAll').addEventListener('click', () => {
    const groups = orderedGroups(S.regs), folded = new Set(Prefs.get('folded', []));
    const allFolded = groups.every(g => folded.has(g));
    Prefs.set('folded', allFolded ? [] : groups); renderRegs();
  });
  function orderedGroups(list) {
    const ids = [...new Set(list.map(r => r.group))], known = S.groups.map(g => g.id);
    const pos = id => known.indexOf(id) < 0 ? 999 : known.indexOf(id);
    return ids.sort((a, b) => pos(a) - pos(b));
  }
  function renderRegs() {
    const q = norm($('#filterInput').value), box = $('#regList'), cur = parseHash();
    const folded = new Set(Prefs.get('folded', []));
    const items = S.regs.filter(r => !q || norm(r.title + ' ' + groupLabel(r.group)).includes(q));
    box.replaceChildren();
    if (!items.length) { box.append(h('p', { class: 'empty', text: 'Tidak ada regulasi yang cocok.' })); return; }
    orderedGroups(items).forEach(gid => {
      const list = items.filter(r => r.group === gid);
      const hasActive = cur.name === 'doc' && list.some(r => r.id === cur.id);
      const isOpen = !!q || hasActive || !folded.has(gid);
      const head = h('button', { type: 'button', class: 'rg-head', 'aria-expanded': String(isOpen) },
        icon(isOpen ? 'chevDown' : 'chevRight'), h('span', { class: 'rg-t', text: groupLabel(gid) }), h('span', { class: 'rg-n', text: list.length }));
      head.addEventListener('click', () => {
        const f = new Set(Prefs.get('folded', []));
        if (isOpen) f.add(gid); else f.delete(gid);
        Prefs.set('folded', [...f]); if (!isOpen) $('#filterInput').value = q ? $('#filterInput').value : ''; renderRegs();
      });
      const wrap = h('div', { class: 'rg' + (isOpen ? '' : ' folded') }, head);
      if (isOpen) list.forEach(r => wrap.append(h('a', { class: 'ri' + (cur.name === 'doc' && cur.id === r.id ? ' active' : ''), href: '#/r/' + encodeURIComponent(r.id) },
        h('span', { class: 't', text: r.title }), r.restricted ? h('span', { class: 'chip pink xs', text: 'Terbatas' }) : null)));
      box.append(wrap);
    });
  }
  function markNav(name) {
    document.querySelectorAll('.side-nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === name));
  }
  function updateMarkCount() { const c = $('#markCount'); c.textContent = S.marks.length ? S.marks.length : ''; }

  /* ================= Navigasi ================= */
  function parseHash() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'r' && parts[1]) return { name: 'doc', id: decodeURIComponent(parts[1]), row: Number(parts[2]) || 0 };
    if (parts[0] === 'cari') return { name: 'search', q: decodeURIComponent(parts.slice(1).join('/')) };
    if (parts[0] === 'kategori' && parts[1]) return { name: 'cat', id: decodeURIComponent(parts[1]) };
    if (parts[0] === 'penanda') return { name: 'marks' };
    if (parts[0] === 'admin') return { name: 'admin', tab: parts[1] || 'users' };
    if (parts[0] === 'diagnosa') return { name: 'diag' };
    return { name: 'home' };
  }
  async function route() {
    if (!S.user || $('#viewApp').hidden) return;
    const r = parseHash(), nav = ++S.nav;
    closeDrawer(); closePop();
    if (r.name !== 'search') $('#searchInput').value = '';
    if (r.name !== 'doc') { stopRender(); S.doc = null; S.docId = ''; document.body.classList.remove('reading'); setSideTab('regs'); }
    markNav(r.name === 'home' ? 'home' : r.name === 'marks' ? 'marks' : r.name === 'admin' ? 'admin' : '');
    renderRegs();
    if (r.name === 'doc') await openDoc(r.id, r.row, nav);
    else if (r.name === 'search') await runSearch(r.q, nav);
    else if (r.name === 'admin') await showAdmin(r.tab, nav);
    else if (r.name === 'diag') await showDiagnosa(nav);
    else if (r.name === 'cat') { renderCategory(r.id); window.scrollTo(0, 0); }
    else if (r.name === 'marks') { renderMarks(); window.scrollTo(0, 0); }
    else { renderHome(); window.scrollTo(0, 0); }
  }
  window.addEventListener('hashchange', () => { navTrack(); route(); });
  const content = () => $('#content');
  function loading(text) { content().replaceChildren(h('div', { class: 'state' }, h('span', { class: 'spinner' }), h('div', { text: text || 'Memuat…' }))); }
  function failed(text, retry) {
    content().replaceChildren(h('div', { class: 'state error' }, h('div', { text }),
      retry ? h('button', { class: 'btn', type: 'button', onclick: retry }, 'Coba lagi') : null));
  }
  function pageHead(title, sub, ...right) {
    return h('div', { class: 'page-head' }, h('div', null, h('h1', { text: title }), sub ? h('p', { class: 'muted', text: sub }) : null), right.length ? h('div', { class: 'page-act' }, right) : null);
  }

  /* ================= Beranda, kategori, penanda ================= */
  function regCard(r) {
    return h('a', { class: 'reg-card', href: '#/r/' + encodeURIComponent(r.id) },
      h('div', { class: 'rc-top' }, h('strong', { text: r.title }), r.restricted ? h('span', { class: 'chip pink xs', text: 'Terbatas' }) : null),
      h('div', { class: 'rc-meta' },
        h('span', { text: groupLabel(r.group) }),
        r.docs && r.docs.length ? h('span', null, icon('file'), r.docs.length + ' dokumen asli') : null,
        r.verification ? h('span', null, icon('check'), 'Verifikasi ' + r.verification) : null));
  }
  function markRow(m, inGroup) {
    const r = S.regMap[m.id]; if (!r) return null;
    const d = S.lib.get(m.id), row = d && d.rows.find(x => x.row === m.row);
    const snip = row ? String(row.t.utuh || row.t.dasar || '').slice(0, 160) : '';
    return h('a', { class: 'li', href: '#/r/' + encodeURIComponent(m.id) + '/' + m.row },
      h('span', { class: 'li-ic' }, icon('star')),
      h('span', { class: 'li-main' }, inGroup ? null : h('strong', { text: r.title }), h('span', { class: 'li-sub', text: m.label || 'Baris ' + m.row }), snip ? h('span', { class: 'li-snip', text: snip + (snip.length >= 160 ? '…' : '') }) : null),
      h('span', { class: 'li-time', text: ago(m.time) }));
  }
  function renderHome() {
    const recent = Prefs.get(recentKey(), []).filter(x => S.regMap[x.id]).slice(0, 5);
    const verified = S.regs.filter(r => r.verification).slice(0, 5);
    const tile = (ic, label, sub, href, onClick) => h(href ? 'a' : 'button', { class: 'tile', href, type: href ? null : 'button', onclick: onClick }, h('span', { class: 'tile-ic' }, icon(ic)), h('span', null, h('strong', { text: label }), h('small', { text: sub })));
    const admin = S.user.role === 'ADMIN';
    content().replaceChildren(h('section', { class: 'home' },
      h('div', { class: 'hero' },
        h('div', null, h('h1', { text: 'Selamat datang, ' + (S.user.name || S.user.id) }),
          h('p', null, S.regs.length + ' regulasi tersedia · ', h('span', { id: 'homeLib' }))),
        h('div', { class: 'tiles' },
          tile('search', 'Cari isi pasal', 'Semua regulasi sekaligus', null, () => { if (!isWide() && window.innerWidth <= 760) $('#topbar').classList.add('searching'); $('#searchInput').focus(); }),
          tile('star', 'Penanda saya', S.marks.length + ' pasal ditandai', '#/penanda'),
          admin ? tile('settings', 'Panel Admin', 'Pengguna, regulasi, izin', '#/admin') : tile('key', 'Ganti sandi', 'Keamanan akun', null, () => showChange(false)))),
      h('div', { class: 'home-grid' },
        h('section', { class: 'panel' }, h('header', null, h('h2', { text: 'Lanjutkan membaca' })),
          recent.length ? h('div', { class: 'list' }, recent.map(x => h('a', { class: 'li', href: '#/r/' + encodeURIComponent(x.id) + (x.row ? '/' + x.row : '') },
            h('span', { class: 'li-ic' }, icon('clock')), h('span', { class: 'li-main' }, h('strong', { text: S.regMap[x.id].title }), h('span', { class: 'li-sub', text: groupLabel(S.regMap[x.id].group) })),
            h('span', { class: 'li-time', text: ago(x.t) }))))
            : h('p', { class: 'empty', text: 'Belum ada. Regulasi yang Anda buka akan muncul di sini.' })),
        h('section', { class: 'panel' }, h('header', null, h('h2', { text: 'Penanda saya' }), S.marks.length > 5 ? h('a', { href: '#/penanda', text: 'Lihat semua' }) : null),
          S.marks.length ? h('div', { class: 'list' }, S.marks.slice(0, 5).map(markRow)) : h('p', { class: 'empty', text: 'Tandai pasal penting lewat tombol ⋯ di samping pasal.' }))),
      h('section', { class: 'block' }, h('h2', { text: 'Kategori' }),
        h('div', { class: 'cat-grid' }, orderedGroups(S.regs).map(gid => {
          const regs = S.regs.filter(r => r.group === gid);
          return h('a', { class: 'cat', href: '#/kategori/' + encodeURIComponent(gid) },
            h('div', { class: 'cat-top' }, h('strong', { text: groupLabel(gid) }), h('span', { class: 'chip', text: regs.length })),
            h('ul', null, regs.slice(0, 3).map(r => h('li', { text: r.title }))), regs.length > 3 ? h('small', { text: '+' + (regs.length - 3) + ' lainnya' }) : null);
        }))),
      verified.length ? h('section', { class: 'block' }, h('h2', { text: 'Terverifikasi' }), h('div', { class: 'reg-grid' }, verified.map(regCard))) : null));
    updateLibStatus();
  }
  function renderCategory(gid) {
    const regs = S.regs.filter(r => r.group === gid);
    content().replaceChildren(h('section', { class: 'page' },
      pageHead(groupLabel(gid), regs.length + ' regulasi'),
      regs.length ? h('div', { class: 'reg-grid' }, regs.map(regCard)) : h('p', { class: 'empty', text: 'Tidak ada regulasi di kategori ini.' })));
  }
  function renderMarks() {
    const groups = new Map();
    S.marks.forEach(m => { if (!S.regMap[m.id]) return; if (!groups.has(m.id)) groups.set(m.id, []); groups.get(m.id).push(m); });
    content().replaceChildren(h('section', { class: 'page' },
      pageHead('Penanda saya', S.marks.length ? S.marks.length + ' pasal ditandai' : 'Belum ada pasal yang ditandai.'),
      !S.marks.length ? h('div', { class: 'panel' }, h('p', { class: 'empty', text: 'Buka regulasi, tekan tombol ⋯ di samping pasal, lalu pilih "Tandai pasal ini".' })) : null,
      [...groups.entries()].map(([id, list]) => h('div', { class: 'panel' },
        h('header', null, h('h2', { text: S.regMap[id].title }), h('span', { class: 'chip', text: groupLabel(S.regMap[id].group) })),
        h('div', { class: 'list' }, list.map(m => h('div', { class: 'li-wrap' }, markRow(m, true),
          h('button', { type: 'button', class: 'icon-btn sm', title: 'Hapus penanda', 'aria-label': 'Hapus penanda', onclick: () => toggleMark(m.id, m.row, m.label, false).then(renderMarks) }, icon('trash')))))))));
  }

  /* ================= Pembaca naskah ================= */
  function stopRender() { if (S.render) S.render.stop = true; S.render = null; if (S.observer) { S.observer.disconnect(); S.observer = null; } }
  async function openDoc(id, row, nav) {
    const reg = S.regMap[id];
    if (!reg) { failed('Regulasi tidak ditemukan atau Anda tidak memiliki akses.'); return; }
    if (S.docId !== id || !content().querySelector('.doc')) {
      stopRender();
      let doc = S.lib.get(id);
      if (!doc || doc.rev !== reg.rev) {
        loading('Memuat ' + reg.title + '…');
        try { doc = await getDoc(id); } catch (e) { if (nav === S.nav) failed(e.message, () => openDoc(id, row, ++S.nav)); return; }
        if (nav !== S.nav) return;
      }
      if (S.docId !== id) { S.ver = doc.defaultVersion || 'utuh'; S.cmp = ''; S.onlyDiff = false; S.tocFold = new Set(); S.find.q = ''; }
      S.doc = doc; S.docId = id;
      renderDoc();
      logRead(id);
    }
    setSideTab(isWide() ? 'toc' : S.sideTab);
    pushRecent(id, row);
    if (row) requestAnimationFrame(() => scrollToRow(row, true)); else window.scrollTo(0, 0);
  }

  function fileBadge(t) {
    const map = { PDF: 'PDF', WORD: 'DOC', EXCEL: 'XLS', PPT: 'PPT', GDOC: 'DOCS', GSHEET: 'SHEET', GSLIDE: 'SLIDE', GFORM: 'FORM', GAMBAR: 'IMG', FOLDER: 'DIR', WEB: 'WEB', DRIVE: 'FILE', BERKAS: 'FILE' };
    return h('span', { class: 'fbadge t-' + String(t || 'BERKAS').toLowerCase(), text: map[t] || 'FILE' });
  }
  const TYPE_LABEL = { PDF: 'PDF', WORD: 'Word', EXCEL: 'Excel', PPT: 'PowerPoint', GDOC: 'Google Docs', GSHEET: 'Google Sheets', GSLIDE: 'Google Slides', GFORM: 'Google Form', GAMBAR: 'Gambar', FOLDER: 'Folder Drive', WEB: 'Situs web', DRIVE: 'Berkas Drive', BERKAS: 'Berkas' };
  function previewUrl(d) {
    if (!d.fileId) return '';
    if (d.type === 'GDOC') return 'https://docs.google.com/document/d/' + d.fileId + '/preview';
    if (d.type === 'GSHEET') return 'https://docs.google.com/spreadsheets/d/' + d.fileId + '/preview';
    if (d.type === 'GSLIDE') return 'https://docs.google.com/presentation/d/' + d.fileId + '/preview';
    if (d.type === 'GFORM') return '';
    if (d.type === 'FOLDER') return 'https://drive.google.com/embeddedfolderview?id=' + d.fileId + '#list';
    return 'https://drive.google.com/file/d/' + d.fileId + '/preview';
  }
  const SHARE_WARN = { PRIVATE: 'Belum dibagikan — pengguna lain tidak bisa membuka', TIDAK_TERJANGKAU: 'Tidak dapat diperiksa oleh akun skrip', DOMAIN: 'Hanya untuk domain tertentu', DOMAIN_WITH_LINK: 'Hanya untuk domain tertentu' };
  function fileCard(d, admin) {
    const pv = previewUrl(d);
    const info = [TYPE_LABEL[d.type] || 'Berkas', fmtSize(d.size), d.name && d.name !== d.title ? d.name : ''].filter(Boolean).join(' · ');
    return h('div', { class: 'file' }, fileBadge(d.type),
      h('div', { class: 'file-info' }, h('strong', { text: d.title }), h('small', { text: info }),
        admin && SHARE_WARN[d.sharing] ? h('small', { class: 'warn-t' }, icon('alert'), SHARE_WARN[d.sharing]) : null),
      h('div', { class: 'file-act' },
        pv ? h('button', { type: 'button', class: 'btn small ghost', onclick: () => previewFile(d, pv) }, icon('eye'), h('span', { class: 'hide-xs', text: 'Pratinjau' })) : null,
        h('a', { class: 'btn small', href: d.url, target: '_blank', rel: 'noopener noreferrer' }, icon('external'), h('span', { class: 'hide-xs', text: 'Buka' }))));
  }
  function previewFile(d, url) {
    modal({ title: d.title, size: 'xl', flush: true, ok: null, cancel: 'Tutup',
      left: h('a', { class: 'btn ghost', href: d.url, target: '_blank', rel: 'noopener noreferrer' }, icon('external'), 'Buka di tab baru'),
      body: h('div', { class: 'preview' }, h('iframe', { src: url, title: 'Pratinjau ' + d.title, allow: 'autoplay', referrerpolicy: 'no-referrer' }),
        h('p', { class: 'preview-note', text: 'Bila pratinjau kosong, buka di tab baru. Berkas Drive hanya tampil bila dibagikan atau Anda masuk dengan akun Google yang berhak.' })) });
  }

  function renderDoc() {
    const d = S.doc, m = S.regMap[S.docId], vers = d.versions || [];
    const admin = S.user.role === 'ADMIN';
    const vname = k => ((vers.find(v => v.key === k) || {}).name || '');
    const verSel = select('ver', vers.map(v => [v.key, v.name + (v.filled ? '' : ' (kosong)')]), S.ver);
    const cmpSel = select('cmp', [['', 'Tanpa pembanding']].concat(vers.filter(v => v.key !== S.ver).map(v => [v.key, v.name + (v.filled ? '' : ' (kosong)')])), S.cmp);
    verSel.addEventListener('change', () => { S.ver = verSel.value; if (S.cmp === S.ver) S.cmp = ''; keepAnchor(renderDoc); });
    cmpSel.addEventListener('change', () => { S.cmp = cmpSel.value; S.onlyDiff = false; keepAnchor(renderDoc); });
    const reading = document.body.classList.contains('reading');
    const tb = (ic, label, onClick, cls) => h('button', { type: 'button', class: 'tb' + (cls ? ' ' + cls : ''), title: label, 'aria-label': label, onclick: onClick }, icon(ic), h('span', { class: 'tb-l', text: label }));
    const moreBtn = tb('more', 'Lainnya', e => popMenu(e.currentTarget, [
      { icon: 'printer', label: 'Cetak / simpan PDF', onClick: printDoc },
      { icon: 'link', label: 'Salin tautan regulasi', onClick: () => copyText(appLink(S.docId), 'Tautan regulasi disalin.') },
      { icon: 'refresh', label: 'Muat ulang naskah ini', onClick: async () => { try { S.doc = await getDoc(S.docId, true); keepAnchor(renderDoc); toast('Naskah dimuat ulang.', 'ok'); } catch (err) { toast(err.message, 'error'); } } },
      admin ? '-' : null,
      admin ? { icon: 'settings', label: 'Atur regulasi ini', onClick: () => { location.hash = '#/admin/regs'; } } : null
    ]));
    const findInput = h('input', { type: 'text', placeholder: 'Cari dalam naskah…', 'aria-label': 'Cari dalam naskah', value: S.find.q });
    const findCount = h('span', { class: 'find-count' });
    const findBar = h('div', { class: 'bar-row find-row', hidden: !S.find.q },
      icon('search'), findInput, findCount,
      h('button', { type: 'button', class: 'icon-btn sm', title: 'Sebelumnya', onclick: () => findGo(-1) }, icon('chevUp')),
      h('button', { type: 'button', class: 'icon-btn sm', title: 'Berikutnya', onclick: () => findGo(1) }, icon('chevDown')),
      h('button', { type: 'button', class: 'icon-btn sm', title: 'Tutup', onclick: () => { findBar.hidden = true; findInput.value = ''; runFind(''); } }, icon('x')));
    let ft;
    findInput.addEventListener('input', () => { clearTimeout(ft); ft = setTimeout(() => runFind(findInput.value), 250); });
    findInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findGo(e.shiftKey ? -1 : 1); } });
    S.find.countEl = findCount;
    const diffOn = Prefs.get('diff', true);
    const cmpBar = S.cmp ? h('div', { class: 'bar-row cmp-row' },
      h('span', { class: 'cmp-names' }, h('b', { text: 'Kiri: ' }), vname(S.ver), h('b', { text: '  Kanan: ' }), vname(S.cmp)),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: diffOn, onchange: e => { Prefs.set('diff', e.target.checked); keepAnchor(renderDoc); } }), 'Sorot perbedaan'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.onlyDiff, onchange: e => { S.onlyDiff = e.target.checked; renderDoc(); window.scrollTo(0, 0); } }), 'Hanya yang berbeda'),
      diffOn ? h('span', { class: 'legend' }, h('span', { class: 'd-del', text: 'hanya di kiri' }), h('span', { class: 'd-ins', text: 'hanya di kanan' })) : null) : null;
    const bar = h('div', { class: 'doc-bar' },
      h('div', { class: 'bar-row' },
        h('label', { class: 'sel', title: 'Versi naskah' }, icon('layers'), verSel),
        h('label', { class: 'sel', title: 'Bandingkan dengan' }, icon('columns'), cmpSel),
        h('span', { class: 'grow' }),
        tb('search', 'Cari', () => { findBar.hidden = false; findInput.focus(); }),
        h('span', { class: 'seg' }, h('button', { type: 'button', title: 'Perkecil huruf', onclick: () => setFont(-1) }, 'A−'), h('button', { type: 'button', title: 'Perbesar huruf', onclick: () => setFont(1) }, 'A+')),
        tb(reading ? 'minimize' : 'maximize', reading ? 'Keluar mode baca' : 'Mode baca', () => toggleReading(), reading ? 'on' : ''),
        tb('list', 'Daftar isi', () => { setSideTab('toc'); openDrawer(); }, 'hide-wide'),
        moreBtn),
      cmpBar, findBar);
    const head = h('header', { class: 'doc-head' },
      h('div', { class: 'crumbs' }, h('a', { href: '#/kategori/' + encodeURIComponent(m.group), text: groupLabel(m.group) }), m.restricted ? h('span', { class: 'chip pink xs', text: 'Terbatas' }) : null),
      h('h1', { text: m.title }),
      (m.verification || m.notes) ? h('p', { class: 'doc-meta', text: [m.verification && 'Diverifikasi ' + m.verification, m.notes].filter(Boolean).join(' · ') }) : null,
      m.docs && m.docs.length ? h('div', { class: 'orig' }, h('div', { class: 'orig-label', text: 'Dokumen asli' }), h('div', { class: 'orig-list' }, m.docs.map(x => fileCard(x, admin)))) : null);
    const article = h('article', { class: 'law' });
    const printHead = h('div', { class: 'print-head' }, h('strong', { text: m.title }),
      h('div', { text: vname(S.ver) + (S.cmp ? ' dibandingkan dengan ' + vname(S.cmp) : '') }),
      h('small', { text: 'Dicetak dari Pusat Referensi Regulasi YEH, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) }));
    content().replaceChildren(h('section', { class: 'doc' }, head, bar, printHead, article));
    startRender(article);
    renderToc();
    renderRegs();
    if (S.find.q) { findBar.hidden = false; runFind(S.find.q); }
  }

  /* --- Model naskah --- */
  function buildModel() {
    const d = S.doc, v = S.ver, c = S.cmp, only = S.onlyDiff && !!c;
    const items = [], toc = [];
    const cur = { bab: '', pasal: '' };
    let pend = [], curB = null;
    const head = it => { if (only) pend.push(it); else items.push(it); };
    for (const r of d.rows) {
      const t = r.t || {}, txt = tks(t, v, r.sama), ct = c ? tks(t, c, r.sama) : '';
      if (r.bab && r.bab !== cur.bab) {
        cur.bab = r.bab; cur.pasal = '';
        const titleRow = !r.pasal && !r.ayat && !r.poin && !r.subpoin;
        const title = titleRow ? (txt || ct) : '';
        if (only) pend = [];
        head({ k: 'bab', row: r.row, label: fmtBab(r.bab), title });
        curB = { label: fmtBab(r.bab), title, row: r.row, pasals: [] }; toc.push(curB);
        if (titleRow) continue;
      }
      if (r.pasal && r.pasal !== cur.pasal) {
        cur.pasal = r.pasal;
        if (only) pend = pend.filter(x => x.k !== 'pasal');
        head({ k: 'pasal', row: r.row, label: fmtPasal(r.pasal) });
        if (!curB) { curB = { label: '', title: '', row: r.row, pasals: [] }; toc.push(curB); }
        curB.pasals.push({ num: r.pasal, row: r.row });
      }
      if (!txt && !ct) continue;
      const same = !c || normSp(txt) === normSp(ct);
      if (only && same) continue;
      if (pend.length) { items.push(...pend); pend = []; }
      items.push({ k: 'para', row: r.row, txt, ct, same,
        mk: r.subpoin ? fmtPoin(r.subpoin) : r.poin ? fmtPoin(r.poin) : r.ayat ? fmtAyat(r.ayat) : '',
        lvl: r.subpoin ? 3 : r.poin ? 2 : r.ayat ? 1 : 0,
        path: { bab: cur.bab, pasal: cur.pasal, ayat: r.ayat, poin: r.poin, subpoin: r.subpoin } });
    }
    return { items, toc };
  }

  /* --- Perbedaan kata --- */
  function diffWords(a, b) {
    const A = a.match(/\s+|[^\s]+/g) || [], B = b.match(/\s+|[^\s]+/g) || [];
    const n = A.length, m = B.length;
    if (n * m > 600000) return null;
    const L = new Uint16Array((n + 1) * (m + 1)), W = m + 1;
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i * W + j] = A[i] === B[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
    const left = [], right = [];
    let i = 0, j = 0;
    const add = (arr, t, mark) => { const last = arr[arr.length - 1]; if (last && last.m === mark) last.t += t; else arr.push({ t, m: mark }); };
    while (i < n && j < m) {
      if (A[i] === B[j]) { add(left, A[i], false); add(right, B[j], false); i++; j++; }
      else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) { add(left, A[i], !/^\s+$/.test(A[i])); i++; }
      else { add(right, B[j], !/^\s+$/.test(B[j])); j++; }
    }
    while (i < n) { add(left, A[i], !/^\s+$/.test(A[i])); i++; }
    while (j < m) { add(right, B[j], !/^\s+$/.test(B[j])); j++; }
    return { left, right };
  }
  function txNode(parts, cls) {
    const el = h('div', { class: 'tx' });
    parts.forEach(p => el.append(p.m ? h('span', { class: cls, text: p.t }) : document.createTextNode(p.t)));
    return el;
  }

  /* --- Tampilan bertahap --- */
  function startRender(article) {
    stopRender();
    const model = buildModel();
    S.model = model;
    S.rowInfo = new Map();
    const vn = k => (((S.doc.versions || []).find(v => v.key === k) || {}).name || '');
    const st = { items: model.items, i: 0, article, sec: null, stop: false, diff: Prefs.get('diff', true), lv: vn(S.ver), lc: vn(S.cmp) };
    S.render = st;
    S.observer = 'IntersectionObserver' in window ? new IntersectionObserver(onPasalSeen, { rootMargin: '-110px 0px -65% 0px' }) : null;
    if (!st.items.length) article.append(h('p', { class: 'state', text: S.onlyDiff ? 'Tidak ada perbedaan antara kedua versi.' : 'Naskah pada versi ini masih kosong. Pilih versi lain.' }));
    renderChunk(st, 160);
    const step = () => { if (st.stop || st.i >= st.items.length) return; renderChunk(st, 300); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function renderAll() { const st = S.render; if (st && !st.stop) renderChunk(st, Infinity); }
  function renderChunk(st, n) {
    const end = Math.min(st.items.length, st.i + n), marks = new Set(S.marks.filter(x => x.id === S.docId).map(x => x.row));
    const frag = document.createDocumentFragment();
    let sec = st.sec;
    const newSec = () => { sec = h('section', { class: 'sec' }); frag.append(sec); };
    if (!sec) newSec();
    for (; st.i < end; st.i++) {
      const it = st.items[st.i];
      if (it.k === 'bab') {
        if (sec.childNodes.length) newSec();
        sec.append(h('div', { class: 'h-bab', id: 'h-' + it.row }, h('div', { class: 'no', text: it.label }), it.title ? h('div', { class: 'ttl', text: it.title }) : null));
      } else if (it.k === 'pasal') {
        const el = h('h3', { class: 'h-pasal', id: 'h-' + it.row, 'data-row': it.row, text: it.label });
        sec.append(el); if (S.observer) S.observer.observe(el);
      } else {
        let body;
        if (S.cmp) {
          const dw = st.diff && !it.same && it.txt && it.ct ? diffWords(it.txt, it.ct) : null;
          const left = dw ? txNode(dw.left, 'd-del') : h('div', { class: 'tx' + (it.txt ? '' : ' empty-tx'), text: it.txt || 'Tidak ada teks pada versi ini.' });
          const right = dw ? txNode(dw.right, 'd-ins') : h('div', { class: 'tx' + (it.ct ? '' : ' empty-tx'), text: it.ct || 'Tidak ada teks.' });
          if (st.diff && !it.same && !dw) { if (it.txt) left.classList.add('d-all-del'); if (it.ct) right.classList.add('d-all-ins'); }
          body = h('div', { class: 'cmp' + (it.same ? '' : ' changed') },
            h('div', { class: 'cmpc' }, h('span', { class: 'lbl', text: st.lv }), left), h('div', { class: 'cmpc' }, h('span', { class: 'lbl', text: st.lc }), right));
        } else body = h('div', { class: 'tx', text: it.txt });
        sec.append(h('div', { class: 'para lvl-' + it.lvl + (marks.has(it.row) ? ' marked' : ''), id: 'row-' + it.row, 'data-row': it.row },
          h('span', { class: 'mk', text: it.mk }), body,
          h('button', { type: 'button', class: 'pa', 'data-row': it.row, title: 'Tindakan', 'aria-label': 'Tindakan untuk ketentuan ini' }, icon('more'))));
        S.rowInfo.set(it.row, it);
      }
    }
    st.sec = sec;
    st.article.append(frag);
  }

  /* --- Daftar isi --- */
  function renderToc() {
    const pane = $('#paneToc'), m = S.regMap[S.docId];
    if (!S.doc || !m) { pane.replaceChildren(); return; }
    const toc = S.model.toc;
    const jump = h('input', { type: 'search', placeholder: 'Ke pasal… (mis. 81)', inputmode: 'numeric', 'aria-label': 'Ke pasal' });
    jump.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const q = norm(jump.value).replace(/^pasal\s*/, '');
      for (const b of toc) { const p = b.pasals.find(x => norm(x.num) === q); if (p) { gotoRow(p.row, true); return; } }
      toast('Pasal ' + jump.value + ' tidak ditemukan.', 'error');
    });
    const list = h('div', { class: 'toc' });
    toc.forEach((b, bi) => {
      const open = !S.tocFold.has(bi);
      const bh = h('button', { type: 'button', class: 'toc-bh', 'aria-expanded': String(open) }, icon(open ? 'chevDown' : 'chevRight'),
        h('span', null, h('b', { text: b.label || 'Bagian awal' }), b.title ? h('small', { text: b.title }) : null));
      bh.addEventListener('click', () => { if (open) S.tocFold.add(bi); else S.tocFold.delete(bi); renderToc(); });
      list.append(h('div', { class: 'toc-bab' }, bh, open && b.pasals.length ? h('div', { class: 'toc-grid' }, b.pasals.map(p =>
        h('a', { href: '#', class: 'toc-p', 'data-row': p.row, title: fmtPasal(p.num), onclick: e => { e.preventDefault(); gotoRow(p.row, true); } }, p.num))) : null));
    });
    pane.replaceChildren(h('div', { class: 'toc-head' }, h('strong', { text: m.title }), h('small', { text: S.doc.versions.find(v => v.key === S.ver)?.name || '' }), jump), list);
  }
  function gotoRow(row, flash, heading) { if (!isWide()) closeDrawer(); scrollToRow(row, flash, heading); }
  function onPasalSeen(entries) {
    const vis = entries.filter(e => e.isIntersecting);
    if (!vis.length) return;
    const row = Number(vis[0].target.dataset.row);
    document.querySelectorAll('#paneToc .toc-p.on').forEach(x => x.classList.remove('on'));
    const chip = document.querySelector('#paneToc .toc-p[data-row="' + row + '"]');
    if (chip) { chip.classList.add('on'); if (!$('#paneToc').hidden) chip.scrollIntoView({ block: 'nearest' }); }
    clearTimeout(S.recentT); S.recentT = setTimeout(() => { if (S.docId) pushRecent(S.docId, row); }, 1500);
  }
  function stickyOffset() {
    let off = $('.topbar').offsetHeight + 8;
    const bar = document.querySelector('.doc-bar');
    if (bar && getComputedStyle(bar).position === 'sticky') off += bar.offsetHeight;
    return off;
  }
  function scrollToRow(row, flash, heading) {
    renderAll();
    let el = (heading && document.getElementById('h-' + row)) || document.getElementById('row-' + row) || document.getElementById('h-' + row);
    if (!el) { const all = [...document.querySelectorAll('.law [id^="row-"],.law [id^="h-"]')]; el = all.find(x => Number(x.id.replace(/^\D+/, '')) >= row) || null; }
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - stickyOffset(), behavior: 'smooth' });
    if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }
  function keepAnchor(fn) {
    const off = stickyOffset();
    const anchor = [...document.querySelectorAll('.law [id^="row-"],.law [id^="h-"]')].find(x => x.getBoundingClientRect().bottom > off);
    const id = anchor ? anchor.id : '';
    fn();
    if (id) { renderAll(); const el = document.getElementById(id); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off); }
  }
  function toggleReading(force) {
    const on = force === undefined ? !document.body.classList.contains('reading') : force;
    document.body.classList.toggle('reading', on);
    if (S.doc && content().querySelector('.doc')) keepAnchor(renderDoc);
  }

  /* --- Cari dalam naskah --- */
  function clearFind() {
    S.find.marks.forEach(mk => { const p = mk.parentNode; if (p) { p.replaceChild(document.createTextNode(mk.textContent), mk); p.normalize(); } });
    S.find.marks = []; S.find.i = -1;
  }
  function runFind(q) {
    clearFind();
    S.find.q = q = String(q || '').trim();
    const cnt = S.find.countEl;
    if (q.length < 2) { if (cnt) cnt.textContent = ''; return; }
    renderAll();
    const low = q.toLocaleLowerCase('id');
    document.querySelectorAll('.law .tx').forEach(tx => {
      const walker = document.createTreeWalker(tx, NodeFilter.SHOW_TEXT), nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        const text = node.nodeValue, lt = text.toLocaleLowerCase('id');
        let idx = lt.indexOf(low);
        if (idx < 0) return;
        const frag = document.createDocumentFragment();
        let last = 0;
        while (idx >= 0) {
          frag.append(document.createTextNode(text.slice(last, idx)));
          const mk = h('mark', { class: 'fm', text: text.slice(idx, idx + q.length) }); frag.append(mk); S.find.marks.push(mk);
          last = idx + q.length; idx = lt.indexOf(low, last);
        }
        frag.append(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    });
    if (cnt) cnt.textContent = S.find.marks.length ? '' : 'Tidak ada';
    if (S.find.marks.length) findGo(1, true);
  }
  function findGo(dir, first) {
    const ms = S.find.marks; if (!ms.length) return;
    if (ms[S.find.i]) ms[S.find.i].classList.remove('cur');
    S.find.i = first ? 0 : (S.find.i + dir + ms.length) % ms.length;
    const mk = ms[S.find.i]; mk.classList.add('cur');
    window.scrollTo({ top: mk.getBoundingClientRect().top + window.scrollY - stickyOffset() - 40, behavior: 'smooth' });
    if (S.find.countEl) S.find.countEl.textContent = (S.find.i + 1) + '/' + ms.length;
  }

  /* --- Tindakan per ketentuan --- */
  document.addEventListener('click', e => {
    const btn = e.target.closest('.law .pa');
    if (btn) {
      const row = Number(btn.dataset.row), it = S.rowInfo.get(row); if (!it) return;
      const m = S.regMap[S.docId], marked = S.marks.some(x => x.id === S.docId && x.row === row);
      const text = it.txt || it.ct, path = pathOf(it.path);
      const vname = ((S.doc.versions || []).find(v => v.key === S.ver) || {}).name || '';
      const src = S.ver === 'utuh' ? m.title + ' (naskah berlaku)' : vname;
      const cp = citePath(it.path);
      popMenu(btn, [
        { head: path || 'Ketentuan', sub: m.title },
        { icon: 'copy', label: 'Salin teks', onClick: () => copyText(text, 'Teks disalin.') },
        { icon: 'quote', label: 'Salin sebagai kutipan', onClick: () => copyText((cp ? cp + ' ' : '') + src + ':\n“' + text + '”', 'Kutipan disalin.') },
        { icon: 'link', label: 'Salin tautan pasal', onClick: () => copyText(appLink(S.docId, row), 'Tautan pasal disalin.') },
        '-',
        { icon: 'star', label: marked ? 'Hapus penanda' : 'Tandai pasal ini', on: marked, onClick: () => toggleMark(S.docId, row, path, !marked) }
      ]);
      return;
    }
    const p = e.target.closest('.law .para');
    if (p && !window.getSelection().toString()) {
      const was = p.classList.contains('sel');
      document.querySelectorAll('.law .para.sel').forEach(x => x.classList.remove('sel'));
      if (!was) p.classList.add('sel');
    }
  });
  async function toggleMark(id, row, label, on) {
    try {
      const res = await req('bookmarkSave', { id, row, label, on });
      S.marks = res.bookmarks || []; updateMarkCount();
      const el = id === S.docId && document.getElementById('row-' + row); if (el) el.classList.toggle('marked', on);
      toast(on ? 'Pasal ditandai.' : 'Penanda dihapus.', 'ok');
    } catch (e) { toast(e.message, 'error'); }
  }

  /* --- Cetak --- */
  async function printDoc() {
    const off = stickyOffset();
    renderAll();
    const secs = [...document.querySelectorAll('.law .sec')];
    const cur = secs.find(s => s.getBoundingClientRect().bottom > off) || secs[0];
    const curTitle = cur && cur.querySelector('.h-bab .no') ? cur.querySelector('.h-bab .no').textContent + (cur.querySelector('.h-bab .ttl') ? ' — ' + cur.querySelector('.h-bab .ttl').textContent : '') : '';
    const scope = select('scope', [['all', 'Seluruh naskah'], ['bab', curTitle ? 'Hanya ' + curTitle : 'Hanya bagian yang sedang dibaca']], 'all');
    const ok = await modal({ title: 'Cetak / simpan PDF', ok: 'Lanjut cetak',
      body: h('div', null, field('Bagian yang dicetak', scope),
        h('p', { class: 'muted', text: 'Pada jendela cetak, pilih printer atau "Simpan sebagai PDF". Versi dan pembanding yang sedang tampil ikut tercetak.' })) });
    if (!ok) return;
    if (scope.value === 'bab' && cur) secs.forEach(s => s.classList.toggle('no-print', s !== cur));
    const done = () => { secs.forEach(s => s.classList.remove('no-print')); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 120);
  }

  /* ================= Pencarian isi ================= */
  function localSearch(q, group) {
    const words = norm(q).split(' ').filter(Boolean), out = [];
    let truncated = false;
    for (const r of S.regs) {
      if (group && r.group !== group) continue;
      const d = S.lib.get(r.id); if (!d) continue;
      let bab = '', pasal = '';
      for (const row of d.rows) {
        if (row.bab && row.bab !== bab) { bab = row.bab; pasal = ''; }
        if (row.pasal) pasal = row.pasal;
        const txt = String(row.t.utuh || row.t.dasar || ''); if (!txt) continue;
        const n = row._n || (row._n = norm(txt));
        if (!words.every(w => n.includes(w))) continue;
        const pos = Math.max(0, txt.toLowerCase().indexOf(words[0])), start = Math.max(0, pos - 110);
        out.push({ id: r.id, title: r.title, group: r.group, row: row.row, bab, pasal, ayat: row.ayat || '', poin: row.poin || '',
          excerpt: (start > 0 ? '… ' : '') + txt.slice(start, start + 340) + (start + 340 < txt.length ? ' …' : '') });
        if (out.length >= 300) { truncated = true; break; }
      }
      if (truncated) break;
    }
    return { results: out, truncated, skipped: [], local: true };
  }
  async function runSearch(q, nav) {
    $('#searchInput').value = q;
    const key = q + '|' + S.searchGroup + '|' + libReady();
    if (!S.search || S.search.key !== key) {
      if (libReady()) S.search = { key, q, res: localSearch(q, S.searchGroup) };
      else {
        const pakaiCermin = S.cermin && Cermin && Cermin.siap();
        loading(pakaiCermin
          ? 'Mencari "' + q + '" …'
          : 'Mencari "' + q + '" di server… Pustaka di perangkat belum lengkap, jadi pencarian bisa memakan waktu.');
        let res = null;
        if (pakaiCermin) {
          try {
            const hasil = await Cermin.cari(q, S.searchGroup, 120);
            res = { results: hasil, truncated: hasil.length >= 120, skipped: [] };
            Cermin.ukur.sumber = 'cermin';
          } catch (e) { res = null; }
        }
        if (!res) {
          try { res = await req('search', { query: q, group: S.searchGroup }); if (Cermin) Cermin.ukur.sumber = 'Apps Script'; }
          catch (e) { if (nav === S.nav) failed(e.message, () => { S.search = null; runSearch(q, ++S.nav); }); return; }
        }
        S.search = { key, q, res };
        if (nav !== S.nav) return;
      }
    }
    renderResults(); window.scrollTo(0, 0);
  }
  function highlight(text, words) {
    const esc = words.filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!esc.length) return [text];
    return text.split(new RegExp('(' + esc.join('|') + ')', 'gi')).map((p, i) => i % 2 ? h('mark', { text: p }) : p);
  }
  function renderResults() {
    const { q, res } = S.search, words = norm(q).split(' ');
    const list = res.results || [], byReg = new Map();
    list.forEach(x => { if (!byReg.has(x.id)) byReg.set(x.id, []); byReg.get(x.id).push(x); });
    const titleHits = S.regs.filter(r => (!S.searchGroup || r.group === S.searchGroup) && words.every(w => norm(r.title).includes(w)));
    const gsel = select('grp', [['', 'Semua kategori']].concat(orderedGroups(S.regs).map(g => [g, groupLabel(g)])), S.searchGroup);
    gsel.addEventListener('change', () => { S.searchGroup = gsel.value; runSearch(q, ++S.nav); });
    const sub = list.length ? list.length + ' ketentuan di ' + byReg.size + ' regulasi' + (res.truncated ? ' (dibatasi; perjelas kata kunci)' : '') : 'Tidak ada ketentuan yang memuat semua kata tersebut.';
    content().replaceChildren(h('section', { class: 'page results' },
      pageHead('Hasil pencarian "' + q + '"', sub + (res.local ? ' · dicari di perangkat' : ''), h('label', { class: 'sel plain' }, h('span', { text: 'Kategori' }), gsel)),
      titleHits.length ? h('div', { class: 'title-hits' }, h('span', { class: 'muted', text: 'Judul yang cocok:' }), titleHits.map(r => h('a', { class: 'chip link', href: '#/r/' + encodeURIComponent(r.id), text: r.title }))) : null,
      res.skipped && res.skipped.length ? h('p', { class: 'note', text: 'Tidak dapat dibaca: ' + res.skipped.join(', ') + '.' }) : null,
      [...byReg.entries()].map(([id, items]) => h('div', { class: 'panel res-group' },
        h('header', null, h('h2', { text: items[0].title }), h('span', { class: 'chip', text: groupLabel(items[0].group) }), h('span', { class: 'muted', text: items.length + ' temuan' })),
        items.map(x => h('a', { class: 'res', href: '#/r/' + encodeURIComponent(id) + '/' + x.row },
          h('div', { class: 'res-path', text: pathOf(x) || 'Bagian awal' }), h('p', null, highlight(x.excerpt, words))))))));
  }

  /* ================= Panel Admin ================= */
  const ROLE = { ADMIN: 'Admin', USER: 'Pengguna' };
  const TABS = [['users', 'Pengguna'], ['groups', 'Kelompok'], ['regs', 'Regulasi'], ['access', 'Izin dokumen'], ['activity', 'Aktivitas']];
  async function showAdmin(tab, nav) {
    if (S.user.role !== 'ADMIN') { location.hash = '#/'; return; }
    if (!S.admin) {
      loading('Memuat data admin…');
      try { S.admin = await req('adminData'); } catch (e) { if (nav === S.nav) failed(e.message, () => showAdmin(tab, ++S.nav)); return; }
      if (nav !== S.nav) return;
    }
    renderAdmin(TABS.some(t => t[0] === tab) ? tab : 'users');
    window.scrollTo(0, 0);
  }
  function renderAdmin(tab) {
    const body = tab === 'groups' ? adminGroups() : tab === 'regs' ? adminRegs() : tab === 'access' ? adminAccess() : tab === 'activity' ? adminActivity() : adminUsers();
    content().replaceChildren(h('section', { class: 'page admin' },
      pageHead('Panel Admin', 'Perubahan langsung tersimpan di spreadsheet konfigurasi.'),
      h('nav', { class: 'tabs' }, TABS.map(([k, l]) => h('a', { href: '#/admin/' + k, class: k === tab ? 'on' : null }, l))),
      body));
  }
  function rerenderAdmin() { const r = parseHash(); if (r.name === 'admin') renderAdmin(r.tab); }
  function table(cols, rows, empty) {
    if (!rows.length) return h('div', { class: 'panel' }, h('p', { class: 'empty', text: empty || 'Belum ada data.' }));
    return h('div', { class: 'table-wrap' }, h('table', { class: 'grid' },
      h('thead', null, h('tr', null, cols.map(c => h('th', { class: c.cls, text: c.label })))),
      h('tbody', null, rows.map(r => h('tr', null, cols.map(c => h('td', { class: c.cls }, c.render(r))))))));
  }
  function filterBar(placeholder, onInput, ...buttons) {
    const inp = h('input', { type: 'search', placeholder });
    inp.addEventListener('input', () => onInput(norm(inp.value)));
    return h('div', { class: 'bar' }, inp, h('span', { class: 'spacer' }), buttons);
  }
  const gname = id => { const g = (S.admin.groups || []).find(x => x.id === id); return g ? g.name : pretty(id); };
  const uname = id => { if (id === 'EDITOR_SPREADSHEET') return 'Editor spreadsheet'; if (id === 'SYSTEM' || id === 'SCRIPT_EDITOR') return 'Sistem'; const u = (S.admin && S.admin.users || []).find(x => norm(x.id) === norm(id)); return u ? (u.name || u.id) : id; };
  const statusChip = (on, yes, no) => h('span', { class: 'chip ' + (on ? 'ok' : 'off'), text: on ? yes : no });
  const actBtn = (label, onClick, cls) => h('button', { class: 'btn small ' + (cls || 'ghost'), type: 'button', onclick: onClick }, label);

  function showTemp(id, temp, what) {
    return modal({ title: 'Sandi sementara', ok: 'Selesai', cancel: null,
      body: h('div', null,
        h('p', { text: 'Sandi akun "' + id + '" ' + what + '. Sampaikan sandi berikut kepada pemilik akun:' }),
        h('div', { class: 'secret' }, h('code', { text: temp }), h('button', { type: 'button', class: 'btn', onclick: () => copyText(temp, 'Sandi sementara disalin.') }, icon('copy'), 'Salin')),
        h('p', { class: 'muted', text: 'Sandi ini hanya tampil sekali dan tidak disimpan di sheet. Pemilik akun wajib menggantinya saat masuk pertama.' })) });
  }

  function adminUsers() {
    const wrap = h('div');
    const draw = q => {
      const rows = S.admin.users.filter(u => !q || norm(u.id + ' ' + u.name + ' ' + u.groups.map(gname).join(' ')).includes(q));
      wrap.replaceChildren(table([
        { label: 'Pengguna', render: u => [h('strong', { text: u.name || u.id }), h('span', { class: 'sub', text: u.id })] },
        { label: 'Peran', render: u => h('span', { class: 'chip' + (u.role === 'ADMIN' ? ' pink' : ''), text: ROLE[u.role] }) },
        { label: 'Kelompok', render: u => u.groups.length ? h('div', { class: 'chips' }, u.groups.map(g => h('span', { class: 'chip off', text: gname(g) }))) : h('span', { class: 'muted', text: '—' }) },
        { label: 'Status', render: u => h('div', { class: 'chips' }, statusChip(u.active === 'YA', 'Aktif', 'Nonaktif'),
          u.mustChange ? h('span', { class: 'chip warn', text: 'Belum ganti sandi' }) : null, u.locked ? h('span', { class: 'chip danger', text: 'Terkunci' }) : null) },
        { label: '', cls: 'act', render: u => [actBtn('Ubah', () => editUser(u)), actBtn('Atur ulang sandi', () => resetUser(u), 'outline')] }
      ], rows, 'Tidak ada pengguna yang cocok.'));
    };
    draw('');
    return h('div', null, filterBar('Cari pengguna…', draw, h('button', { class: 'btn primary', type: 'button', onclick: () => editUser(null) }, icon('plus'), 'Tambah pengguna')), wrap);
  }
  async function editUser(u) {
    const isNew = !u;
    const id = h('input', { name: 'id', value: u ? u.id : '', readonly: !isNew, autocapitalize: 'none', spellcheck: 'false', required: true });
    const name = h('input', { name: 'name', value: u ? u.name : '', required: true });
    const role = select('role', [['USER', 'Pengguna'], ['ADMIN', 'Admin']], u ? u.role : 'USER');
    const active = select('active', [['YA', 'Aktif'], ['TIDAK', 'Nonaktif']], u ? u.active : 'YA');
    const mine = new Set(u ? u.groups : []);
    const checks = h('div', { class: 'checks' }, S.admin.groups.filter(g => g.active === 'YA' || mine.has(g.id)).map(g =>
      h('label', null, h('input', { type: 'checkbox', value: g.id, checked: mine.has(g.id) }), g.name)));
    const body = h('div', null,
      h('div', { class: 'grid2' }, field('User ID', id, isNew ? 'Huruf, angka, titik, garis bawah, atau minus. Tidak bisa diubah nanti.' : null), field('Nama lengkap', name)),
      h('div', { class: 'grid2' }, field('Peran', role), field('Status', active)),
      h('div', { class: 'field' }, h('span', { text: 'Kelompok' }), checks, h('small', { text: 'Dipakai untuk izin dokumen terbatas.' })),
      isNew ? h('p', { class: 'note', text: 'Sandi sementara dibuat otomatis dan ditampilkan setelah disimpan.' }) : null);
    const res = await modal({ title: isNew ? 'Tambah pengguna' : 'Ubah pengguna', body, size: 'wide',
      onOk: () => {
        if (!id.value.trim()) throw Error('Isi User ID.');
        return req('adminSaveUser', { isNew, user: { id: id.value.trim(), name: name.value.trim(), role: role.value, active: active.value,
          groups: [...checks.querySelectorAll('input:checked')].map(x => x.value) } });
      } });
    if (!res) return;
    S.admin = res.admin; rerenderAdmin();
    if (res.tempPassword) await showTemp(res.id, res.tempPassword, 'baru dibuat');
    else toast('Pengguna disimpan.', 'ok');
  }
  async function resetUser(u) {
    const res = await modal({ title: 'Atur ulang sandi', danger: true, ok: 'Atur ulang', busy: 'Memproses…',
      body: h('p', { text: 'Buat sandi sementara baru untuk ' + (u.name || u.id) + ' (' + u.id + ')? Sandi lama langsung tidak berlaku, sesi yang terbuka ditutup, dan kunci akun dibuka.' }),
      onOk: () => req('adminResetPassword', { id: u.id }) });
    if (!res) return;
    S.admin = res.admin; rerenderAdmin();
    await showTemp(res.id, res.tempPassword, 'telah diatur ulang');
  }

  function adminGroups() {
    const wrap = h('div');
    const draw = q => {
      const rows = S.admin.groups.filter(g => !q || norm(g.id + ' ' + g.name).includes(q));
      wrap.replaceChildren(table([
        { label: 'Kelompok', render: g => [h('strong', { text: g.name }), h('span', { class: 'sub', text: g.id })] },
        { label: 'Anggota', render: g => String(S.admin.users.filter(u => u.groups.includes(g.id)).length) },
        { label: 'Regulasi', render: g => String(S.admin.regulations.filter(r => r.group === g.id).length) },
        { label: 'Status', render: g => statusChip(g.active === 'YA', 'Aktif', 'Nonaktif') },
        { label: '', cls: 'act', render: g => actBtn('Ubah', () => editGroup(g)) }
      ], rows, 'Tidak ada kelompok yang cocok.'));
    };
    draw('');
    return h('div', null, h('p', { class: 'note', text: 'Kelompok dipakai sebagai kategori regulasi sekaligus kelompok pegawai untuk izin dokumen terbatas.' }),
      filterBar('Cari kelompok…', draw, h('button', { class: 'btn primary', type: 'button', onclick: () => editGroup(null) }, icon('plus'), 'Tambah kelompok')), wrap);
  }
  async function editGroup(g) {
    const isNew = !g;
    const id = h('input', { name: 'id', value: g ? g.id : '', readonly: !isNew, required: true });
    const name = h('input', { name: 'name', value: g ? g.name : '', required: true });
    const active = select('active', [['YA', 'Aktif'], ['TIDAK', 'Nonaktif']], g ? g.active : 'YA');
    const res = await modal({ title: isNew ? 'Tambah kelompok' : 'Ubah kelompok',
      body: h('div', null, field('ID kelompok', id, isNew ? 'Contoh: PENGURUS, REKTORAT. Tidak bisa diubah nanti.' : null), field('Nama tampilan', name), field('Status', active)),
      onOk: () => req('adminSaveGroup', { isNew, group: { id: id.value.trim().toUpperCase(), name: name.value.trim(), active: active.value } }) });
    if (!res) return;
    S.admin = res.admin; rerenderAdmin(); toast('Kelompok disimpan.', 'ok'); refreshInitQuiet();
  }

  function adminRegs() {
    const wrap = h('div');
    const warnDocs = r => (r.docs || []).filter(d => SHARE_WARN[d.sharing]).length;
    const draw = q => {
      const rows = S.admin.regulations.filter(r => !q || norm(r.title + ' ' + r.sheet + ' ' + gname(r.group)).includes(q));
      wrap.replaceChildren(table([
        { label: 'Regulasi', render: r => [h('strong', { text: r.title || r.sheet }), h('span', { class: 'sub', text: 'Sheet: ' + r.sheet })] },
        { label: 'Kategori', render: r => gname(r.group) },
        { label: 'Akses', render: r => h('span', { class: 'chip' + (r.access === 'TERBATAS' ? ' pink' : ''), text: r.access === 'TERBATAS' ? 'Terbatas' : 'Internal' }) },
        { label: 'Dokumen asli', render: r => (r.docs || []).length ? h('div', { class: 'chips' }, r.docs.map(d => fileBadge(d.type)), warnDocs(r) ? h('span', { class: 'chip warn', title: 'Ada berkas yang belum dibagikan' }, icon('alert'), String(warnDocs(r))) : null) : h('span', { class: 'muted', text: '—' }) },
        { label: 'Status', render: r => statusChip(r.active === 'YA', 'Tampil', 'Disembunyikan') },
        { label: '', cls: 'act', render: r => actBtn('Ubah', () => editReg(r)) }
      ], rows, 'Tidak ada regulasi yang cocok.'));
    };
    draw('');
    const more = h('button', { class: 'btn', type: 'button', 'aria-haspopup': 'menu' }, icon('more'), 'Lainnya');
    more.addEventListener('click', () => popMenu(more, [
      { icon: 'refresh', label: 'Sinkronkan sheet baru', onClick: syncRegs },
      { icon: 'file', label: 'Periksa ulang tautan dokumen', onClick: recheckDocs },
      { icon: 'layers', label: 'Bersihkan cache naskah', onClick: clearCache }
    ]));
    return h('div', null,
      !S.admin.docsReady ? h('p', { class: 'note warn' }, icon('alert'), 'Sheet Cfg_Dokumen_Asli belum ada. Jalankan berkas RevisiDataV1_4_0 sesuai PANDUAN agar tautan dokumen asli bisa disimpan.') : null,
      filterBar('Cari regulasi…', draw, more), wrap);
  }
  function linksEditor(items) {
    const list = h('div', { class: 'links' });
    const addRow = it => {
      const title = h('input', { placeholder: 'Judul, mis. UU 13/2003 (PDF)', value: it ? it.title : '' });
      const url = h('input', { placeholder: 'https://drive.google.com/…', value: it ? it.url : '', inputmode: 'url' });
      const row = h('div', { class: 'link-row' },
        h('div', { class: 'link-in' }, title, url,
          it && it.type ? h('small', { class: 'link-meta' }, fileBadge(it.type), [TYPE_LABEL[it.type], it.name, fmtSize(it.size)].filter(Boolean).join(' · '),
            SHARE_WARN[it.sharing] ? h('span', { class: 'warn-t' }, icon('alert'), SHARE_WARN[it.sharing]) : null) : null),
        h('button', { type: 'button', class: 'icon-btn sm', title: 'Hapus tautan', 'aria-label': 'Hapus tautan', onclick: () => row.remove() }, icon('trash')));
      row._get = () => ({ title: title.value.trim(), url: url.value.trim() });
      list.append(row);
    };
    (items || []).forEach(addRow);
    if (!(items || []).length) addRow(null);
    const el = h('div', { class: 'field' }, h('span', { text: 'Dokumen asli' }), list,
      h('button', { type: 'button', class: 'btn small ghost add-link', onclick: () => addRow(null) }, icon('plus'), 'Tambah tautan'),
      h('small', { text: 'Tempel tautan Google Drive, Google Docs/Sheets, atau situs (mis. JDIH). Jenis berkas dikenali otomatis saat disimpan. Agar bisa dibuka pengguna lain, bagikan berkas Drive sebagai "Siapa saja yang memiliki link".' }));
    return { el, get: () => [...list.children].map(r => r._get()).filter(x => x.url) };
  }
  async function editReg(r) {
    const title = h('input', { name: 'title', value: r.title, required: true });
    const group = select('group', S.admin.groups.map(g => [g.id, g.name + (g.active === 'YA' ? '' : ' (nonaktif)')]), r.group);
    const access = select('access', [['INTERNAL', 'Internal — semua pengguna'], ['TERBATAS', 'Terbatas — hanya yang diizinkan']], r.access);
    const active = select('active', [['YA', 'Tampil'], ['TIDAK', 'Disembunyikan']], r.active);
    const ver = h('input', { name: 'verification', value: r.verification, placeholder: 'mis. 14/10/2026' });
    const notes = h('textarea', { name: 'notes', rows: 2 }); notes.value = r.notes;
    const full = h('input', { name: 'fullHeader', value: r.fullHeader, placeholder: 'Kosongkan = kolom "Format utuh"' });
    const base = h('input', { name: 'baseHeader', value: r.baseHeader, placeholder: 'Kosongkan = kolom naskah pertama' });
    const links = linksEditor(r.docs);
    const res = await modal({ title: 'Ubah regulasi', size: 'wide',
      body: h('div', null,
        field('Judul tampilan', title),
        h('div', { class: 'grid2' }, field('Kategori', group), field('Status', active)),
        h('div', { class: 'grid2' }, field('Akses', access), field('Tanggal verifikasi', ver)),
        field('Catatan', notes),
        links.el,
        h('details', { class: 'adv' }, h('summary', null, 'Pengaturan kolom sumber (lanjutan)'),
          h('p', { class: 'muted', text: 'Sheet sumber: ' + r.sheet + '. Isi hanya bila judul kolomnya tidak baku.' }),
          field('Judul kolom naskah berlaku', full), field('Judul kolom naskah dasar', base))),
      busy: 'Menyimpan & memeriksa tautan…',
      onOk: () => req('adminSaveRegulation', { reg: { id: r.id, title: title.value, group: group.value, access: access.value, active: active.value,
        verification: ver.value, notes: notes.value, fullHeader: full.value, baseHeader: base.value, docs: S.admin.docsReady ? links.get() : undefined } }, { timeout: 120000 }) });
    if (!res) return;
    S.admin = res.admin; rerenderAdmin(); toast('Regulasi disimpan.', 'ok'); refreshInitQuiet();
  }
  async function syncRegs() {
    const res = await modal({ title: 'Sinkronkan sheet baru', ok: 'Sinkronkan', busy: 'Memeriksa…',
      body: h('p', { text: 'Sheet baru di spreadsheet sumber akan ditambahkan ke daftar regulasi. Pengaturan regulasi yang sudah ada tidak diubah.' }),
      onOk: () => req('adminSync', {}, { timeout: 180000 }) });
    if (!res) return;
    S.admin = res.admin; rerenderAdmin(); refreshInitQuiet();
    toast(res.added.length ? res.added.length + ' regulasi baru: ' + res.added.map(x => x.name).join(', ') : 'Tidak ada sheet baru.', 'ok');
  }
  async function recheckDocs() {
    const res = await modal({ title: 'Periksa ulang tautan dokumen', ok: 'Periksa', busy: 'Memeriksa…',
      body: h('p', { text: 'Jenis berkas, nama, ukuran, dan status berbagi semua tautan akan dibaca ulang dari Google Drive.' }),
      onOk: () => req('adminRecheckDocs', {}, { timeout: 180000 }) });
    if (!res) return;
    S.admin = res.admin; rerenderAdmin(); refreshInitQuiet();
    toast(res.checked + ' tautan diperiksa' + (res.warnings ? ', ' + res.warnings + ' perlu dibagikan.' : ', semua dapat dibuka.'), res.warnings ? 'error' : 'ok');
  }
  async function clearCache() {
    try { await req('adminClearCache'); toast('Cache naskah dibersihkan. Pustaka di perangkat akan diperbarui.', 'ok'); refreshInitQuiet(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function adminAccess() {
    const wrap = h('div');
    const regTitle = id => { const r = S.admin.regulations.find(x => x.id === id); return r ? (r.title || r.sheet) : id; };
    const subj = a => a.subjectType === 'GRUP' ? 'Kelompok: ' + gname(a.subjectId) : 'Pengguna: ' + uname(a.subjectId);
    const draw = q => {
      const rows = S.admin.access.filter(a => !q || norm(regTitle(a.regulationId) + ' ' + subj(a)).includes(q));
      wrap.replaceChildren(table([
        { label: 'Regulasi', render: a => h('strong', { text: regTitle(a.regulationId) }) },
        { label: 'Berlaku untuk', render: a => subj(a) },
        { label: 'Efek', render: a => h('span', { class: 'chip ' + (a.effect === 'TOLAK' ? 'danger' : 'ok'), text: a.effect === 'TOLAK' ? 'Tolak' : 'Izinkan' }) },
        { label: 'Status', render: a => statusChip(a.active === 'YA', 'Aktif', 'Nonaktif') },
        { label: '', cls: 'act', render: a => actBtn('Ubah', () => editAccess(a)) }
      ], rows, 'Belum ada izin khusus. Regulasi Internal dapat dibaca semua pengguna; regulasi Terbatas hanya oleh admin.'));
    };
    draw('');
    return h('div', null,
      h('p', { class: 'note', text: 'Internal: dibaca semua pengguna kecuali yang ditolak. Terbatas: hanya yang diizinkan. Bila ada izin dan penolakan sekaligus, penolakan yang berlaku. Admin selalu dapat membaca.' }),
      filterBar('Cari izin…', draw, h('button', { class: 'btn primary', type: 'button', onclick: () => editAccess(null) }, icon('plus'), 'Tambah izin')), wrap);
  }
  async function editAccess(a) {
    const isNew = !a;
    const reg = select('regulationId', S.admin.regulations.map(r => [r.id, (r.title || r.sheet) + (r.access === 'TERBATAS' ? ' (Terbatas)' : '')]), a ? a.regulationId : null);
    const type = select('subjectType', [['GRUP', 'Kelompok'], ['USER', 'Pengguna']], a ? a.subjectType : 'GRUP');
    const subject = h('select', { name: 'subjectId' });
    const fill = () => {
      const opts = type.value === 'GRUP' ? S.admin.groups.map(g => [g.id, g.name]) : S.admin.users.map(u => [u.id, (u.name || u.id) + ' (' + u.id + ')']);
      subject.replaceChildren(...opts.map(([v, l]) => h('option', { value: v }, l)));
      if (a && a.subjectType === type.value) subject.value = a.subjectId;
    };
    type.addEventListener('change', fill); fill();
    if (!isNew) { reg.disabled = true; type.disabled = true; subject.disabled = true; }
    const effect = select('effect', [['IZIN', 'Izinkan membaca'], ['TOLAK', 'Tolak']], a ? a.effect : 'IZIN');
    const active = select('active', [['YA', 'Aktif'], ['TIDAK', 'Nonaktif']], a ? a.active : 'YA');
    const res = await modal({ title: isNew ? 'Tambah izin dokumen' : 'Ubah izin dokumen',
      body: h('div', null, field('Regulasi', reg), h('div', { class: 'grid2' }, field('Berlaku untuk', type), field('Nama kelompok / pengguna', subject)),
        h('div', { class: 'grid2' }, field('Efek', effect), field('Status', active))),
      onOk: () => {
        if (!subject.value) throw Error('Pilih kelompok atau pengguna.');
        return req('adminSaveAccess', { rule: { regulationId: reg.value, subjectType: type.value, subjectId: subject.value, effect: effect.value, active: active.value } });
      } });
    if (!res) return;
    S.admin = res.admin; rerenderAdmin(); toast('Izin dokumen disimpan.', 'ok'); refreshInitQuiet();
  }

  const ACT = { READ: 'Membaca', LOGIN: 'Masuk', CHANGE_PASSWORD: 'Ganti sandi', RESET_PASSWORD: 'Atur ulang sandi', RESET_ADMIN_MENU: 'Atur ulang sandi admin (spreadsheet)',
    CREATE_USER: 'Tambah pengguna', SAVE_USER: 'Ubah pengguna', SAVE_GROUP: 'Ubah kelompok', SAVE_REGULATION: 'Ubah regulasi', SAVE_ACCESS: 'Ubah izin dokumen',
    SYNC: 'Sinkronisasi sheet', RECHECK_DOCS: 'Periksa tautan dokumen' };
  function adminActivity() {
    const box = h('div');
    const load = async force => {
      if (!S.activity || force) {
        box.replaceChildren(h('div', { class: 'state' }, h('span', { class: 'spinner' }), h('div', { text: 'Memuat aktivitas…' })));
        try { S.activity = await req('adminActivity'); } catch (e) { box.replaceChildren(h('div', { class: 'state error', text: e.message })); return; }
      }
      draw();
    };
    const uSel = h('select'), kSel = select('k', [['', 'Semua kegiatan'], ['READ', 'Membaca'], ['LOGIN', 'Masuk'], ['ADMIN', 'Perubahan admin']], '');
    const draw = () => {
      const rows = S.activity.rows || [];
      const users = [...new Set(rows.map(r => r.u))].filter(Boolean);
      const keep = uSel.value;
      uSel.replaceChildren(h('option', { value: '' }, 'Semua pengguna'), ...users.map(u => h('option', { value: u }, uname(u))));
      uSel.value = users.includes(keep) ? keep : '';
      const f = rows.filter(r => (!uSel.value || r.u === uSel.value) &&
        (!kSel.value || (kSel.value === 'ADMIN' ? !['READ', 'LOGIN'].includes(r.a) : r.a === kSel.value)));
      const reads = new Map();
      f.filter(r => r.a === 'READ').forEach(r => {
        const x = reads.get(r.x) || { id: r.x, n: 0, users: new Set(), last: '' };
        x.n++; x.users.add(r.u); if (!x.last || r.t > x.last) x.last = r.t; reads.set(r.x, x);
      });
      const top = [...reads.values()].sort((a, b) => b.n - a.n).slice(0, 15);
      const regTitle = id => { const r = S.admin.regulations.find(x => x.id === id); return r ? (r.title || r.sheet) : id; };
      box.replaceChildren(
        h('p', { class: 'muted small', text: 'Berdasarkan ' + rows.length + ' catatan terakhir dari total ' + (S.activity.total || 0) + ' di sheet Cfg_Log.' }),
        top.length ? h('div', { class: 'block' }, h('h2', { text: 'Paling sering dibaca' }), table([
          { label: 'Regulasi', render: x => h('strong', { text: regTitle(x.id) }) },
          { label: 'Dibaca', render: x => x.n + ' kali' },
          { label: 'Pembaca', render: x => x.users.size + ' orang' },
          { label: 'Terakhir', render: x => fmtDate(x.last) }
        ], top)) : null,
        h('div', { class: 'block' }, h('h2', { text: 'Aktivitas terbaru' }), table([
          { label: 'Waktu', render: r => fmtDate(r.t) },
          { label: 'Pengguna', render: r => uname(r.u) },
          { label: 'Kegiatan', render: r => ACT[r.a] || r.a },
          { label: 'Sasaran', render: r => r.a === 'READ' || r.a === 'SAVE_REGULATION' ? regTitle(r.x) : (r.x || '—') }
        ], f.slice(0, 200), 'Tidak ada aktivitas yang cocok.')));
    };
    uSel.addEventListener('change', draw); kSel.addEventListener('change', draw);
    load(false);
    return h('div', null, h('div', { class: 'bar' }, uSel, kSel, h('span', { class: 'spacer' }),
      h('button', { class: 'btn', type: 'button', onclick: () => load(true) }, icon('refresh'), 'Muat ulang')), box);
  }

  /* ================= Diagnosa ================= */

  /** Membandingkan versi secara bertingkat. Hijau bila versi backend SAMA ATAU
   *  LEBIH BARU daripada yang diminta web — bukan harus sama persis, karena
   *  sebagian paket hanya menyentuh web dan tidak butuh deployment baru. */
  function versiCukup(ada, min) {
    const a = String(ada || '').split('.').map(Number), b = String(min || '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return true;
  }
  function chipMs(ms, baik, batas) {
    if (ms == null) return h('span', { class: 'chip off', text: '—' });
    return h('span', { class: 'chip ' + (ms <= baik ? 'ok' : ms <= batas ? 'warn' : 'danger'), text: ms + ' ms' });
  }
  function chipYa(ya, labelYa, labelTidak) {
    return h('span', { class: 'chip ' + (ya ? 'ok' : 'danger'), text: ya ? (labelYa || 'Ya') : (labelTidak || 'Tidak') });
  }

  async function showDiagnosa(nav) {
    loading('Mengukur…');
    const u = {};
    const t0 = performance.now();
    try {
      const p = await API.call('ping', {}, { timeout: 30000 });
      u.execMs = Math.round(performance.now() - t0);
      u.versiKode = (p && p.versiKode) || '';
      u.fitur = (p && p.fitur) || null;
    } catch (e) {
      u.execMs = Math.round(performance.now() - t0);
      u.execGalat = e.message;
    }
    if (S.cermin && Cermin && Cermin.siap()) {
      const t1 = performance.now();
      try { await Cermin.ambilJwt(); u.tukarMs = Math.round(performance.now() - t1); }
      catch (e) { u.tukarGalat = e.message; }
      if (!u.tukarGalat) {
        const t2 = performance.now();
        try {
          const daftar = await Cermin.regulasi();
          u.bacaMs = Math.round(performance.now() - t2);
          u.bacaBaris = (daftar || []).length;
        } catch (e) { u.bacaGalat = e.message; }
        try { u.meta = await Cermin.meta(); } catch (e) { u.metaGalat = e.message; }
      }
    } else u.cerminMati = true;
    if (nav !== S.nav) return;
    renderDiagnosa(u);
    window.scrollTo(0, 0);
  }

  function renderDiagnosa(u) {
    const min = C.VERSI_BACKEND_MIN || '';
    const jum = (u.tukarMs != null && u.bacaMs != null) ? u.tukarMs + u.bacaMs : null;
    const F = u.fitur || {};
    const namaFitur = [
      ['revPerSheet', 'Penanda revisi per sheet'],
      ['naskahTunggal', 'Naskah kembar tidak dikirim dua kali'],
      ['cerminKode', 'Kode cermin Supabase terbit'],
      ['cerminDisetel', 'Cermin Supabase disetel (Script Properties)'],
      ['kunciSesiKode', 'Kode kunci sesi terbit'],
      ['kunciSesiDisetel', 'Rahasia kunci sesi disetel']
    ];
    const baris = [
      ['Versi web', h('b', { text: C.APP_VERSION }), h('span', { class: 'chip off', text: '—' })],
      ['Versi kode backend',
        h('b', { text: u.versiKode || (u.execGalat ? 'tidak terjawab' : '—') }),
        u.versiKode ? chipYa(versiCukup(u.versiKode, min), 'minimal ' + min + ' terpenuhi', 'di bawah ' + min)
                    : h('span', { class: 'chip danger', text: 'tidak terbaca' })],
      ['Tukar kunci sesi',
        h('span', { text: u.tukarGalat ? u.tukarGalat : (u.cerminMati ? 'cermin tidak aktif' : '') }),
        u.tukarGalat ? h('span', { class: 'chip danger', text: 'gagal' }) : chipMs(u.tukarMs, 400, 800)],
      ['Baca cermin',
        h('span', { text: u.bacaGalat ? u.bacaGalat : (u.bacaBaris != null ? u.bacaBaris + ' regulasi terbaca' : '') }),
        u.bacaGalat ? h('span', { class: 'chip danger', text: 'gagal' }) : chipMs(u.bacaMs, 600, 1000)],
      ['Jumlah tukar + baca', h('span', { text: '' }), chipMs(jum, 1000, 1500)],
      ['Baca naskah terakhir',
        h('span', { text: (Cermin && Cermin.ukur.baris) ? Cermin.ukur.baris + ' baris' : 'belum ada naskah dibuka' }),
        (Cermin && Cermin.ukur.bacaMs) ? chipMs(Cermin.ukur.bacaMs, 600, 1000) : h('span', { class: 'chip off', text: '—' })],
      ['Sumber data terakhir',
        h('b', { text: (Cermin && Cermin.ukur.sumber) || 'belum ada' }),
        h('span', { class: 'chip ' + (Cermin && Cermin.ukur.sumber === 'cermin' ? 'ok' : 'warn'),
          text: Cermin && Cermin.ukur.sumber === 'cermin' ? 'jalur baku' : 'jalur cadangan' })],
      ['Respons Apps Script (jalur cadangan)',
        h('span', { text: u.execGalat || '' }),
        u.execGalat ? h('span', { class: 'chip danger', text: 'gagal' }) : chipMs(u.execMs, 1800, 3000)],
      ['Pemicu sumber Supabase',
        h('span', { text: 'pemicu suntingan di spreadsheet sumber' }),
        u.meta ? chipYa(String(u.meta.pemicu_sumber).toUpperCase() === 'YA', 'terpasang', 'belum terpasang')
               : h('span', { class: 'chip off', text: '—' })],
      ['Rekonsiliasi cermin terakhir',
        h('span', { text: (u.meta && u.meta.cermin_terakhir) ? ago(u.meta.cermin_terakhir) : 'belum pernah' }),
        u.meta ? chipYa(!!(u.meta.cermin_terakhir), 'ada', 'belum pernah') : h('span', { class: 'chip off', text: '—' })],
      ['Keep-alive terakhir',
        h('span', { text: (u.meta && u.meta.keep_alive_terakhir) ? ago(u.meta.keep_alive_terakhir) : 'belum pernah' }),
        u.meta ? chipYa(!!(u.meta.keep_alive_terakhir), 'ada', 'belum pernah') : h('span', { class: 'chip off', text: '—' })]
    ];
    const tabelUkur = table([
      { label: 'Baris', render: r => h('b', { text: r[0] }) },
      { label: 'Keterangan', render: r => r[1] },
      { label: 'Status', render: r => r[2] }
    ], baris, 'Tidak ada data pengukuran.');

    const tabelFitur = table([
      { label: 'Kemampuan backend', render: r => h('span', { text: r[1] }) },
      { label: 'Status', render: r => u.fitur ? chipYa(!!F[r[0]], 'ada', 'tidak ada')
        : h('span', { class: 'chip off', text: 'tidak terbaca' }) }
    ], namaFitur, 'Backend tidak menjawab.');

    content().replaceChildren(h('section', { class: 'page' },
      pageHead('Diagnosa', 'Angka versi saja tidak membuktikan apa pun. Baris Kemampuan backend memeriksa kode yang benar-benar terbit.',
        h('button', { class: 'btn', type: 'button', onclick: () => showDiagnosa(++S.nav) }, icon('refresh'), 'Ukur ulang')),
      tabelUkur,
      h('div', { class: 'panel' },
        // Penjelasan lantai platform SELALU ditampilkan: baris jalur cadangan
        // ada di kedua keadaan, dan justru ketika cermin mati penjelasan itu
        // paling dibutuhkan.
        u.cerminMati ? h('p', { class: 'muted', text: 'Cermin Supabase tidak aktif pada sesi ini. Web membaca sepenuhnya lewat Apps Script, dan itu tetap benar — hanya lebih lambat. Isi REG_SB_URL, REG_SB_SERVICE_KEY, dan REG_TOKEN_SECRET pada Script Properties untuk mengaktifkannya.' }) : null,
        h('p', { class: 'muted', text: 'Satu permintaan ke Apps Script selalu menjadi dua perjalanan jaringan karena jawabannya berupa pengalihan 302. Ditambah waktu bangun runtime, 800–1.500 ms pada baris jalur cadangan adalah lantai platform, bukan cacat aplikasi.' })),
      tabelFitur));
  }

  /* ================= Mulai ================= */
  async function boot() {
    const tok = store.get(TOKEN_KEY);
    if (!tok) { show('viewLogin'); return; }
    API.token = tok;
    try {
      const init = await API.call('init');
      S.user = init.user;
      if (init.user.changeRequired) { showChange(true); return; }
      enterApp(init);
    } catch (e) {
      if (e.code === 'AUTH') setToken('');
      show('viewLogin');
      $('#loginMsg').textContent = e.code === 'AUTH' ? '' : e.message;
    }
  }
  boot();
}
