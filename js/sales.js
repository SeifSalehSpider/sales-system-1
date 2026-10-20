// Sales / POS logic
const SalesManager = {
  cart: [],

  private: { sales: [] },

  load() {
    this.private.sales = Store.getSales();
    return this.private.sales;
  },

  getAllSales() {
    return this.private.sales;
  },

// Cart operations
  addToCart(product, qty = 1) {
    const selectedSize = product.size || '';
    const existing = this.cart.find(i => i.productId === product.id && (i.size || '') === selectedSize);
    if (existing) {
      existing.qty += qty;
      existing.total = existing.qty * existing.price;
      existing.oldTotal = existing.qty * existing.oldPrice;
    } else {
      this.cart.push({
        productId: product.id,
        size: selectedSize,
        name: product.name,
        nameEn: product.nameEn || '',
        barcode: product.barcode,
        oldPrice: product.oldPrice || product.price,
        price: product.price,
        cost: parseFloat(product.cost) || 0,
        qty: qty,
        total: product.price * qty,
        oldTotal: (product.oldPrice || product.price) * qty
      });
    }
  },

  updateCartQty(productId, qty, size = '') {
    const item = this.cart.find(i => i.productId === productId && (i.size || '') === size);
    if (!item) return;
    if (qty <= 0) {
      this.cart = this.cart.filter(i => !(i.productId === productId && (i.size || '') === size));
    } else {
      item.qty = qty;
      item.total = item.qty * item.price;
      item.oldTotal = item.qty * item.oldPrice;
    }
  },

  removeFromCart(productId, size = '') {
    this.cart = this.cart.filter(i => !(i.productId === productId && (i.size || '') === size));
  },

  clearCart() {
    this.cart = [];
  },

  // Sum of after-discount prices (what the customer pays)
  getSubtotal() {
    return this.cart.reduce((sum, i) => sum + i.total, 0);
  },

  // Sum of before-discount (original) prices
  getOldSubtotal() {
    return this.cart.reduce((sum, i) => sum + (i.oldTotal || i.total), 0);
  },

  // Auto discount = (before discount total) - (after discount total)
  getAutoDiscount() {
    return this.getOldSubtotal() - this.getSubtotal();
  },

  // Complete a sale
checkout(discount, paid, payment, customerName = '', customerPhone = '', shipping = 0, customerAddress = '') {
  if (this.cart.length === 0) return null;
  // subtotal = sum of before-discount (original) prices
  const subtotal = this.getOldSubtotal();
  discount = discount || 0;
  shipping = Math.max(0, parseFloat(shipping) || 0);
  // total = subtotal minus discount plus shipping
  const total = Math.max(0, subtotal - discount + shipping);
  const change = Math.max(0, paid - total);

  const cleanCustName = (customerName || '').trim();
  const cleanCustPhone = (customerPhone || '').trim();
  const cleanCustAddress = (customerAddress || '').trim();

  const sale = {
    id: 'INV-' + Date.now().toString().slice(-8),
    date: new Date().toISOString(),
    customerName: cleanCustName,
    customerPhone: cleanCustPhone,
    customerAddress: cleanCustAddress,
    items: this.cart.map(i => ({ ...i })),
    subtotal: subtotal,
    discount: discount,
    shipping: shipping,
    total: total,
    paid: paid,
    change: change,
    payment: payment || 'cash'
  };

  // Reduce stock
  this.cart.forEach(item => {
    ProductsManager.adjustStock(item.productId, -item.qty);
  });

  // Register / update customer in CRM database
  if (window.CustomersManager && (cleanCustName || cleanCustPhone)) {
    CustomersManager.addOrUpdate(cleanCustName, cleanCustPhone, sale.total, sale.id);
  }

  this.private.sales.unshift(sale);
  Store.saveSales(this.private.sales);
  this.clearCart();
  return sale;
},

  // Reports
  getTodaySales() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.private.sales.filter(s => new Date(s.date) >= today);
  },

  getTodayRevenue() {
    return this.getTodaySales().reduce((sum, s) => sum + s.total, 0);
  },

  getTodayProfit() {
    let profit = 0;
    this.getTodaySales().forEach(s => {
      s.items.forEach(item => {
        const p = ProductsManager.findById(item.productId);
        if (p) profit += (p.price - p.cost) * item.qty;
      });
    });
    return profit;
  },

  getTotalSales() {
    return this.private.sales.length;
  },

  getTotalRevenue() {
    return this.private.sales.reduce((sum, s) => sum + s.total, 0);
  },

  getTopProducts(limit = 5) {
    const counts = {};
    this.private.sales.forEach(s => {
      s.items.forEach(item => {
        if (!counts[item.productId]) counts[item.productId] = { name: item.name, qty: 0, revenue: 0 };
        counts[item.productId].qty += item.qty;
        counts[item.productId].revenue += item.total;
      });
    });
    return Object.values(counts).sort((a, b) => b.qty - a.qty).slice(0, limit);
  },

  // Held Carts (تعليق الفواتير) - محفوظة محلياً لتبقى بعد إغلاق البرنامج
  heldCarts: [],

  holdCurrentCart(note = '') {
    if (this.cart.length === 0) return null;
    const heldItem = {
      id: 'HOLD-' + Date.now().toString().slice(-6),
      date: new Date().toISOString(),
      note: note || `فاتورة معلقة #${this.heldCarts.length + 1}`,
      items: this.cart.map(i => ({ ...i })),
      subtotal: this.getOldSubtotal(),
      total: this.getSubtotal()
    };
    this.heldCarts.unshift(heldItem);
    Store.saveHeldCarts(this.heldCarts);
    this.clearCart();
    return heldItem;
  },

  getHeldCarts() {
    return this.heldCarts;
  },

  restoreHeldCart(id) {
    const idx = this.heldCarts.findIndex(h => h.id === id);
    if (idx === -1) return null;
    const held = this.heldCarts[idx];
    this.cart = held.items.map(i => ({ ...i }));
    this.heldCarts.splice(idx, 1);
    Store.saveHeldCarts(this.heldCarts);
    return held;
  },

  deleteHeldCart(id) {
    const idx = this.heldCarts.findIndex(h => h.id === id);
    if (idx !== -1) {
      this.heldCarts.splice(idx, 1);
      Store.saveHeldCarts(this.heldCarts);
      return true;
    }
    return false;
  },

  // Update an existing sale while keeping stock quantities accurate.
  updateSale(saleId, updates) {
    const sale = this.private.sales.find(s => s.id === saleId);
    if (!sale) return null;
    const oldItems = sale.items || [];
    const newItems = (updates.items || []).map(item => ({ ...item }));
    const oldQty = {};
    const newQty = {};
    oldItems.forEach(item => { oldQty[item.productId] = (oldQty[item.productId] || 0) + (item.qty || 0); });
    newItems.forEach(item => { newQty[item.productId] = (newQty[item.productId] || 0) + (item.qty || 0); });
    const productIds = new Set([...Object.keys(oldQty), ...Object.keys(newQty)]);
    for (const productId of productIds) {
      const product = ProductsManager.findById(productId);
      const difference = (oldQty[productId] || 0) - (newQty[productId] || 0);
      if (difference < 0 && product && (product.stock || 0) < Math.abs(difference)) return null;
    }
    productIds.forEach(productId => {
      ProductsManager.adjustStock(productId, (oldQty[productId] || 0) - (newQty[productId] || 0));
    });
    const subtotal = newItems.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.qty, 10) || 0)), 0);
    const discount = Math.min(subtotal, Math.max(0, parseFloat(updates.discount) || 0));
    const shipping = Math.max(0, parseFloat(updates.shipping) || 0);
    const total = Math.max(0, subtotal - discount + shipping);
    const paid = Math.max(0, parseFloat(updates.paid) || 0);
    const changeType = updates.changeType === 'return' ? 'return' : 'exchange';
    const changedFrom = oldItems.map(item => ({ ...item }));
    Object.assign(sale, {
      customerName: (updates.customerName || '').trim(),
      customerPhone: (updates.customerPhone || '').trim(),
      items: newItems,
      subtotal,
      discount,
      shipping,
      total,
      paid,
      change: Math.max(0, paid - total),
      payment: updates.payment || 'cash',
      lastModification: {
        type: changeType,
        date: new Date().toISOString(),
        removedItems: changedFrom.filter(oldItem => !newItems.some(newItem => newItem.productId === oldItem.productId)),
        addedItems: newItems.filter(newItem => !changedFrom.some(oldItem => oldItem.productId === newItem.productId))
      }
    });
    Store.saveSales(this.private.sales);
    if (window.CustomersManager && CustomersManager.rebuildFromSales) CustomersManager.rebuildFromSales(this.private.sales);
    return sale;
  },

  // Void/Refund Sale (إلغاء واسترجاع الفاتورة)
  voidSale(saleId) {
    const saleIdx = this.private.sales.findIndex(s => s.id === saleId);
    if (saleIdx === -1) return false;
    const sale = this.private.sales[saleIdx];

    // Return stock
    (sale.items || []).forEach(item => {
      ProductsManager.adjustStock(item.productId, item.qty || 1);
    });

    this.private.sales.splice(saleIdx, 1);
    Store.saveSales(this.private.sales);
    return true;
  },

  exportSalesToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة Excel غير متوفرة.');
      return;
    }
    const sales = this.private.sales || [];
    const settings = Store.getSettings();
    const currency = settings.currency || 'EGP';

    const rows = [];
    sales.forEach(sale => {
      const itemsDesc = (sale.items || []).map(i => `${i.name} (${i.qty})`).join(' + ');
      rows.push({
        'رقم الفاتورة': sale.id,
        'التاريخ والوقت': new Date(sale.date).toLocaleString('ar-EG'),
        'المنتجات والكميات': itemsDesc,
        'المجموع قبل الخصم': sale.subtotal || sale.total,
        'قيمة الخصم': sale.discount || 0,
        'تكلفة الشحن': sale.shipping || 0,
        'الإجمالي الصافي': sale.total,
        'المبلغ المدفوع': sale.paid || sale.total,
        'الباقي': sale.change || 0,
        'طريقة الدفع': sale.payment === 'card' ? 'بطاقة إلكترونية' : (sale.payment === 'cod' ? 'عند الاستلام' : 'نقداً'),
        'العملة': currency
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 16 }, // رقم
      { wch: 22 }, // تاريخ
      { wch: 40 }, // منتجات
      { wch: 16 }, // قبل خصم
      { wch: 12 }, // خصم
      { wch: 14 }, // اجمالي
      { wch: 14 }, // مدفوع
      { wch: 10 }, // باقي
      { wch: 16 }, // طريقة
      { wch: 10 }  // عملة
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل المبيعات والفواتير");
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `سجل_مبيعات_الفارس_${dateStr}.xlsx`);
  }
};

window.SalesManager = SalesManager;
