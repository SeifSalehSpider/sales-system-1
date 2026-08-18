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
    product.id = product.id || ('p' + Date.now() + Math.floor(Math.random() * 1000));
    if (!product.category) {
      const defaultCat = this.getOrCreateCategory('عام', 'General');
      product.category = defaultCat.id;
    }
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
    const cat = { id: 'cat_' + Date.now() + Math.floor(Math.random() * 1000), name, nameEn: nameEn || name };
    this.private.categories.push(cat);
    Store.saveCategories(this.private.categories);
    return cat;
  },

  updateCategory(id, name, nameEn) {
    const cat = this.private.categories.find(c => c.id === id);
    if (cat) {
      cat.name = name;
      if (nameEn !== undefined) cat.nameEn = nameEn;
      Store.saveCategories(this.private.categories);
    }
    return cat;
  },

  deleteCategory(id) {
    const catIdx = this.private.categories.findIndex(c => c.id === id);
    if (catIdx === -1) return false;

    // Reassign products of this category to fallback or general
    const remainingCats = this.private.categories.filter(c => c.id !== id);
    let fallbackCatId = remainingCats.length > 0 ? remainingCats[0].id : null;
    if (!fallbackCatId) {
      const generalCat = this.addCategory('عام', 'General');
      fallbackCatId = generalCat.id;
    }

    this.private.products.forEach(p => {
      if (p.category === id) {
        p.category = fallbackCatId;
      }
    });

    this.private.categories.splice(catIdx, 1);
    Store.saveCategories(this.private.categories);
    Store.saveProducts(this.private.products);
    return true;
  },

  exportProductsToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة Excel غير متوفرة.');
      return;
    }
    const products = this.findAll();
    const settings = Store.getSettings();
    const currency = settings.currency || 'EGP';

    const rows = products.map((p, idx) => ({
      '#': idx + 1,
      'اسم المنتج (عربي)': p.name,
      'الاسم بالإنجليزية': p.nameEn || '',
      'الباركود': p.barcode || '',
      'القسم': this.getCategoryName(p.category),
      'سعر البيع': p.price,
      'السعر قبل الخصم': p.oldPrice || p.price,
      'سعر الشراء': p.cost || 0,
      'الربح التقديري': (p.price - (p.cost || 0)),
      'المخزون الحالي': p.stock || 0,
      'الحد الأدنى': p.minStock || 0,
      'حالة المخزون': (p.stock <= (p.minStock || 5)) ? 'منخفض ⚠️' : 'متوفر ✔️'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },  // #
      { wch: 30 }, // اسم
      { wch: 25 }, // English
      { wch: 18 }, // باركود
      { wch: 20 }, // قسم
      { wch: 12 }, // بيع
      { wch: 14 }, // قبل الخصم
      { wch: 12 }, // شراء
      { wch: 14 }, // ربح
      { wch: 14 }, // مخزون
      { wch: 12 }, // حد ادنى
      { wch: 14 }  // حالة
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير المنتجات والمخزون");
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `مخزون_المنتجات_الفارس_${dateStr}.xlsx`);
  },

  findCategoryByName(name) {
    if (!name) return null;
    const lower = String(name).trim().toLowerCase();
    return this.private.categories.find(c =>
      c.id.toLowerCase() === lower ||
      c.name.toLowerCase() === lower ||
      (c.nameEn && c.nameEn.toLowerCase() === lower)
    );
  },

  getOrCreateCategory(name, nameEn) {
    if (!name || !String(name).trim()) {
      if (this.private.categories.length > 0) {
        return this.private.categories[0];
      }
      return this.addCategory('عام', 'General');
    }
    const cleanName = String(name).trim();
    const existing = this.findCategoryByName(cleanName);
    if (existing) return existing;
    return this.addCategory(cleanName, nameEn ? String(nameEn).trim() : cleanName);
  },

  importProducts(items, mode = 'merge') {
    if (mode === 'replace') {
      this.private.products = [];
    }

    const existingBarcodes = new Set(this.private.products.map(p => p.barcode));
    let addedCount = 0;
    let updatedCount = 0;

    items.forEach((item, index) => {
      if (!item.name || !String(item.name).trim()) return;

      const catObj = this.getOrCreateCategory(item.category, item.nameEn || item.category);
      const categoryId = catObj.id;

      const price = parseFloat(item.price) || 0;
      const oldPrice = parseFloat(item.oldPrice) > 0 ? parseFloat(item.oldPrice) : price;
      const cost = parseFloat(item.cost) || 0;
      const stock = parseInt(item.stock, 10) >= 0 ? parseInt(item.stock, 10) : 0;
      const minStock = parseInt(item.minStock, 10) >= 0 ? parseInt(item.minStock, 10) : 0;

      let barcode = item.barcode ? String(item.barcode).trim() : '';
      if (!barcode || barcode.length < 5) {
        do {
          barcode = BarcodeUtil.generateEAN13();
        } while (existingBarcodes.has(barcode));
      }

      const existingProd = mode === 'merge' ? this.findByBarcode(barcode) : null;

      if (existingProd) {
        this.update(existingProd.id, {
          name: String(item.name).trim(),
          nameEn: item.nameEn ? String(item.nameEn).trim() : existingProd.nameEn || '',
          category: categoryId,
          price: price,
          oldPrice: oldPrice,
          cost: cost,
          stock: stock,
          minStock: minStock
        });
        updatedCount++;
      } else {
        existingBarcodes.add(barcode);
        const newProduct = {
          id: 'p' + (Date.now() + index + Math.floor(Math.random() * 10000)),
          name: String(item.name).trim(),
          nameEn: item.nameEn ? String(item.nameEn).trim() : '',
          barcode: barcode,
          category: categoryId,
          price: price,
          oldPrice: oldPrice,
          cost: cost,
          stock: stock,
          minStock: minStock
        };
        this.private.products.push(newProduct);
        addedCount++;
      }
    });

    Store.saveProducts(this.private.products);
    Store.saveCategories(this.private.categories);

    return { added: addedCount, updated: updatedCount, total: addedCount + updatedCount };
  }
};

window.ProductsManager = ProductsManager;
