import C from './config.js';
"use strict";
/* Penyimpanan di perangkat:
   - Lib   : salinan naskah (IndexedDB), dihapus saat Keluar.
   - Prefs : preferensi tampilan per perangkat (localStorage). */
const YehStore = (function () {
  const DB = C.STORAGE_KEY + '_pustaka';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) { rej(Error('IndexedDB tidak tersedia')); return; }
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(Error('IndexedDB terblokir'));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(store, mode), req = fn(t.objectStore(store));
      let out;
      if (req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }

  const Lib = {
    async all() { try { return (await tx('docs', 'readonly', s => s.getAll())) || []; } catch (_) { return []; } },
    async put(doc) { try { await tx('docs', 'readwrite', s => s.put(doc)); } catch (_) {} },
    async del(id) { try { await tx('docs', 'readwrite', s => s.delete(id)); } catch (_) {} },
    async meta(k) { try { const r = await tx('meta', 'readonly', s => s.get(k)); return r ? r.v : null; } catch (_) { return null; } },
    async setMeta(k, v) { try { await tx('meta', 'readwrite', s => s.put({ k, v })); } catch (_) {} },
    async wipe() {
      try { if (dbp) (await dbp).close(); } catch (_) {}
      dbp = null;
      await new Promise(r => {
        try { const q = indexedDB.deleteDatabase(DB); q.onsuccess = q.onerror = q.onblocked = () => r(); }
        catch (_) { r(); }
      });
    }
  };

  const Prefs = {
    get(k, d) { try { const v = localStorage.getItem(C.STORAGE_KEY + ':' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(C.STORAGE_KEY + ':' + k, JSON.stringify(v)); } catch (_) {} }
  };

  return { Lib: Lib, Prefs: Prefs };
})();

export const Lib = YehStore.Lib;
export const Prefs = YehStore.Prefs;
export default YehStore;
