// Storage layer - localStorage persistence plus an offline backup in Documents.
// When the web version runs in a browser (GitHub Pages), the browser API stored
// here only reports on-screen/unloaded writes so they can be included immediately.
const NativeStore = window.nativeStore || null;
const BrowserFlush = window.browserFlush || null;

// Persist to disk before the page is closed, reloaded or hidden so the last
// change on the web version isn't lost.
if (!NativeStore && BrowserFlush) {
  window.addEventListener('beforeunload', () => BrowserFlush.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') BrowserFlush.flush();
  });
}
const Store = {
  KEYS: {
    products: 'alpha_products',
    categories: 'alpha_categories',
    sales: 'alpha_sales',
    customers: 'alpha_customers',
    heldCarts: 'alpha_held_carts',
    stockEntries: 'alpha_stock_entries',
    settings: 'alpha_settings'
  },

  init() {
    if (NativeStore && NativeStore.loadStateSync) {
      // The Documents data file is the source of truth. Clear any data bundled
      // with the installer (or left in the new installation's localStorage)
      // before loading the data belonging to this Windows user.
      const state = NativeStore.loadStateSync() || {};
      Object.values(this.KEYS).forEach(storageKey => localStorage.removeItem(storageKey));
      Object.keys(this.KEYS).forEach(key => {
        if (state[key] !== undefined && state[key] !== null) {
          localStorage.setItem(this.KEYS[key], JSON.stringify(state[key]));
        }
      });
    }
    if (localStorage.getItem(this.KEYS.products) === null) {
      this.saveProducts([]);
      this.saveCategories([]);
    }
    if (localStorage.getItem(this.KEYS.sales) === null) {
      localStorage.setItem(this.KEYS.sales, JSON.stringify([]));
    }
    if (localStorage.getItem(this.KEYS.customers) === null) {
      localStorage.setItem(this.KEYS.customers, JSON.stringify([]));
    }
    if (localStorage.getItem(this.KEYS.heldCarts) === null) {
      localStorage.setItem(this.KEYS.heldCarts, JSON.stringify([]));
    }
    if (localStorage.getItem(this.KEYS.stockEntries) === null) {
      localStorage.setItem(this.KEYS.stockEntries, JSON.stringify([]));
    }
    if (localStorage.getItem(this.KEYS.settings) === null) {
      localStorage.setItem(this.KEYS.settings, JSON.stringify({
        shopName: 'الفارس لمستلزمات السباحة و احذية الاطفال',
        shopNameEn: 'Al-Fares Swimming & Kids Shoes',
        phone: '010 28007300',
        address: 'سنتر اللؤلؤة, Obour, Al-Qalyubia Governorate',
        currency: 'EGP'
      }));
    }
    this.syncNative();
  },

  getProducts() {
    return JSON.parse(localStorage.getItem(this.KEYS.products) || '[]');
  },
  saveProducts(products) {
    localStorage.setItem(this.KEYS.products, JSON.stringify(products));
    this.syncNative();
  },

  getCategories() {
    return JSON.parse(localStorage.getItem(this.KEYS.categories) || '[]');
  },
  saveCategories(categories) {
    localStorage.setItem(this.KEYS.categories, JSON.stringify(categories));
    this.syncNative();
  },

  getSales() {
    return JSON.parse(localStorage.getItem(this.KEYS.sales) || '[]');
  },
  saveSales(sales) {
    localStorage.setItem(this.KEYS.sales, JSON.stringify(sales));
    this.syncNative();
  },

  getCustomers() {
    return JSON.parse(localStorage.getItem(this.KEYS.customers) || '[]');
  },
  saveCustomers(customers) {
    localStorage.setItem(this.KEYS.customers, JSON.stringify(customers));
    this.syncNative();
  },

  getHeldCarts() {
    return JSON.parse(localStorage.getItem(this.KEYS.heldCarts) || '[]');
  },
  saveHeldCarts(heldCarts) {
    localStorage.setItem(this.KEYS.heldCarts, JSON.stringify(heldCarts));
    this.syncNative();
  },

  getStockEntries() {
    return JSON.parse(localStorage.getItem(this.KEYS.stockEntries) || '[]');
  },
  saveStockEntries(entries) {
    localStorage.setItem(this.KEYS.stockEntries, JSON.stringify(entries));
    this.syncNative();
  },

  getSettings() {
    return JSON.parse(localStorage.getItem(this.KEYS.settings) || '{}');
  },
  saveSettings(settings) {
    localStorage.setItem(this.KEYS.settings, JSON.stringify(settings));
    this.syncNative();
  },

  syncNative() {
    const state = {};
    Object.keys(this.KEYS).forEach(key => {
      try { state[key] = JSON.parse(localStorage.getItem(this.KEYS[key]) || 'null'); } catch (_) { state[key] = null; }
    });
    if (NativeStore && NativeStore.saveStateSync) {
      NativeStore.saveStateSync(state);
    } else if (BrowserFlush) {
      BrowserFlush.save(state);
    }
  },

  reset() {
    this.saveProducts([]);
    this.saveCategories([]);
    this.saveSales([]);
    this.saveCustomers([]);
    this.saveHeldCarts([]);
    this.saveStockEntries([]);
    this.saveSettings({
      shopName: 'الفارس لمستلزمات السباحة و احذية الاطفال',
      shopNameEn: 'Al-Fares Swimming & Kids Shoes',
      phone: '010 28007300',
      address: 'سنتر اللؤلؤة, Obour, Al-Qalyubia Governorate',
      currency: 'EGP'
    });
    this.syncNative();
  }
};

window.Store = Store;
