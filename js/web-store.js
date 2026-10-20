// Web version of the native data store.
// Used only when the app runs in a browser (GitHub Pages). The Electron app
// keeps using preload.js and saves to the JSON file in Documents.
//
// The page owns the screen, so it mirrors every change into localStorage at once
// and hands the file to the storage manager as soon as it is "dirty" (e.g. the
// user clicks save/export or closes the tab). No file is written on a timer.
(function () {
  const DB_NAME = 'sales-system';
  const STORE_NAME = 'files';
  const HANDLE_KEY = 'sales-system:data-file-handle';
  const WATCH_INTERVAL_MS = 3000;

  const browserFlush = {
    handle: null,
    watch: null,
    dirty: false,
    permanent: false,
    pendingState: null
  };

  // Chromium keeps remembering the file chosen for each picker `id`, which lets
  // a returning user reconnect with one click instead of browsing again.
  const PICKER_ID = 'sales-system-data';
  const nativeSavePicker = window.showSaveFilePicker ? window.showSaveFilePicker.bind(window) : null;
  const nativeOpenPicker = window.showOpenFilePicker ? window.showOpenFilePicker.bind(window) : null;

  function normalizeFileApi() {
    if (nativeSavePicker && !browserFlush.permanent) {
      window.showSaveFilePicker = (options = {}) => nativeSavePicker({ ...options, id: PICKER_ID });
    }
    if (nativeOpenPicker && !browserFlush.permanent) {
      window.showOpenFilePicker = (options = {}) => nativeOpenPicker({ ...options, id: PICKER_ID });
    }
  }

  async function storeGet(key) {
    if (!window.indexedDB) return null;
    return new Promise(resolve => {
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
        request.onerror = () => done(null);
        request.onsuccess = () => {
          const db = request.result;
          try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const get = tx.objectStore(STORE_NAME).get(key);
            get.onsuccess = () => done(get.result || null);
            get.onerror = () => done(null);
            tx.oncomplete = () => db.close();
          } catch (_) {
            db.close();
            done(null);
          }
        };
        setTimeout(() => done(null), 3000);
      } catch (_) {
        done(null);
      }
    });
  }

  async function storeSet(key, value) {
    if (!window.indexedDB) return false;
    return new Promise(resolve => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
        request.onerror = () => done(false);
        request.onsuccess = () => {
          const db = request.result;
          try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(value, key);
            tx.oncomplete = () => {
              db.close();
              done(true);
            };
            tx.onerror = () => {
              db.close();
              done(false);
            };
          } catch (_) {
            db.close();
            done(false);
          }
        };
        setTimeout(() => done(false), 3000);
      } catch (_) {
        done(false);
      }
    });
  }

  function markPermanent() {
    browserFlush.permanent = true;
    if (browserFlush.handle && browserFlush.handle.remove) {
      browserFlush.handle.remove().catch(() => {});
    }
    browserFlush.handle = null;
    storeSet(HANDLE_KEY, null);
    if (browserFlush.watch) {
      clearInterval(browserFlush.watch);
      browserFlush.watch = null;
    }
    normalizeFileApi();
    window.dispatchEvent(new CustomEvent('sales-system:file-mode-changed'));
  }

  async function loadHandle() {
    if (browserFlush.handle) return browserFlush.handle;
    const stored = await storeGet(HANDLE_KEY);
    if (!stored) return null;
    if ((stored.queryPermission && await stored.queryPermission({ mode: 'readwrite' })) === 'granted') {
      browserFlush.handle = stored;
      return stored;
    }
    return null;
  }

  async function watchPermission() {
    if (browserFlush.permanent || browserFlush.watch) return;
    if (typeof window.showSaveFilePicker !== 'function') return;
    browserFlush.watch = setInterval(async () => {
      if (!browserFlush.handle || typeof browserFlush.handle.queryPermission !== 'function') return;
      if (await browserFlush.handle.queryPermission({ mode: 'readwrite' }) === 'granted') {
        clearInterval(browserFlush.watch);
        browserFlush.watch = null;
        if (browserFlush.dirty) writePending();
      }
    }, WATCH_INTERVAL_MS);
  }

  async function writePending() {
    if (!browserFlush.handle || !browserFlush.dirty) return false;
    if (await browserFlush.handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      watchPermission();
      return false;
    }
    try {
      const writable = await browserFlush.handle.createWritable();
      await writable.write(JSON.stringify(browserFlush.pendingState || {}, null, 2));
      await writable.close();
      browserFlush.dirty = false;
      window.dispatchEvent(new CustomEvent('sales-system:file-saved'));
      return true;
    } catch (_) {
      return false;
    }
  }

  // Called by license.js right after showSaveFilePicker succeeds. Saves pending
  // data at once and tells the user whether auto-save is working.
  browserFlush.attach = async function (handle) {
    if (!handle) return false;
    browserFlush.handle = handle;
    await storeSet(HANDLE_KEY, handle);
    if (browserFlush.pendingState && !browserFlush.dirty) browserFlush.dirty = true;
    return writePending();
  };

  // Called by storage.js whenever data changes.
  browserFlush.save = function (state) {
    browserFlush.pendingState = state;
    if (!browserFlush.handle) return;
    browserFlush.dirty = true;
    writePending();
  };

  // Force a write now (close / tab hidden).
  browserFlush.flush = function () {
    if (browserFlush.handle && browserFlush.dirty) writePending();
  };

  browserFlush.markPermanent = markPermanent;

  browserFlush.init = async function () {
    if (browserFlush.permanent) return;
    normalizeFileApi();
    const handle = await loadHandle();
    if (!handle) return;
    browserFlush.handle = handle;
    // A watcher would overwrite what the storage manager prepared; skip it.
    if (browserFlush.watch) {
      clearInterval(browserFlush.watch);
      browserFlush.watch = null;
    }
    window.dispatchEvent(new CustomEvent('sales-system:file-mode-changed'));
  };

  Object.defineProperty(window, 'browserFlush', { value: browserFlush, configurable: true, writable: true });
})();
