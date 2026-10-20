// Product management logic
const ProductsManager = {
  private: { products: [], categories: [] },

  load() {
    this.private.products = Store.getProducts();
    this.private.categories = Store.getCategories();

    // ترحيل المنتجات القديمة التي كانت تُحفظ كسطر مستقل لكل مقاس إلى منتج واحد بقائمة مقاسات.
    const grouped = new Map();
    this.private.products.forEach(product => {
      const key = `${product.name || ''}__${product.category || ''}__${product.price || 0}__${product.cost || 0}`;
      let existing = grouped.get(key);
      if (!existing) {
        existing = { ...product, sizes: this.parseSizes(product.sizes?.length ? product.sizes : (product.size || product.availableSizes)) };
        existing.size = '';
        existing.availableSizes = existing.sizes.join('، ');
        grouped.set(key, existing);
      } else {
        const oldSizes = this.parseSizes(product.sizes?.length ? product.sizes : (product.size || product.availableSizes));
        existing.sizes = this.parseSizes([...(existing.sizes || []), ...oldSizes]);
        existing.availableSizes = existing.sizes.join('، ');
        existing.stock = (Number(existing.stock) || 0) + (Number(product.stock) || 0);
      }
    });
    const normalizedProducts = [...grouped.values()];
    if (normalizedProducts.length !== this.private.products.length) {
      this.private.products = normalizedProducts;
      Store.saveProducts(this.private.products);
    }
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

  // يحول أي صيغة للمقاسات إلى مقاسات منفصلة، مهما كان الفاصل بينها.
  // مثال: 32/34/34 أو 32-34-36 أو 32، 34، 36 أو S | M | L.
  parseSizes(value) {
    const rawValues = Array.isArray(value) ? value : [value];
    return [...new Set(rawValues
      .flatMap(size => String(size ?? '').trim().split(/[\s,،؛;:：|/\\+\-_–—.()\[\]{}]+/))
      .map(size => size.trim())
      .filter(Boolean))];
  },

  getDisplayName(product) {
    return product?.name || '';
  },

  getSizes(product) {
    return this.parseSizes(product?.sizes?.length ? product.sizes : product?.availableSizes);
  },

  search(query) {
    query = query.trim().toLowerCase();
    if (!query) return this.private.products;
    return this.private.products.filter(p =>
      String(p.name || '').toLowerCase().includes(query) ||
      String(p.nameEn || '').toLowerCase().includes(query) ||
      String(p.size || '').toLowerCase().includes(query) ||
      String(p.barcode || '').toLowerCase().includes(query) ||
      this.getCategoryName(p.category).toLowerCase().includes(query)
    );
  },

  add(product, options = {}) {
    product.id = product.id || ('p' + Date.now() + Math.floor(Math.random() * 1000));
    if (!product.category) {
      const defaultCat = this.getOrCreateCategory('عام', 'General');
      product.category = defaultCat.id;
    }
    this.private.products.push(product);
    Store.saveProducts(this.private.products);
    if ((Number(product.stock) || 0) > 0 && options.recordEntry !== false) {
      const entries = Store.getStockEntries();
      entries.push({
        id: 'stock_' + Date.now() + Math.floor(Math.random() * 1000),
        date: new Date().toISOString(),
        productId: product.id,
        productName: product.name,
        qty: Number(product.stock) || 0,
        cost: Number(product.cost) || 0,
        price: Number(product.price) || 0
      });
      Store.saveStockEntries(entries);
    }
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
  adjustStock(id, qty, options = {}) {
    const p = this.findById(id);
    if (!p) return null;
    p.stock = Math.max(0, (p.stock || 0) + qty);
    Store.saveProducts(this.private.products);

    // Only positive manual additions are recorded for monthly stock analytics.
    if (qty > 0 && options.recordEntry !== false) {
      const entries = Store.getStockEntries();
      entries.push({
        id: 'stock_' + Date.now() + Math.floor(Math.random() * 1000),
        date: new Date().toISOString(),
        productId: p.id,
        productName: p.name,
        qty,
        cost: Number(p.cost) || 0,
        price: Number(p.price) || 0
      });
      Store.saveStockEntries(entries);
    }
    return p;
  },

  getLowStock() {
    // يظهر التنبيه عندما يتبقى منتج واحد أو أقل، بغض النظر عن حد الطلب المحفوظ.
    return this.private.products.filter(p => Number(p.stock) <= 1);
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
      'الصنف': p.name,
      'وصف الموديل': p.modelDescription || p.nameEn || '',
      'اسم المصنع': p.manufacturer || this.getCategoryName(p.category),
      'سعر الجملة': p.cost || 0,
      'سعر البيع': p.price || 0,
      'الربح': (p.price || 0) - (p.cost || 0),
      'المقاسات': this.getSizes(p).join('، '),
      'المخزون': p.stock || 0,
      'سعر الجملة *العدد': (p.cost || 0) * (p.stock || 0),
      'سعر البيع*العدد': (p.price || 0) * (p.stock || 0),
      'الربح*العدد': ((p.price || 0) - (p.cost || 0)) * (p.stock || 0),
      'المقاسات المتاحة': p.availableSizes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!rtl'] = true;
    ws['!views'] = [{ rightToLeft: true }];
    ws['!cols'] = [
      { wch: 30 }, { wch: 35 }, { wch: 25 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 22 }
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

    // كل صف يظل منتجاً واحداً، والمقاسات تحفظ كقائمة داخل المنتج.
    const normalizedItems = items
      .filter(item => item && item.name && String(item.name).trim())
      .map(item => ({
        ...item,
        sizes: this.parseSizes(item.sizes?.length ? item.sizes : item.availableSizes),
        availableSizes: item.availableSizes || (item.sizes || []).join('، ')
      }));

    normalizedItems.forEach((item, index) => {
       if (!item.name || !String(item.name).trim()) return;

       const catObj = this.getOrCreateCategory(item.category || item.manufacturer, item.manufacturer || item.nameEn);
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
          modelDescription: item.modelDescription || existingProd.modelDescription || '',
          manufacturer: item.manufacturer || existingProd.manufacturer || '',
          availableSizes: item.availableSizes || existingProd.availableSizes || '',
          size: '',
          sizes: item.sizes || existingProd.sizes || this.parseSizes(item.availableSizes),
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
          modelDescription: item.modelDescription || '',
          manufacturer: item.manufacturer || '',
          availableSizes: item.availableSizes || '',
          size: '',
          sizes: item.sizes || this.parseSizes(item.availableSizes),
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

      if (stock > 0) {
        const entries = Store.getStockEntries();
        entries.push({
          id: 'stock_' + Date.now() + index + Math.floor(Math.random() * 1000),
          date: new Date().toISOString(),
          productId: existingProd ? existingProd.id : this.private.products[this.private.products.length - 1].id,
          productName: String(item.name).trim(),
          qty: stock,
          cost,
          price
        });
        Store.saveStockEntries(entries);
      }
    });

    Store.saveProducts(this.private.products);
    Store.saveCategories(this.private.categories);

    return { added: addedCount, updated: updatedCount, total: addedCount + updatedCount };
  }
};

window.ProductsManager = ProductsManager;
