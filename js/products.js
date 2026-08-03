// Product management logic
const ProductsManager = {
  private: { products: [], categories: [] },

  load() {
    this.private.products = Store.getProducts();
    this.private.categories = Store.getCategories();
    return this.private.products;
  },

  getCategories() {
    return this.private.categories;
  },

  getCategoryName(catId) {
    const cat = this.private.categories.find(c => c.id === catId);
    return cat ? cat.name : 'غير مصنف';
  },

  getCategoryNameEn(catId) {
    const cat = this.private.categories.find(c => c.id === catId);
    return cat ? cat.nameEn : 'Uncategorized';
  },

  findAll() {
    return this.private.products;
  },

  findById(id) {
    return this.private.products.find(p => p.id === id);
  },

  findByBarcode(code) {
    return this.private.products.find(p => p.barcode === code);
  },

  search(query) {
    query = query.trim().toLowerCase();
    if (!query) return this.private.products;
    return this.private.products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.nameEn || '').toLowerCase().includes(query) ||
      p.barcode.includes(query) ||
      this.getCategoryName(p.category).toLowerCase().includes(query)
    );
  },

  add(product) {
    product.id = product.id || 'p' + Date.now();
    this.private.products.push(product);
    Store.saveProducts(this.private.products);
    return product;
  },

  update(id, updates) {
    const idx = this.private.products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    this.private.products[idx] = Object.assign({}, this.private.products[idx], updates);
    Store.saveProducts(this.private.products);
    return this.private.products[idx];
  },

  remove(id) {
    this.private.products = this.private.products.filter(p => p.id !== id);
    Store.saveProducts(this.private.products);
  },

  removeMany(ids) {
    const set = new Set(ids);
    this.private.products = this.private.products.filter(p => !set.has(p.id));
    Store.saveProducts(this.private.products);
  },

  // Adjust stock: increase or decrease by qty
  adjustStock(id, qty) {
    const p = this.findById(id);
    if (!p) return null;
    p.stock = Math.max(0, (p.stock || 0) + qty);
    Store.saveProducts(this.private.products);
    return p;
  },

  getLowStock() {
    return this.private.products.filter(p => p.stock <= (p.minStock || 0));
  },

  addCategory(name, nameEn) {
    const cat = { id: 'cat_' + Date.now(), name, nameEn };
    this.private.categories.push(cat);
    Store.saveCategories(this.private.categories);
    return cat;
  }
};
