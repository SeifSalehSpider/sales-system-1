// Main application logic
const App = {
  currentView: 'pos',
  currentCategory: 'all',
  searchTimer: null,

  init() {
    Store.init();
    ProductsManager.load();
    SalesManager.load();
    this.bindEvents();
    this.renderCategories();
    this.renderProducts();
    this.renderDashboard();
    this.renderSalesHistory();
    this.renderDetailedSales();
    this.navigateTo('pos');
  },

  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo(item.dataset.view);
      });
    });

    // POS - search
    const searchInput = document.getElementById('pos-search');
    searchInput.addEventListener('input', () => {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.renderProducts(), 200);
    });

    // POS - barcode scan
    const scanInput = document.getElementById('barcode-scan');
    scanInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleScan(scanInput.value);
        scanInput.value = '';
      }
    });

    // POS - checkout
    document.getElementById('checkout-btn').addEventListener('click', () => this.openCheckout());
    document.getElementById('confirm-sale').addEventListener('click', () => this.confirmSale());
    document.getElementById('cancel-checkout').addEventListener('click', () => this.closeCheckout());

    // Products - add new
    document.getElementById('add-product-btn').addEventListener('click', () => this.openProductModal());
    document.getElementById('save-product').addEventListener('click', () => this.saveProduct());
    document.getElementById('cancel-product').addEventListener('click', () => this.closeProductModal());
    document.getElementById('generate-barcode').addEventListener('click', () => {
      document.getElementById('product-barcode').value = BarcodeUtil.generateEAN13();
    });
    ['product-oldprice', 'product-price'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.updateProductDiscount());
    });

// Products - category sections (event delegation on container)
    const catSections = document.getElementById('product-category-sections');
    catSections.addEventListener('change', (e) => {
      if (e.target.classList.contains('row-select')) this.updateSelectionUI();
      if (e.target.classList.contains('category-select-all-chk')) {
        const cat = e.target.dataset.category;
        document.querySelectorAll('.category-tbody[data-category="' + cat + '"] .row-select').forEach(cb => {
          cb.checked = e.target.checked;
        });
        this.updateSelectionUI();
      }
    });
    catSections.addEventListener('click', (e) => {
      const selAll = e.target.closest('.category-select-all');
      if (selAll) {
        const cat = selAll.dataset.category;
        document.querySelectorAll('.category-tbody[data-category="' + cat + '"] .row-select').forEach(cb => {
          cb.checked = true;
        });
        this.updateSelectionUI();
        return;
      }
      const delBtn = e.target.closest('.category-delete-selected');
      if (delBtn) {
        this.deleteSelectedProducts(delBtn.dataset.category);
        return;
      }
      const addBtn = e.target.closest('.category-add-product');
      if (addBtn) {
        this.openProductModal(null, addBtn.dataset.category);
      }
    });

// Print labels
    document.getElementById('print-labels').addEventListener('click', () => this.printSelectedLabels());
    document.getElementById('print-select-all').addEventListener('click', () => this.selectAllPrint());
    document.getElementById('print-deselect-all').addEventListener('click', () => this.deselectAllPrint());

    // Category filter
    document.getElementById('category-filter').addEventListener('change', (e) => {
      this.currentCategory = e.target.value;
      this.renderProducts();
    });

    // Detailed sales filter
    document.getElementById('detailed-sales-filter').addEventListener('change', () => {
      this.renderDetailedSales();
    });

    // Reset data
    document.getElementById('reset-data').addEventListener('click', () => {
      if (confirm('هل انت متأكد من حذف جميع البيانات؟ سيتم استرجاع البيانات التجريبية.')) {
        Store.reset();
        location.reload();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === '1') this.navigateTo('pos');
      if (e.altKey && e.key === '2') this.navigateTo('products');
      if (e.altKey && e.key === '3') this.navigateTo('print');
      if (e.altKey && e.key === '4') this.navigateTo('reports');
    });
  },

  navigateTo(view) {
    this.currentView = view;
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
    });
    const target = document.getElementById('view-' + view);
    if (target) target.classList.add('active');

    // Refresh data per view
    if (view === 'pos') this.renderProducts();
    if (view === 'products') this.renderProductTable();
    if (view === 'print') this.renderPrintList();
    if (view === 'reports') this.renderReports();
    if (view === 'dashboard') this.renderDashboard();
  },

  // ---------- POS ----------
  renderCategories() {
    const container = document.getElementById('category-filter');
    const cats = ProductsManager.getCategories();
    let html = '<option value="all">كل المنتجات</option>';
    cats.forEach(c => {
      html += `<option value="${c.id}">${c.name}</option>`;
    });
    container.innerHTML = html;
  },

  renderProducts() {
    const container = document.getElementById('product-grid');
    const searchTerm = document.getElementById('pos-search').value;
    let products = ProductsManager.search(searchTerm);
    if (this.currentCategory !== 'all') {
      products = products.filter(p => p.category === this.currentCategory);
    }
    const settings = Store.getSettings();

    container.innerHTML = products.map(p => {
      const lowStock = p.stock <= (p.minStock || 0);
      return `
        <div class="product-card ${lowStock ? 'low-stock' : ''}" onclick="App.addToCart('${p.id}')">
          <div class="product-barcode" id="barcode-mini-${p.id}"></div>
          <div class="product-name">${p.name}</div>
          <div class="product-name-en">${p.nameEn || ''}</div>
          <div class="product-price">${p.price} ${settings.currency}</div>
          <div class="product-stock">المخزون: ${p.stock}</div>
          ${lowStock ? '<div class="low-stock-badge">مخزون منخفض</div>' : ''}
        </div>`;
    }).join('');

    // Render barcodes
    products.forEach(p => {
      const el = document.getElementById('barcode-mini-' + p.id);
      if (el) BarcodeUtil.render(el, p.barcode, { displayValue: false, width: 1, height: 30, fontSize: 8 });
    });

    this.renderCart();
  },

  addToCart(productId) {
    const p = ProductsManager.findById(productId);
    if (!p) return;
    if (p.stock <= 0) {
      alert('هذا المنتج غير متوفر في المخزون');
      return;
    }
    SalesManager.addToCart(p, 1);
    this.renderCart();
  },

  handleScan(barcode) {
    barcode = barcode.trim();
    if (!barcode) return;
    const p = ProductsManager.findByBarcode(barcode);
    if (p) {
      this.addToCart(p.id);
      this.showToast('تم اضافة ' + p.name);
    } else {
      this.showToast('الباركود غير موجود: ' + barcode, true);
    }
  },

  renderCart() {
    const container = document.getElementById('cart-items');
    const settings = Store.getSettings();
    const cart = SalesManager.cart;

    if (cart.length === 0) {
      container.innerHTML = '<div class="empty-cart">لا توجد منتجات في السلة</div>';
    } else {
container.innerHTML = cart.map(item => {
        const hasDiscount = item.oldPrice > item.price;
        return `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">
              ${hasDiscount ? `<span class="old-price">${item.oldPrice} ${settings.currency}</span> ` : ''}
              <span class="new-price">${item.price} ${settings.currency}</span>
            </div>
          </div>
          <div class="cart-item-controls">
            <button onclick="App.changeQty('${item.productId}', -1)">-</button>
            <span>${item.qty}</span>
            <button onclick="App.changeQty('${item.productId}', 1)">+</button>
            <button class="remove" onclick="App.removeItem('${item.productId}')">×</button>
          </div>
          <div class="cart-item-total">${item.total} ${settings.currency}</div>
        </div>
      `;
      }).join('');
    }

    document.getElementById('cart-subtotal').textContent = SalesManager.getSubtotal() + ' ' + settings.currency;
    document.getElementById('cart-count').textContent = cart.reduce((s, i) => s + i.qty, 0);
  },

  changeQty(productId, delta) {
    const item = SalesManager.cart.find(i => i.productId === productId);
    if (!item) return;
    const p = ProductsManager.findById(productId);
    if (delta > 0 && p && item.qty >= p.stock) {
      alert('الكمية المطلوبة اكبر من المتوفر');
      return;
    }
    SalesManager.updateCartQty(productId, item.qty + delta);
    this.renderCart();
  },

  removeItem(productId) {
    SalesManager.removeFromCart(productId);
    this.renderCart();
  },

// ---------- Checkout ----------
  openCheckout() {
    if (SalesManager.cart.length === 0) {
      alert('السلة فارغة');
      return;
    }
    const settings = Store.getSettings();
    const oldSubtotal = SalesManager.getOldSubtotal();
    const subtotal = SalesManager.getSubtotal();
    const autoDiscount = SalesManager.getAutoDiscount();
    document.getElementById('checkout-subtotal').textContent = oldSubtotal + ' ' + settings.currency;
    document.getElementById('checkout-discount').value = autoDiscount;
    document.getElementById('checkout-paid').value = subtotal;
    document.getElementById('checkout-total').textContent = subtotal + ' ' + settings.currency;
    document.getElementById('checkout-change').textContent = '0 ' + settings.currency;
    document.getElementById('checkout-modal').classList.add('open');
  },

  closeCheckout() {
    document.getElementById('checkout-modal').classList.remove('open');
  },

  confirmSale() {
    const discount = parseFloat(document.getElementById('checkout-discount').value) || 0;
    const paid = parseFloat(document.getElementById('checkout-paid').value) || 0;
    const payment = document.getElementById('checkout-payment').value;
    const oldSubtotal = SalesManager.getOldSubtotal();
    const subtotal = SalesManager.getSubtotal();

if (discount > oldSubtotal) {
      alert('الخصم اكبر من الاجمالي');
      return;
    }
    if (paid < (oldSubtotal - discount)) {
      alert('المبلغ المدفوع اقل من الاجمالي');
      return;
    }

const sale = SalesManager.checkout(discount, paid, payment);
    if (sale) {
      this.closeCheckout();
      BarcodeUtil.printReceipt(sale);
      this.renderCart();
      this.renderDashboard();
      this.renderSalesHistory();
      this.renderDetailedSales();
      this.showToast('تم تسجيل البيع بنجاح');
    }
  },

// ---------- Products Table ----------
  renderProductTable() {
    const container = document.getElementById('product-category-sections');
    const settings = Store.getSettings();
    const categories = ProductsManager.getCategories();
    const products = ProductsManager.findAll();

    let html = '';
    categories.forEach(cat => {
      const catProducts = products.filter(p => p.category === cat.id);
      html += `
        <div class="category-section" data-category="${cat.id}">
          <div class="category-section-header">
            <div class="category-section-title">
              <span class="category-icon">📦</span>
              <span>${cat.name}</span>
              <small>${cat.nameEn || ''}</small>
              <span class="category-count">${catProducts.length} منتج</span>
            </div>
            <div class="bulk-actions">
              <span class="selected-count" id="selected-count-${cat.id}">0 محدد</span>
              <button class="btn btn-danger btn-sm category-delete-selected" data-category="${cat.id}" style="display:none;">🗑️ حذف المحدد</button>
              <button class="btn btn-outline btn-sm category-select-all" data-category="${cat.id}">✅ تحديد الكل</button>
              <button class="btn btn-primary btn-sm category-add-product" data-category="${cat.id}">➕ اضافة منتج</button>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width:40px;"><input type="checkbox" class="category-select-all-chk" data-category="${cat.id}"></th>
                  <th>الاسم</th>
                  <th>الباركود</th>
                  <th>سعر البيع</th>
                  <th>سعر الشراء</th>
                  <th>المخزون</th>
                  <th>اجراءات</th>
                </tr>
              </thead>
              <tbody class="category-tbody" data-category="${cat.id}">
                ${catProducts.map(p => `
                  <tr>
                    <td><input type="checkbox" class="row-select" value="${p.id}" data-category="${cat.id}"></td>
                    <td>${p.name}<br><small>${p.nameEn || ''}</small></td>
                    <td>${p.barcode}</td>
                    <td>${p.price} ${settings.currency}</td>
                    <td>${p.cost} ${settings.currency}</td>
                    <td>
                      <span class="${p.stock <= (p.minStock || 0) ? 'text-danger' : ''}">${p.stock}</span>
                    </td>
                    <td>
                      <button class="btn btn-sm btn-outline" onclick="App.editProduct('${p.id}')">تعديل</button>
                      <button class="btn btn-sm btn-danger" onclick="App.deleteProduct('${p.id}')">حذف</button>
                    </td>
                  </tr>
                `).join('') || '<tr><td colspan="7" class="text-center">لا توجد منتجات في هذا القسم</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;
    });

    container.innerHTML = html || '<div class="empty">لا توجد بيانات</div>';
    this.updateSelectionUI();
  },

  toggleSelectAll(checked) {
    document.querySelectorAll('.row-select').forEach(cb => {
      cb.checked = checked;
    });
    this.updateSelectionUI();
  },

  updateSelectionUI() {
    const categories = ProductsManager.getCategories();
    categories.forEach(cat => {
      const checkboxes = document.querySelectorAll('.category-tbody[data-category="' + cat.id + '"] .row-select');
      const selected = document.querySelectorAll('.category-tbody[data-category="' + cat.id + '"] .row-select:checked').length;
      const selectAll = document.querySelector('.category-select-all-chk[data-category="' + cat.id + '"]');
      const btn = document.querySelector('.category-delete-selected[data-category="' + cat.id + '"]');
      const count = document.getElementById('selected-count-' + cat.id);

      if (selectAll) selectAll.checked = checkboxes.length > 0 && selected === checkboxes.length;
      if (count) count.textContent = selected + ' محدد';
      if (btn) btn.style.display = selected > 0 ? 'inline-flex' : 'none';
    });
  },

  deleteSelectedProducts(categoryId) {
    const scope = categoryId ? '.category-tbody[data-category="' + categoryId + '"] ' : '';
    const selected = Array.from(document.querySelectorAll(scope + '.row-select:checked')).map(cb => cb.value);
    if (selected.length === 0) {
      this.showToast('لم يتم تحديد اي منتجات', true);
      return;
    }
    if (confirm('هل انت متأكد من حذف ' + selected.length + ' منتج؟')) {
      ProductsManager.removeMany(selected);
      this.renderProductTable();
      this.renderProducts();
      this.renderDashboard();
      this.showToast('تم حذف ' + selected.length + ' منتج');
    }
  },

  openProductModal(productId, categoryId) {
    const modal = document.getElementById('product-modal');
    const cats = ProductsManager.getCategories();
    let catOptions = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    if (productId) {
      const p = ProductsManager.findById(productId);
      document.getElementById('product-id').value = p.id;
      document.getElementById('product-name').value = p.name;
      document.getElementById('product-name-en').value = p.nameEn || '';
      document.getElementById('product-barcode').value = p.barcode;
      document.getElementById('product-category').innerHTML = catOptions;
      document.getElementById('product-category').value = p.category;
document.getElementById('product-oldprice').value = p.oldPrice || p.price;
      document.getElementById('product-price').value = p.price;
      document.getElementById('product-cost').value = p.cost;
      document.getElementById('product-stock').value = p.stock;
      document.getElementById('product-minstock').value = p.minStock || 0;
      document.getElementById('product-modal-title').textContent = 'تعديل منتج';
    } else {
      document.getElementById('product-id').value = '';
      document.getElementById('product-name').value = '';
      document.getElementById('product-name-en').value = '';
      document.getElementById('product-barcode').value = BarcodeUtil.generateEAN13();
      document.getElementById('product-category').innerHTML = catOptions;
      if (categoryId) document.getElementById('product-category').value = categoryId;
      document.getElementById('product-oldprice').value = '';
      document.getElementById('product-price').value = '';
      document.getElementById('product-cost').value = '';
      document.getElementById('product-stock').value = '0';
      document.getElementById('product-minstock').value = '0';
      document.getElementById('product-modal-title').textContent = 'اضافة منتج جديد';
    }
    this.updateProductDiscount();
    modal.classList.add('open');
  },

  editProduct(id) {
    this.openProductModal(id);
  },

  closeProductModal() {
    document.getElementById('product-modal').classList.remove('open');
  },

  updateProductDiscount() {
    const oldPrice = parseFloat(document.getElementById('product-oldprice').value) || 0;
    const price = parseFloat(document.getElementById('product-price').value) || 0;
    const discountEl = document.getElementById('product-discount');
    if (discountEl) discountEl.value = Math.max(0, oldPrice - price).toFixed(2);
  },

  saveProduct() {
    const id = document.getElementById('product-id').value;
    const data = {
      name: document.getElementById('product-name').value.trim(),
      nameEn: document.getElementById('product-name-en').value.trim(),
      barcode: document.getElementById('product-barcode').value.trim(),
category: document.getElementById('product-category').value,
      oldPrice: parseFloat(document.getElementById('product-oldprice').value) || parseFloat(document.getElementById('product-price').value) || 0,
      price: parseFloat(document.getElementById('product-price').value) || 0,
      cost: parseFloat(document.getElementById('product-cost').value) || 0,
      stock: parseInt(document.getElementById('product-stock').value) || 0,
      minStock: parseInt(document.getElementById('product-minstock').value) || 0
    };

    if (!data.name || !data.barcode) {
      alert('الاسم والباركود مطلوبان');
      return;
    }

    // Check barcode uniqueness
    const dup = ProductsManager.findByBarcode(data.barcode);
    if (dup && dup.id !== id) {
      alert('الباركود مستخدم بالفعل لمنتج اخر');
      return;
    }

    if (id) {
      ProductsManager.update(id, data);
      this.showToast('تم تحديث المنتج');
    } else {
      ProductsManager.add(data);
      this.showToast('تم اضافة المنتج');
    }
    this.closeProductModal();
    this.renderProductTable();
    this.renderProducts();
  },

  deleteProduct(id) {
    if (confirm('هل انت متأكد من حذف هذا المنتج؟')) {
      ProductsManager.remove(id);
      this.renderProductTable();
      this.renderProducts();
      this.showToast('تم حذف المنتج');
    }
  },

  // ---------- Print Labels ----------
  renderPrintList() {
    const products = ProductsManager.findAll();
    const container = document.getElementById('print-list');
    container.innerHTML = products.map(p => `
      <div class="print-item">
        <label class="checkbox">
          <input type="checkbox" value="${p.id}" checked data-print-id="${p.id}">
          <span>${p.name} (${p.nameEn || ''}) - ${p.barcode}</span>
        </label>
      </div>
    `).join('') || '<div class="empty">لا توجد منتجات</div>';

    // Render barcodes in list
    products.forEach(p => {
      const el = document.getElementById('print-barcode-' + p.id);
      if (el) BarcodeUtil.render(el, p.barcode, { displayValue: false, width: 1, height: 25 });
    });
  },

  selectAllPrint() {
    document.querySelectorAll('#print-list input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
    });
    this.showToast('تم تحديد جميع المنتجات');
  },

  deselectAllPrint() {
    document.querySelectorAll('#print-list input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    this.showToast('تم الغاء تحديد جميع المنتجات');
  },

  printSelectedLabels() {
    const selected = [];
    document.querySelectorAll('#print-list input[type="checkbox"]:checked').forEach(cb => {
      const p = ProductsManager.findById(cb.value);
      if (p) selected.push(p);
    });
    if (selected.length === 0) {
      alert('اختر منتجات واضغط على طباعة الملصقات');
      return;
    }
    BarcodeUtil.printLabels(selected);
  },

  // ---------- Reports ----------
  renderReports() {
    const settings = Store.getSettings();
    const today = SalesManager.getTodaySales();
    const totalSales = SalesManager.getAllSales();
    const topProducts = SalesManager.getTopProducts(5);

    document.getElementById('report-today-count').textContent = today.length;
    document.getElementById('report-today-revenue').textContent = SalesManager.getTodayRevenue() + ' ' + settings.currency;
    document.getElementById('report-today-profit').textContent = SalesManager.getTodayProfit() + ' ' + settings.currency;
    document.getElementById('report-total-count').textContent = totalSales.length;
    document.getElementById('report-total-revenue').textContent = SalesManager.getTotalRevenue() + ' ' + settings.currency;

    // Top products
    const topContainer = document.getElementById('top-products');
    topContainer.innerHTML = topProducts.map((tp, i) => `
      <div class="top-product">
        <span class="rank">${i + 1}</span>
        <span class="name">${tp.name}</span>
        <span class="qty">${tp.qty} قطعة</span>
        <span class="rev">${tp.revenue} ${settings.currency}</span>
      </div>
    `).join('') || '<div class="empty">لا توجد بيانات بعد</div>';

    // Low stock
    const lowStock = ProductsManager.getLowStock();
    const lowContainer = document.getElementById('low-stock-list');
    lowContainer.innerHTML = lowStock.map(p => `
      <div class="low-stock-item">
        <span>${p.name}</span>
        <span class="badge badge-danger">${p.stock} متبقي</span>
      </div>
    `).join('') || '<div class="empty">لا توجد منتجات منخفضة المخزون</div>';
  },

  renderDashboard() {
    const settings = Store.getSettings();
    document.getElementById('stat-today-sales').textContent = SalesManager.getTodaySales().length;
    document.getElementById('stat-today-revenue').textContent = SalesManager.getTodayRevenue() + ' ' + settings.currency;
    document.getElementById('stat-today-profit').textContent = SalesManager.getTodayProfit() + ' ' + settings.currency;
    document.getElementById('stat-total-products').textContent = ProductsManager.findAll().length;
    document.getElementById('stat-low-stock').textContent = ProductsManager.getLowStock().length;
    this.renderDetailedSales();
  },

  renderSalesHistory() {
    const sales = SalesManager.getAllSales();
    const settings = Store.getSettings();
    const container = document.getElementById('sales-history');
    container.innerHTML = sales.slice(0, 20).map(s => `
      <div class="sale-row">
        <span class="sale-id">${s.id}</span>
        <span class="sale-date">${new Date(s.date).toLocaleString('ar-EG')}</span>
        <span class="sale-items">${s.items.reduce((sum, i) => sum + i.qty, 0)} قطعة</span>
        <span class="sale-total">${s.total} ${settings.currency}</span>
      </div>
    `).join('') || '<div class="empty">لا توجد مبيعات بعد</div>';
  },

  renderDetailedSales() {
    const container = document.getElementById('detailed-sales');
    if (!container) return;
    const settings = Store.getSettings();
    const filter = document.getElementById('detailed-sales-filter');
    const filterVal = filter ? filter.value : 'today';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate = startOfToday;
    if (filterVal === '7days') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (filterVal === '30days') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const sales = SalesManager.getAllSales().filter(s => {
      const d = new Date(s.date);
      return d >= startDate;
    });

    if (sales.length === 0) {
      container.innerHTML = '<div class="empty">لا توجد فواتير في هذه الفترة</div>';
      return;
    }

    container.innerHTML = sales.map(s => {
      const itemsHtml = s.items.map(item => `
        <tr>
          <td>${item.name}${item.nameEn ? '<br><small>' + item.nameEn + '</small>' : ''}</td>
          <td class="barcode-cell">${item.barcode || '—'}</td>
          <td>${item.qty}</td>
          <td>${item.price} ${settings.currency}</td>
          <td>${item.total} ${settings.currency}</td>
        </tr>
      `).join('');

      return `
        <div class="detailed-sale">
          <div class="detailed-sale-header">
            <span class="invoice-id">🧾 رقم الفاتورة: ${s.id}</span>
            <span class="invoice-date">${new Date(s.date).toLocaleString('ar-EG')}</span>
            <span class="invoice-total">${s.total} ${settings.currency}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>الكود / الباركود</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th>الاجمالي</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>
        </div>`;
    }).join('');
  },

  showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + (isError ? 'error' : '');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
