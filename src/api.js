import C from './config.js';
"use strict";
/* Pemanggil Apps Script: POST teks JSON (tanpa preflight CORS), batas waktu, satu kali ulang untuk galat jaringan pada permintaan baca. */
const YehApi = (function () {
  const READ = new Set(['ping', 'init', 'document', 'docs', 'search', 'adminData', 'adminActivity']);

  class ApiError extends Error {
    constructor(message, code, network) { super(message); this.code = code || ''; this.network = !!network; }
  }

  async function once(body, timeoutMs) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(C.API_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body,
        redirect: 'follow', cache: 'no-store', credentials: 'omit', signal: ctl.signal
      });
      if (!res.ok) throw new ApiError('Server membalas status ' + res.status + '. Coba lagi.', '', true);
      const text = await res.text();
      try { return JSON.parse(text); }
      catch (_) { throw new ApiError('Jawaban server tidak terbaca. Pastikan deployment Apps Script sudah "Versi baru" dan aksesnya "Siapa saja".', '', true); }
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e && e.name === 'AbortError') throw new ApiError('Server terlalu lama menjawab. Coba lagi.', '', true);
      throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi internet.', '', true);
    } finally { clearTimeout(timer); }
  }

  async function call(action, payload, opt) {
    opt = opt || {};
    const body = JSON.stringify(Object.assign({}, payload || {}, { action: action, token: api.token || '' }));
    const timeout = opt.timeout || (action === 'search' ? 180000 : 90000);
    let j;
    try { j = await once(body, timeout); }
    catch (e) {
      if (!(e.network && READ.has(action))) throw e;
      await new Promise(r => setTimeout(r, 800));
      j = await once(body, timeout);
    }
    if (!j || !(j.ok || j.success)) throw new ApiError((j && j.message) || 'Terjadi kesalahan di server.', j && j.code);
    return j.data;
  }

  const api = { call: call, token: '', ApiError: ApiError };
  return api;
})();

export default YehApi;
