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
    const existing = this.cart.find(i => i.productId === product.id);
    if (existing) {
      existing.qty += qty;
      existing.total = existing.qty * existing.price;
      existing.oldTotal = existing.qty * existing.oldPrice;
    } else {
      this.cart.push({
        productId: product.id,
        name: product.name,
        nameEn: product.nameEn || '',
        barcode: product.barcode,
        oldPrice: product.oldPrice || product.price,
        price: product.price,
        qty: qty,
        total: product.price * qty,
        oldTotal: (product.oldPrice || product.price) * qty
      });
    }
  },

  updateCartQty(productId, qty) {
    const item = this.cart.find(i => i.productId === productId);
    if (!item) return;
    if (qty <= 0) {
      this.cart = this.cart.filter(i => i.productId !== productId);
    } else {
      item.qty = qty;
      item.total = item.qty * item.price;
      item.oldTotal = item.qty * item.oldPrice;
    }
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(i => i.productId !== productId);
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
checkout(discount, paid, payment, customerName = '', customerPhone = '') {
  if (this.cart.length === 0) return null;
  // subtotal = sum of before-discount (original) prices
  const subtotal = this.getOldSubtotal();
  discount = discount || 0;
  // total = after-discount prices sum (what the customer pays)
  const total = Math.max(0, subtotal - discount);
  const change = Math.max(0, paid - total);

  const cleanCustName = (customerName || '').trim();
  const cleanCustPhone = (customerPhone || '').trim();

  const sale = {
    id: 'INV-' + Date.now().toString().slice(-8),
    date: new Date().toISOString(),
    customerName: cleanCustName,
    customerPhone: cleanCustPhone,
    items: this.cart.map(i => ({ ...i })),
    subtotal: subtotal,
    discount: discount,
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

  // Held Carts (تعليق الفواتير)
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
    return held;
  },

  deleteHeldCart(id) {
    const idx = this.heldCarts.findIndex(h => h.id === id);
    if (idx !== -1) {
      this.heldCarts.splice(idx, 1);
      return true;
    }
    return false;
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
