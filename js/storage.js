// Storage layer - localStorage persistence
const Store = {
  KEYS: {
    products: 'alpha_products',
    categories: 'alpha_categories',
    sales: 'alpha_sales',
    customers: 'alpha_customers',
    settings: 'alpha_settings'
  },

  init() {
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
    if (localStorage.getItem(this.KEYS.settings) === null) {
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

  getCustomers() {
    return JSON.parse(localStorage.getItem(this.KEYS.customers) || '[]');
  },
  saveCustomers(customers) {
    localStorage.setItem(this.KEYS.customers, JSON.stringify(customers));
  },

  getSettings() {
    return JSON.parse(localStorage.getItem(this.KEYS.settings) || '{}');
  },
  saveSettings(settings) {
    localStorage.setItem(this.KEYS.settings, JSON.stringify(settings));
  },

  reset() {
    this.saveProducts([]);
    this.saveCategories([]);
    this.saveSales([]);
    this.saveCustomers([]);
    this.saveSettings({
      shopName: 'الفارس لمستلزمات السباحة و احذية الاطفال',
      shopNameEn: 'Al-Fares Swimming & Kids Shoes',
      phone: '010 28007300',
      address: 'سنتر اللؤلؤة, Obour, Al-Qalyubia Governorate',
      currency: 'EGP'
    });
  }
};

window.Store = Store;
