// Storage layer - localStorage persistence
const Store = {
  KEYS: {
    products: 'alpha_products',
    categories: 'alpha_categories',
    sales: 'alpha_sales',
    settings: 'alpha_settings'
  },

  init() {
    if (!localStorage.getItem(this.KEYS.products)) {
      this.saveProducts(window.SEED_DATA.products);
      this.saveCategories(window.SEED_DATA.categories);
    }
    if (!localStorage.getItem(this.KEYS.sales)) {
      localStorage.setItem(this.KEYS.sales, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.settings)) {
      localStorage.setItem(this.KEYS.settings, JSON.stringify({
        shopName: 'الفارس لمستلزمات السباحة و احذية الاطفال',
        shopNameEn: 'Al-Fares Swimming & Kids Shoes',
        phone: '010 28007300',
        address: 'سنتر اللؤلؤة, Obour, Al-Qalyubia Governorate',
        currency: 'EGP'
      }));
    }
  },

  getProducts() {
    return JSON.parse(localStorage.getItem(this.KEYS.products) || '[]');
  },
  saveProducts(products) {
    localStorage.setItem(this.KEYS.products, JSON.stringify(products));
  },

  getCategories() {
    return JSON.parse(localStorage.getItem(this.KEYS.categories) || '[]');
  },
  saveCategories(categories) {
    localStorage.setItem(this.KEYS.categories, JSON.stringify(categories));
  },

  getSales() {
    return JSON.parse(localStorage.getItem(this.KEYS.sales) || '[]');
  },
  saveSales(sales) {
    localStorage.setItem(this.KEYS.sales, JSON.stringify(sales));
  },

  getSettings() {
    return JSON.parse(localStorage.getItem(this.KEYS.settings) || '{}');
  },
  saveSettings(settings) {
    localStorage.setItem(this.KEYS.settings, JSON.stringify(settings));
  },

  reset() {
    localStorage.removeItem(this.KEYS.products);
    localStorage.removeItem(this.KEYS.categories);
    localStorage.removeItem(this.KEYS.sales);
    localStorage.removeItem(this.KEYS.settings);
    this.init();
  }
};
