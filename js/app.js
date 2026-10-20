// Sound Effects Synthesizer (Web Audio API)
const SoundEffects = {
  ctx: null,
  enabled: localStorage.getItem('sound_enabled') !== 'false',

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  },

  playTone(freq, type, duration) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  },

  beep() { this.playTone(880, 'sine', 0.08); },
  success() {
    this.playTone(587.33, 'triangle', 0.1);
    setTimeout(() => this.playTone(880, 'triangle', 0.2), 100);
  },
  click() { this.playTone(440, 'sine', 0.04); },
  error() { this.playTone(220, 'sawtooth', 0.25); }
};

window.SoundEffects = SoundEffects;

// Main application logic
const App = {
  currentView: 'pos',
  currentCategory: 'all',
  searchTimer: null,
  currentReceiptSale: null,

  init() {
    Store.init();
    if (window.LicenseManager) LicenseManager.init();
    ProductsManager.load();
    SalesManager.load();
    SalesManager.heldCarts = Store.getHeldCarts();
    CustomersManager.load();
    this.bindEvents();
    this.renderCategories();
    this.renderProducts();
    this.renderSalesHistory();
    this.renderDetailedSales();
    this.updateHeldCountBadge();
    this.updateSoundButtonUI();
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

    // Top Bar Actions
    const fullBtn = document.getElementById('fullscreen-btn');
    if (fullBtn) fullBtn.addEventListener('click', () => this.toggleFullscreen());

    const sndBtn = document.getElementById('sound-btn');
    if (sndBtn) sndBtn.addEventListener('click', () => this.toggleSound());

    const bkpBtn = document.getElementById('backup-btn');
    if (bkpBtn) bkpBtn.addEventListener('click', () => this.downloadBackup());

    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettingsModal());
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    const closeSettingsBtn = document.getElementById('close-settings-modal');
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => this.closeSettingsModal());

    // POS - Held Carts & Clear Cart
    const holdBtn = document.getElementById('hold-cart-btn');
    if (holdBtn) holdBtn.addEventListener('click', () => this.holdCurrentCart());

    const heldBtn = document.getElementById('held-carts-btn');
    if (heldBtn) heldBtn.addEventListener('click', () => this.openHeldCartsModal());

    const closeHeldBtn = document.getElementById('close-held-carts-modal');
    if (closeHeldBtn) closeHeldBtn.addEventListener('click', () => this.closeHeldCartsModal());

    const clearCartBtn = document.getElementById('clear-cart-btn');
    if (clearCartBtn) clearCartBtn.addEventListener('click', () => this.clearCart());

    // Products Management Search & Category Manager
    const prodSearch = document.getElementById('product-mgr-search');
    if (prodSearch) {
      prodSearch.addEventListener('input', () => {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.filterProductManager(prodSearch.value), 150);
      });
    }

    const catMgrBtn = document.getElementById('manage-categories-btn');
    if (catMgrBtn) catMgrBtn.addEventListener('click', () => this.openCategoriesModal());
    const saveCatBtn = document.getElementById('save-new-category-btn');
    if (saveCatBtn) saveCatBtn.addEventListener('click', () => this.saveNewCategory());
    const closeCatModalBtn = document.getElementById('close-categories-modal');
    if (closeCatModalBtn) closeCatModalBtn.addEventListener('click', () => this.closeCategoriesModal());

    const exportProdsBtn = document.getElementById('export-products-btn');
    if (exportProdsBtn) exportProdsBtn.addEventListener('click', () => {
      ProductsManager.exportProductsToExcel();
      this.showToast('تم تصدير ملف إكسيل للمنتجات والمخزون');
    });

    const exportSalesBtn = document.getElementById('export-sales-excel-btn');
    if (exportSalesBtn) exportSalesBtn.addEventListener('click', () => {
      SalesManager.exportSalesToExcel();
      this.showToast('تم تصدير سجل المبيعات إلى Excel');
    });

    const exportAnalyticsBtn = document.getElementById('export-analytics-btn');
    if (exportAnalyticsBtn) exportAnalyticsBtn.addEventListener('click', () => this.exportAnalyticsToExcel());

    const exportAIBtn = document.getElementById('export-ai-report-btn');
    if (exportAIBtn) exportAIBtn.addEventListener('click', () => this.exportAIReport());

    // Customer CRM & Leaderboard Events
    const custDropdown = document.getElementById('customer-dropdown-select');
    if (custDropdown) {
      custDropdown.addEventListener('change', () => {
        this.inspectCustomer(custDropdown.value);
      });
    }

    const custSearch = document.getElementById('customer-search-input');
    if (custSearch) {
      custSearch.addEventListener('input', () => {
        this.filterCustomersLeaderboard(custSearch.value);
      });
    }

    const exportCustBtn = document.getElementById('export-customers-excel-btn');
    if (exportCustBtn) {
      exportCustBtn.addEventListener('click', () => {
        CustomersManager.exportToExcel();
        this.showToast('تم تصدير ليدربورد العملاء إلى Excel 👥');
      });
    }
    const saveSaleEditBtn = document.getElementById('save-sale-edit');
    if (saveSaleEditBtn) saveSaleEditBtn.addEventListener('click', () => this.saveSaleEdit());
    const cancelSaleEditBtn = document.getElementById('cancel-sale-edit');
    if (cancelSaleEditBtn) cancelSaleEditBtn.addEventListener('click', () => this.closeSaleEditModal());
    const addEditSaleProductBtn = document.getElementById('add-edit-sale-product');
    if (addEditSaleProductBtn) addEditSaleProductBtn.addEventListener('click', () => this.addProductToSaleBySerial());
    const editSaleSerial = document.getElementById('edit-sale-product-serial');
    if (editSaleSerial) {
      editSaleSerial.addEventListener('input', () => this.renderSaleProductSuggestions(editSaleSerial.value));
      editSaleSerial.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this.addProductToSaleBySerial(); }
        if (e.key === 'Escape') this.renderSaleProductSuggestions('');
      });
    }
    ['edit-sale-discount', 'edit-sale-shipping', 'edit-sale-paid'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.addEventListener('input', () => this.updateSaleEditPreview());
    });

    // Checkout Customer Auto-fill
    const custNameInput = document.getElementById('checkout-customer-name');
    const custPhoneInput = document.getElementById('checkout-customer-phone');
    if (custNameInput && custPhoneInput) {
      custNameInput.addEventListener('change', () => {
        const found = CustomersManager.findByName(custNameInput.value);
        if (found && found.phone && !custPhoneInput.value) {
          custPhoneInput.value = found.phone;
        }
      });
      custPhoneInput.addEventListener('change', () => {
        const found = CustomersManager.findByPhone(custPhoneInput.value);
        if (found && found.name && !custNameInput.value) {
          custNameInput.value = found.name;
        }
      });
    }

    // Receipt Modal Actions
    const printReceiptBtn = document.getElementById('print-receipt-action-btn');
    if (printReceiptBtn) printReceiptBtn.addEventListener('click', () => window.print());
    const closeReceiptBtn = document.getElementById('close-receipt-modal');
    if (closeReceiptBtn) closeReceiptBtn.addEventListener('click', () => this.closeReceiptModal());

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

    // Show/hide customer address field depending on payment method
    const paymentSelect = document.getElementById('checkout-payment');
    if (paymentSelect) {
      paymentSelect.addEventListener('change', () => this.toggleCheckoutAddress());
    }

    // Products - add new
    document.getElementById('add-product-btn').addEventListener('click', () => this.openProductModal());
    document.getElementById('save-product').addEventListener('click', () => this.saveProduct());
    document.getElementById('cancel-product').addEventListener('click', () => this.closeProductModal());
    document.getElementById('generate-barcode').addEventListener('click', () => {
      document.getElementById('product-barcode').value = BarcodeUtil.generateEAN13();
    });
    ['product-price'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.addEventListener('input', () => this.updateProductDiscount());
    });

    // Excel Import & Template
    const stockExistingSelect = document.getElementById('stock-existing-product');
    if (stockExistingSelect) this.renderStockProductOptions();
    const stockExistingBtn = document.getElementById('stock-add-existing-btn');
    if (stockExistingBtn) stockExistingBtn.addEventListener('click', () => this.addExistingProductToStock());
    const stockAddBtn = document.getElementById('stock-add-product-btn');
    if (stockAddBtn) stockAddBtn.addEventListener('click', () => this.openProductModal());
    const stockImportBtn = document.getElementById('stock-import-excel-btn');
    const stockFileInput = document.getElementById('stock-excel-file-input');
    if (stockImportBtn && stockFileInput) {
      stockImportBtn.addEventListener('click', () => { stockFileInput.value = ''; stockFileInput.click(); });
      stockFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) this.handleExcelFile(e.target.files[0]);
      });
    }

    const importExcelBtn = document.getElementById('import-excel-btn');
    const excelFileInput = document.getElementById('excel-file-input');
    if (importExcelBtn && excelFileInput) {
      importExcelBtn.addEventListener('click', () => {
        excelFileInput.value = '';
        excelFileInput.click();
      });
      excelFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleExcelFile(e.target.files[0]);
        }
      });
    }
    const downloadTmplBtn = document.getElementById('download-template-btn');
    if (downloadTmplBtn) {
      downloadTmplBtn.addEventListener('click', () => this.downloadExcelTemplate());
    }
    const confirmImportBtn = document.getElementById('confirm-import-excel');
    if (confirmImportBtn) {
      confirmImportBtn.addEventListener('click', () => this.confirmExcelImport());
    }
    const cancelImportBtn = document.getElementById('cancel-import-excel');
    if (cancelImportBtn) {
      cancelImportBtn.addEventListener('click', () => this.closeExcelModal());
    }

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
      const toggle = e.target.closest('.category-toggle');
      if (toggle) {
        const section = toggle.closest('.category-section');
        const content = section.querySelector('.category-content');
        const isOpen = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!isOpen));
        section.classList.toggle('collapsed', isOpen);
        if (content) content.hidden = isOpen;
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

    // Detailed sales filter (optional legacy element)
    const detailedSalesFilter = document.getElementById('detailed-sales-filter');
    if (detailedSalesFilter) {
      detailedSalesFilter.addEventListener('change', () => {
        this.renderDetailedSales();
      });
    }

    // Reset data
    document.getElementById('reset-data').addEventListener('click', () => {
      if (confirm('هل أنت متأكد من حذف جميع البيانات؟ سيتم تفريغ كافة المنتجات والمبيعات وتصفير النظام بالكامل.')) {
        Store.reset();
        location.reload();
      }
    });

    // Analytics Period Filter Pills
    document.querySelectorAll('#analytics-period-pills .period-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#analytics-period-pills .period-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderAnalytics(btn.dataset.period);
      });
    });

    // AI Assistant Chat & Controls
    const aiSendBtn = document.getElementById('ai-chat-send-btn');
    const aiInput = document.getElementById('ai-chat-input');
    if (aiSendBtn && aiInput) {
      aiSendBtn.addEventListener('click', () => {
        const txt = aiInput.value.trim();
        if (txt) {
          AIAssistant.sendMessage(txt);
          aiInput.value = '';
        }
      });
      aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          aiSendBtn.click();
        }
      });
    }

    const clearChatBtn = document.getElementById('ai-clear-chat-btn');
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => AIAssistant.clearChat());
    }

    document.querySelectorAll('.chip-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (prompt) {
          AIAssistant.sendMessage(prompt);
        }
      });
    });

    const aiRefreshBtn = document.getElementById('ai-refresh-insights-btn');
    const aiPeriodSelect = document.getElementById('ai-period-select');
    if (aiRefreshBtn && aiPeriodSelect) {
      aiRefreshBtn.addEventListener('click', () => {
        this.renderAIExecutiveReport(aiPeriodSelect.value);
        this.showToast('تم تحديث التقرير الذكي بنجاح');
      });
      aiPeriodSelect.addEventListener('change', () => {
        AIAssistant.currentPeriod = aiPeriodSelect.value;
        this.renderAIExecutiveReport(aiPeriodSelect.value);
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === '1') this.navigateTo('pos');
      if (e.altKey && e.key === '2') this.navigateTo('products');
      if (e.altKey && e.key === '3') this.navigateTo('print');
      if (e.altKey && e.key === '4') this.navigateTo('reports');
    });
  },

  renderStockProductOptions() {
    const select = document.getElementById('stock-existing-product');
    if (!select) return;
    const products = ProductsManager.findAll();
    select.innerHTML = '<option value="">-- اختر المنتج --</option>' + products.map(p =>
      `<option value="${p.id}">${p.name} | المخزون الحالي: ${p.stock || 0}</option>`
    ).join('');
  },

  addExistingProductToStock() {
    const select = document.getElementById('stock-existing-product');
    const quantityInput = document.getElementById('stock-add-quantity');
    const productId = select ? select.value : '';
    const quantity = parseInt(quantityInput ? quantityInput.value : 0, 10);
    if (!productId || !quantity || quantity < 1) {
      alert('اختر منتجاً وأدخل كمية صحيحة.');
      return;
    }
    ProductsManager.adjustStock(productId, quantity);
    this.renderStockProductOptions();
    this.renderProductTable();
    this.renderProducts();
    this.renderDashboard();
    if (quantityInput) quantityInput.value = '1';
    this.showToast('تمت إضافة الكمية إلى المخزون بنجاح');
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
    if (view === 'analytics') this.renderAnalytics(AnalyticsManager.currentPeriod || '30days');
    if (view === 'ai') this.renderAIAssistant();
    if (view === 'customers') this.renderCustomers();
    if (view === 'stock-entry') this.renderStockProductOptions();
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

    if (products.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--muted);">
          <div style="font-size: 40px; margin-bottom: 10px;">📦</div>
          <div style="font-size: 16px; font-weight: 600; color: var(--dark); margin-bottom: 6px;">لا توجد منتجات مضافة بعد</div>
          <div style="font-size: 13px;">يمكنك إضافة منتجات جديدة أو استيرادها من ملف Excel من صفحة إدارة المنتجات.</div>
        </div>
      `;
      this.renderCart();
      return;
    }

    container.innerHTML = products.map(p => {
      const lowStock = Number(p.stock) <= 1;
      const sizes = ProductsManager.getSizes(p);
      const sizeMenu = sizes.length ? `
        <select class="product-size-select" id="size-select-${p.id}" onclick="event.stopPropagation()" onchange="event.stopPropagation()">
          ${sizes.map(size => `<option value="${size}">${size}</option>`).join('')}
        </select>` : '';
      return `
        <div class="product-card ${lowStock ? 'low-stock' : ''}" onclick="App.addToCart('${p.id}')">
          <div class="product-barcode" id="barcode-mini-${p.id}"></div>
          <div class="product-name">${ProductsManager.getDisplayName(p)}</div>
          <div class="product-name-en">${p.nameEn || ''}</div>
          ${sizeMenu}
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
    const sizeSelect = document.getElementById('size-select-' + productId);
    const selectedSize = sizeSelect ? sizeSelect.value : '';
    if (p.stock <= 0) {
      SoundEffects.error();
      alert('هذا المنتج غير متوفر في المخزون');
      return;
    }
    SalesManager.addToCart({ ...p, size: selectedSize }, 1);
    SoundEffects.click();
    this.renderCart();
  },

  handleScan(barcode) {
    barcode = barcode.trim();
    if (!barcode) return;
    const p = ProductsManager.findByBarcode(barcode);
    if (p) {
      if (p.stock <= 0) {
        SoundEffects.error();
        this.showToast('المنتج نفد من المخزون: ' + p.name, true);
        return;
      }
      this.addToCart(p.id);
      SoundEffects.beep();
      this.showToast('تم اضافة ' + p.name);
    } else {
      SoundEffects.error();
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
            <div class="cart-item-name">${item.name}${item.size ? ` <small style="color:var(--primary);">(مقاس ${item.size})</small>` : ''}</div>
            <div class="cart-item-price">
              ${hasDiscount ? `<span class="old-price">${item.oldPrice} ${settings.currency}</span> ` : ''}
              <span class="new-price">${item.price} ${settings.currency}</span>
            </div>
          </div>
          <div class="cart-item-controls">
            <button onclick="App.changeQty('${item.productId}', -1, '${item.size || ''}')">-</button>
            <span>${item.qty}</span>
            <button onclick="App.changeQty('${item.productId}', 1, '${item.size || ''}')">+</button>
            <button class="remove" onclick="App.removeItem('${item.productId}', '${item.size || ''}')">×</button>
          </div>
          <div class="cart-item-total">${item.total} ${settings.currency}</div>
        </div>
      `;
      }).join('');
    }

    document.getElementById('cart-subtotal').textContent = SalesManager.getSubtotal() + ' ' + settings.currency;
    document.getElementById('cart-count').textContent = cart.reduce((s, i) => s + i.qty, 0);
  },

  changeQty(productId, delta, size = '') {
    const item = SalesManager.cart.find(i => i.productId === productId && (i.size || '') === size);
    if (!item) return;
    const p = ProductsManager.findById(productId);
    if (delta > 0 && p && item.qty >= p.stock) {
      alert('الكمية المطلوبة اكبر من المتوفر');
      return;
    }
    SalesManager.updateCartQty(productId, item.qty + delta, size);
    this.renderCart();
  },

  removeItem(productId, size = '') {
    SalesManager.removeFromCart(productId, size);
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

    // Reset shipping field
    const shippingInput = document.getElementById('checkout-shipping');
    if (shippingInput) shippingInput.value = 0;

    // Reset customer fields
    const custNameInput = document.getElementById('checkout-customer-name');
    const custPhoneInput = document.getElementById('checkout-customer-phone');
    const custAddressInput = document.getElementById('checkout-customer-address');
    if (custNameInput) custNameInput.value = '';
    if (custPhoneInput) custPhoneInput.value = '';
    if (custAddressInput) custAddressInput.value = '';

    // Reset payment method and address field visibility
    const paymentSelect = document.getElementById('checkout-payment');
    if (paymentSelect) paymentSelect.value = 'cash';
    this.toggleCheckoutAddress();

    // Populate existing customers datalist
    const datalist = document.getElementById('existing-customers-list');
    if (datalist) {
      const customers = CustomersManager.findAll();
      datalist.innerHTML = customers.map(c => `<option value="${c.name}">${c.phone ? '📱 ' + c.phone : ''}</option>`).join('');
    }

    document.getElementById('checkout-subtotal').textContent = oldSubtotal + ' ' + settings.currency;
    document.getElementById('checkout-discount').value = autoDiscount;
    document.getElementById('checkout-shipping').value = 0;
    document.getElementById('checkout-paid').value = subtotal;
    document.getElementById('checkout-total').textContent = subtotal + ' ' + settings.currency;
    document.getElementById('checkout-change').textContent = '0 ' + settings.currency;
    document.getElementById('checkout-modal').classList.add('open');
  },

  // Show the customer address field only when payment is Cash on Delivery
  toggleCheckoutAddress() {
    const payment = document.getElementById('checkout-payment');
    const group = document.getElementById('checkout-address-group');
    if (!group) return;
    const isCod = payment && payment.value === 'cod';
    group.style.display = isCod ? 'block' : 'none';
  },

  closeCheckout() {
    document.getElementById('checkout-modal').classList.remove('open');
  },

  confirmSale() {
    const discount = parseFloat(document.getElementById('checkout-discount').value) || 0;
    const shipping = Math.max(0, parseFloat(document.getElementById('checkout-shipping').value) || 0);
    const paid = parseFloat(document.getElementById('checkout-paid').value) || 0;
    const payment = document.getElementById('checkout-payment').value;
    const oldSubtotal = SalesManager.getOldSubtotal();
    const subtotal = SalesManager.getSubtotal();
    const custName = document.getElementById('checkout-customer-name')?.value || '';
    const custPhone = document.getElementById('checkout-customer-phone')?.value || '';
    const custAddress = document.getElementById('checkout-customer-address')?.value || '';

    if (payment === 'cod' && !custAddress.trim()) {
      alert('من فضلك اكتب عنوان العميل لتوصيل الطلب (الدفع عند الاستلام)');
      return;
    }

    if (discount > oldSubtotal) {
      alert('الخصم اكبر من الاجمالي');
      return;
    }
    if (paid < (oldSubtotal - discount + shipping)) {
      alert('المبلغ المدفوع اقل من الاجمالي');
      return;
    }

    const sale = SalesManager.checkout(discount, paid, payment, custName, custPhone, shipping, custAddress);
    if (sale) {
      this.closeCheckout();
      SoundEffects.success();
      this.renderCart();
      this.renderDashboard();
      this.renderSalesHistory();
      this.renderDetailedSales();
      if (this.currentView === 'customers') this.renderCustomers();
      this.openReceiptModal(sale);
      this.showToast('تم تسجيل البيع وتحديث بيانات العميل بنجاح');
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
            <button class="category-toggle" type="button" data-category="${cat.id}" aria-expanded="true" title="فتح/غلق القسم">
              <span class="category-icon">📦</span>
              <span>${cat.name}</span>
              <small>${cat.nameEn || ''}</small>
              <span class="category-count">${catProducts.length} منتج</span>
              <span class="category-chevron">⌃</span>
            </button>
            <div class="bulk-actions">
              <span class="selected-count" id="selected-count-${cat.id}">0 محدد</span>
              <button class="btn btn-danger btn-sm category-delete-selected" data-category="${cat.id}" style="display:none;">🗑️ حذف المحدد</button>
              <button class="btn btn-outline btn-sm category-select-all" data-category="${cat.id}">✅ تحديد الكل</button>
              <button class="btn btn-primary btn-sm category-add-product" data-category="${cat.id}">➕ اضافة منتج</button>
            </div>
          </div>
          <div class="category-content">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width:40px;"><input type="checkbox" class="category-select-all-chk" data-category="${cat.id}"></th>
                  <th>الاسم</th>
                  <th>المقاسات</th>
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
                    <td>${ProductsManager.getSizes(p).join('، ') || '—'}</td>
                    <td>${p.barcode}</td>
                    <td>${p.price} ${settings.currency}</td>
                    <td>${p.cost} ${settings.currency}</td>
                    <td>
                      <span class="${Number(p.stock) <= 1 ? 'text-danger' : ''}">${p.stock}</span>
                    </td>
                    <td>
                      <button class="btn btn-sm btn-outline" onclick="App.editProduct('${p.id}')">تعديل</button>
                      <button class="btn btn-sm btn-danger" onclick="App.deleteProduct('${p.id}')">حذف</button>
                    </td>
                  </tr>
                `).join('') || '<tr><td colspan="8" class="text-center">لا توجد منتجات في هذا القسم</td></tr>'}
              </tbody>
            </table>
          </div>
          </div>
        </div>`;
    });

    if (!html || categories.length === 0 || products.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--muted); background: var(--card-bg); border-radius: var(--radius); border: 2px dashed var(--border);">
          <div style="font-size: 48px; margin-bottom: 12px;">📊</div>
          <div style="font-size: 18px; font-weight: 700; color: var(--dark); margin-bottom: 8px;">قاعدة بيانات المنتجات فارغة</div>
          <div style="font-size: 14px; margin-bottom: 20px; max-width: 480px; margin-left: auto; margin-right: auto; line-height: 1.6;">
            يمكنك البدء بإضافة منتجاتك يدوياً عبر زر <strong>"➕ اضافة منتج"</strong> أو استيرادها دفعة واحدة من ملف إكسيل عبر زر <strong>"📥 استيراد من Excel"</strong>.
          </div>
        </div>
      `;
    } else {
      container.innerHTML = html;
    }
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
    let cats = ProductsManager.getCategories();
    if (cats.length === 0) {
      const defaultCat = ProductsManager.getOrCreateCategory('عام', 'General');
      cats = [defaultCat];
    }
    let catOptions = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    if (productId) {
      const p = ProductsManager.findById(productId);
      document.getElementById('product-id').value = p.id;
      document.getElementById('product-name').value = p.name;
      document.getElementById('product-name-en').value = p.nameEn || '';
      document.getElementById('product-model-description').value = p.modelDescription || '';
      document.getElementById('product-manufacturer').value = p.manufacturer || '';
      document.getElementById('product-available-sizes').value = p.availableSizes || '';
      document.getElementById('product-barcode').value = p.barcode;
      document.getElementById('product-category').innerHTML = catOptions;
      document.getElementById('product-category').value = p.category;
document.getElementById('product-price').value = p.price;
      document.getElementById('product-cost').value = p.cost;
      document.getElementById('product-stock').value = p.stock;
      document.getElementById('product-minstock').value = p.minStock || 0;
      document.getElementById('product-modal-title').textContent = 'تعديل منتج';
    } else {
      document.getElementById('product-id').value = '';
      document.getElementById('product-name').value = '';
      document.getElementById('product-name-en').value = '';
      document.getElementById('product-model-description').value = '';
      document.getElementById('product-manufacturer').value = '';
      document.getElementById('product-available-sizes').value = '';
      document.getElementById('product-barcode').value = BarcodeUtil.generateEAN13();
      document.getElementById('product-category').innerHTML = catOptions;
      if (categoryId) document.getElementById('product-category').value = categoryId;
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
    // محفوظ للتوافق مع النسخ القديمة من الواجهة؛ الربح يحسب من سعر البيع والجملة.
  },

  saveProduct() {
    const id = document.getElementById('product-id').value;
    const data = {
      name: document.getElementById('product-name').value.trim(),
      nameEn: document.getElementById('product-name-en').value.trim(),
      modelDescription: document.getElementById('product-model-description').value.trim(),
      manufacturer: document.getElementById('product-manufacturer').value.trim(),
      availableSizes: document.getElementById('product-available-sizes').value.trim(),
      barcode: document.getElementById('product-barcode').value.trim(),
category: document.getElementById('product-category').value,
      oldPrice: parseFloat(document.getElementById('product-price').value) || 0,
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
      this.renderStockProductOptions();
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
    container.innerHTML = sales.slice(0, 30).map(s => `
      <div class="sale-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid var(--border); flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="sale-id" style="font-weight:700; color:var(--primary);">${s.id}</span>
          <span class="sale-date" style="font-size:12px; color:var(--muted);">${new Date(s.date).toLocaleString('ar-EG')}</span>
          <span class="sale-items" style="font-size:12px;"><span class="badge" style="background:#f1f5f9; color:#475569;">${s.items.reduce((sum, i) => sum + i.qty, 0)} قطعة</span></span>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="sale-total" style="font-weight:800; color:var(--dark); font-size:15px;">${s.total} ${settings.currency}</span>
          <button class="btn btn-sm btn-outline" onclick="App.reprintSale('${s.id}')" title="طباعة الإيصال">🖨️ طباعة</button>
          <button class="btn btn-sm btn-danger" onclick="App.voidSale('${s.id}')" title="إلغاء واسترجاع الفاتورة">↩️ إلغاء</button>
        </div>
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

  // ---------- Analytics & AI Assistant ----------
  renderAnalytics(period = '30days') {
    AnalyticsManager.currentPeriod = period;
    const metrics = AnalyticsManager.getMetrics(period);
    const settings = Store.getSettings();
    const currency = settings.currency || 'EGP';

    // 1. KPI Cards
    const revEl = document.getElementById('kpi-revenue');
    if (revEl) revEl.textContent = `${metrics.totalRevenue.toLocaleString()} ${currency}`;

    const profitEl = document.getElementById('kpi-profit');
    if (profitEl) profitEl.textContent = `${metrics.totalProfit.toLocaleString()} ${currency}`;

    const marginEl = document.getElementById('kpi-profit-margin');
    if (marginEl) marginEl.textContent = `${metrics.profitMargin.toFixed(1)}%`;

    const avgOrderEl = document.getElementById('kpi-avg-order');
    if (avgOrderEl) avgOrderEl.textContent = `${Math.round(metrics.avgOrderValue)} ${currency}`;

    const totalItemsEl = document.getElementById('kpi-total-items');
    if (totalItemsEl) totalItemsEl.textContent = `${metrics.totalItems} قطعة`;

    const totalTxEl = document.getElementById('kpi-total-transactions');
    if (totalTxEl) totalTxEl.textContent = `${metrics.totalOrders}`;

    const ordersCountEl = document.getElementById('kpi-orders-count');
    if (ordersCountEl) ordersCountEl.textContent = `${metrics.totalOrders} فاتورة مسجلة`;

    const marginTextEl = document.getElementById('kpi-margin-text');
    if (marginTextEl) marginTextEl.textContent = `هامش ربح: ${metrics.profitMargin.toFixed(1)}%`;

    const avgItemsEl = document.getElementById('kpi-avg-items');
    if (avgItemsEl) avgItemsEl.textContent = `${metrics.avgItemsPerOrder.toFixed(1)} قطعة لكل طلب`;

    // 2. Charts
    AnalyticsManager.renderCharts(period);

    // 3. Products Table
    const tbody = document.getElementById('analytics-products-tbody');
    if (tbody) {
      if (metrics.topProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 30px; color: var(--muted);">لا توجد مبيعات مسجلة في هذه الفترة</td></tr>';
      } else {
        tbody.innerHTML = metrics.topProducts.map((p, idx) => {
          const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : '0';
          return `
            <tr>
              <td style="color:var(--muted);">${idx + 1}</td>
              <td><strong>${p.name}</strong>${p.nameEn ? '<br><small style="color:var(--muted);">' + p.nameEn + '</small>' : ''}</td>
              <td><span class="badge" style="background:#e2e8f0; color:#334155;">${p.qty} قطعة</span></td>
              <td style="font-weight:600; color:var(--primary);">${p.revenue.toLocaleString()} ${currency}</td>
              <td>${p.cost.toLocaleString()} ${currency}</td>
              <td style="font-weight:600; color:var(--success);">${p.profit.toLocaleString()} ${currency}</td>
              <td><span class="badge" style="background:#dcfce7; color:#15803d;">${margin}%</span></td>
            </tr>
          `;
        }).join('');
      }
    }

    // 4. Monthly products, wholesale cost, selling price and net profit
    const monthlyTbody = document.getElementById('analytics-monthly-summary-tbody');
    if (monthlyTbody) {
      const monthlySummary = AnalyticsManager.getMonthlySummary(period);
      monthlyTbody.innerHTML = monthlySummary.length === 0
        ? '<tr><td colspan="5" class="text-center" style="padding: 30px; color: var(--muted);">لا توجد منتجات مباعة في الفترة المحددة</td></tr>'
        : monthlySummary.map(month => `
          <tr>
            <td><strong>${month.label}</strong></td>
            <td><span class="badge" style="background:#e2e8f0; color:#334155;">${month.quantity} قطعة</span></td>
            <td>${month.wholesale.toLocaleString()} ${currency}</td>
            <td style="font-weight:600; color:var(--primary);">${month.sales.toLocaleString()} ${currency}</td>
            <td style="font-weight:700; color:${month.profit >= 0 ? 'var(--success)' : 'var(--danger)'};">${month.profit.toLocaleString()} ${currency}</td>
          </tr>
        `).join('');
    }
  },

  renderAIAssistant() {
    AIAssistant.initChat();
    const periodSelect = document.getElementById('ai-period-select');
    const period = periodSelect ? periodSelect.value : '30days';
    this.renderAIExecutiveReport(period);
  },

  renderAIExecutiveReport(period = '30days') {
    const container = document.getElementById('ai-executive-report-content');
    if (!container) return;

    const insights = AIAssistant.generateInsights(period);
    const m = insights.metrics;
    const curr = insights.currency;

    container.innerHTML = `
      <!-- Summary Box -->
      <div style="background: var(--light); padding: 14px; border-radius: 10px; border: 1px solid var(--border); margin-bottom: 15px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-weight:700; color:var(--dark); font-size:14px;">📌 ملخص أداء (${insights.periodName}):</span>
          <span class="badge" style="background:#dbeafe; color:#1d4ed8;">${m.totalOrders} طلب</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
          <div>💰 <strong>الإيرادات:</strong> <span style="color:var(--primary); font-weight:bold;">${m.totalRevenue.toLocaleString()} ${curr}</span></div>
          <div>📈 <strong>صافي الأرباح:</strong> <span style="color:var(--success); font-weight:bold;">${m.totalProfit.toLocaleString()} ${curr}</span></div>
          <div>📊 <strong>هامش الربح:</strong> <span style="font-weight:bold;">${m.profitMargin.toFixed(1)}%</span></div>
          <div>🛒 <strong>متوسط الطلب:</strong> <span style="font-weight:bold;">${Math.round(m.avgOrderValue)} ${curr}</span></div>
        </div>
      </div>

      <!-- Star Product Card -->
      ${insights.starProduct ? `
      <div style="background: #fefce8; border: 1px solid #fef08a; padding: 12px; border-radius: 10px; margin-bottom: 15px;">
        <div style="font-weight:700; color:#854d0e; margin-bottom:4px; font-size:13px;">
          🌟 الحصان الرابح (الأكثر مساهمة في الأرباح):
        </div>
        <div style="font-size:13px; color:#713f12;">
          المنتج <strong>"${insights.starProduct.name}"</strong> حقق أرباحاً قدرها <strong>${insights.starProduct.profit.toLocaleString()} ${curr}</strong> من بيع <strong>${insights.starProduct.qty}</strong> قطعة.
        </div>
      </div>
      ` : ''}

      <!-- Low Stock Warnings -->
      ${insights.lowStockCount > 0 ? `
      <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 12px; border-radius: 10px; margin-bottom: 15px;">
        <div style="font-weight:700; color:#9f1239; margin-bottom:6px; font-size:13px;">
          ⚠️ تنبيه نواقص المخزون (${insights.lowStockCount} منتجات):
        </div>
        <div style="font-size:12.5px; color:#881337; line-height: 1.6;">
          ${insights.lowStockList.map(p => `• <strong>${p.name}</strong> (المتبقي: ${p.stock} قطعة)`).join('<br>')}
        </div>
      </div>
      ` : ''}

      <!-- AI Actionable Recommendations -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 10px;">
        <div style="font-weight:700; color:#166534; margin-bottom:8px; font-size:13.5px;">
          🎯 توصيات الذكاء الاصطناعي لزيادة المبيعات:
        </div>
        <div style="font-size:13px; color:#14532d; line-height: 1.6;">
          ${insights.recommendations.map(r => `<div style="margin-bottom:8px;">${r}</div>`).join('')}
        </div>
      </div>
    `;
  },

  // ---------- Excel Import & Template ----------
  pendingImportProducts: [],

  mapExcelRow(row) {
    const result = {
      name: '',
      nameEn: '',
      modelDescription: '',
      manufacturer: '',
      availableSizes: '',
      barcode: '',
      category: '',
      oldPrice: 0,
      price: 0,
      cost: 0,
      stock: 0,
      minStock: 0
    };

    for (let key in row) {
      if (!row.hasOwnProperty(key)) continue;
      const rawVal = row[key];
      if (rawVal === undefined || rawVal === null) continue;
      const valStr = String(rawVal).trim();
      const normKey = key.trim().toLowerCase().replace(/[\s_\-\(\)\[\]\:\.\/]+/g, '');

      // الأعمدة المطلوبة في ملف المنتجات: A الصنف، B وصف الموديل، C اسم المصنع...
      if (normKey === 'الصنف' || normKey === 'اسم' || normKey === 'name' || normKey === 'product') {
        result.name = valStr;
      } else if (normKey === 'وصفالموديل' || normKey === 'وصفالموديل' || normKey === 'modeldescription' || normKey === 'description') {
        result.modelDescription = valStr;
      } else if (normKey === 'اسمالمصنع' || normKey === 'المصنع' || normKey === 'manufacturer' || normKey === 'factory') {
        result.manufacturer = valStr;
      } else if (normKey === 'المقاساتالمتاحة' || normKey === 'المقاسات' || normKey === 'availablesizes' || normKey === 'sizes' || normKey === 'size') {
        result.availableSizes = valStr;
      }

      // English Name
      if (
        normKey.includes('english') || normKey.includes('انجليز') ||
        ((normKey === 'nameen' || normKey === 'enname' || normKey === 'englishname') || (normKey.includes('en') && (normKey.startsWith('name') || normKey.startsWith('اسم'))))
      ) {
        result.nameEn = valStr;
      }
      // Arabic / Main Name
      else if (
        /^(الاسم|اسمالمنتج|اسمالصنف|الصنف|السلعة|المنتج|البيان|اسمالمادة|name|product|itemname|productname|title|description)$/i.test(normKey) ||
        (normKey.includes('اسم') && !normKey.includes('شراء') && !normKey.includes('مورد') && !normKey.includes('قسم')) ||
        normKey === 'product' || normKey === 'item'
      ) {
        if (!result.name) result.name = valStr;
      }

      // Barcode / Code
      if (
        /^(الباركود|باركود|الكود|كود|رقمالباركود|كودالصنف|كودالمنتج|barcode|code|ean|ean13|sku|upc)$/i.test(normKey) ||
        normKey.includes('باركود') || normKey.includes('barcode')
      ) {
        let b = valStr.replace(/\.0+$/, '');
        result.barcode = b;
      }

      // Category
      if (
        /^(القسم|قسم|الفئة|فئة|التصنيف|تصنيف|المجموعة|مجموعة|category|cat|department|group|categoryname)$/i.test(normKey) ||
        normKey.includes('قسم') || normKey.includes('فئة') || normKey.includes('تصنيف') || normKey.includes('مجموع')
      ) {
        result.category = valStr;
      }

      // Old Price
      if (
        /^(السعرقبلالخصم|السعرالاصلي|السعرالأصلي|السعرالقديم|السعرقبل|سعرقبلالخصم|oldprice|originalprice|listprice|regularprice)$/i.test(normKey) ||
        normKey.includes('قبلالخصم') || normKey.includes('قديم') || normKey.includes('اصلي') || normKey.includes('أصلي')
      ) {
        result.oldPrice = parseFloat(valStr) || 0;
      }

      // Price / Sale Price
      if (
        /^(سعرالبيع|السعر|سعرالبيعبعدالخصم|السعربعدالخصم|سعرالقطاعي|السعرالحالي|سعروالمستهلك|سعرالمنتج|price|saleprice|sellingprice|unitprice|retailprice)$/i.test(normKey) ||
        (normKey.includes('بيع') && !normKey.includes('عدد')) || normKey === 'السعر' || normKey === 'سعر' || normKey === 'price'
      ) {
        result.price = parseFloat(valStr) || 0;
      }

      // الأعمدة القياسية الجديدة لها أولوية واضحة: D سعر الجملة، E سعر البيع
      if (normKey === 'سعرالجملة' || normKey === 'wholesaleprice') result.cost = parseFloat(valStr) || 0;
      if (normKey === 'سعرالبيع' || normKey === 'sellingprice') result.price = parseFloat(valStr) || 0;

      // Cost Price
      if (
        /^(سعرالشراء|سعرالتكلفة|التكلفة|سعرالجملة|سعرالتوريد|cost|costprice|buyprice|purchaseprice|wholesaleprice)$/i.test(normKey) ||
        normKey.includes('شراء') || normKey.includes('تكلفة') || normKey.includes('توريد') || (normKey.includes('جملة') && !normKey.includes('عدد')) || normKey.includes('cost')
      ) {
        result.cost = parseFloat(valStr) || 0;
      }

      // Stock
      if (
        /^(المخزون|الكمية|الكميةبالمخزون|الكميةالمتوفرة|العدد|الرصيد|رصيدالمخزن|stock|qty|quantity|count|units|balance)$/i.test(normKey) ||
        (normKey.includes('مخزون') && !normKey.includes('ادنى') && !normKey.includes('أدنى')) ||
        (normKey.includes('كمية') && !normKey.includes('ادنى') && !normKey.includes('أدنى')) ||
        normKey === 'stock' || normKey === 'qty'
      ) {
        result.stock = parseInt(valStr, 10) || 0;
      }

      // Min Stock
      if (
        /^(الحدالادنى|الحدالأدنى|الحدالادنىللمخزون|الحدالأدنىللمخزون|حدالطلب|نقطةإعادةالطلب|minstock|minqty|minimumstock|reorderlevel)$/i.test(normKey) ||
        normKey.includes('ادنى') || normKey.includes('أدنى') || normKey.includes('طلب') || normKey.includes('minstock')
      ) {
        result.minStock = parseInt(valStr, 10) || 0;
      }
    }

    // دمج العمودين A و B داخل اسم المنتج كما هو مطلوب:
    // A = الصنف + B = وصف الموديل
    if (result.modelDescription && result.name) {
      result.name = result.name + ' - ' + result.modelDescription;
    } else if (!result.name && result.modelDescription) {
      result.name = result.modelDescription;
    }

    if (result.price > 0 && result.oldPrice === 0) {
      result.oldPrice = result.price;
    } else if (result.oldPrice > 0 && result.price === 0) {
      result.price = result.oldPrice;
    }

    return result;
  },

  handleExcelFile(file) {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة قراءة Excel غير محملة. يرجى التأكد من الاتصال بالإنترنت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          alert('الملف فارغ ولا يحتوي على صفحات عمل.');
          return;
        }

        const requiredHeaders = ['الصنف', 'وصف الموديل', 'اسم المصنع', 'سعر الجملة', 'سعر البيع', 'الربح', 'المخزون', 'سعر الجملة *العدد', 'سعر البيع*العدد', 'الربح*العدد', 'المقاسات المتاحة'];
        const parsedProducts = [];
        let totalRows = 0;

        // قراءة كل أوراق العمل، وليس الورقة الأولى فقط.
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
          if (!matrix || matrix.length === 0) return;
          totalRows += matrix.length;

          const firstRow = matrix[0] || [];
          const hasHeaders = firstRow.some(value => requiredHeaders.indexOf(String(value).trim()) !== -1);
          const rawRows = (hasHeaders ? matrix.slice(1) : matrix).map(values => {
            const row = {};
            requiredHeaders.forEach((header, index) => { row[header] = values[index] === undefined ? '' : values[index]; });
            return row;
          });

          // اسم ورقة العمل يصبح القسم الافتراضي لمنتجاتها، ويمكن تغييره بفاصل داخل الورقة.
          let currentCategory = String(sheetName).trim() || 'عام';
          rawRows.forEach(row => {
            const values = requiredHeaders.map(header => row[header] === undefined ? '' : row[header]);
            const nonEmptyValues = values.filter(value => String(value).trim() !== '');
            const numericProductValues = [values[3], values[4], values[5], values[6], values[7], values[8], values[9]]
              .filter(value => String(value).trim() !== '' && !isNaN(parseFloat(value))).length;
            const firstValue = String(values[0] || '').trim();

            // صف الفاصل الذي يحتوي على اسم فقط يحدد القسم ولا يتم استيراده كمنتج.
            if (firstValue && nonEmptyValues.length === 1 && numericProductValues === 0) {
              currentCategory = firstValue;
              return;
            }

            const item = this.mapExcelRow(row);
            // استيراد المنتجات فقط وتجاهل الصفوف الفارغة والعناوين والإجماليات.
            if (item.name && item.name.trim().length > 0 && numericProductValues > 0) {
              item.category = currentCategory;
              parsedProducts.push(item);
            }
          });
        });

        if (totalRows === 0) {
          alert('لم يتم العثور على أي صفوف أو بيانات داخل الملف.');
          return;
        }

        if (parsedProducts.length === 0) {
          alert('لم يتم العثور على منتجات صالحة في الملف.\nيرجى التأكد من أن الملف يحتوي على عمود يحمل اسم المنتج (مثل "اسم المنتج" أو "Name").');
          return;
        }

        this.pendingImportProducts = parsedProducts;
        this.openExcelModal(parsedProducts);
      } catch (err) {
        console.error('Error reading Excel file:', err);
        alert('حدث خطأ أثناء قراءة ملف Excel: ' + (err.message || err));
      }
    };
    reader.readAsArrayBuffer(file);
  },

  openExcelModal(items) {
    const modal = document.getElementById('excel-modal');
    const summary = document.getElementById('excel-summary');
    const tbody = document.getElementById('excel-preview-tbody');
    const settings = Store.getSettings();

    summary.innerHTML = `
      <div style="font-size:15px; font-weight:600; color:var(--success); margin-bottom:4px;">
        ✔️ تم قراءة الملف بنجاح!
      </div>
      <div>تم العثور على <strong>${items.length}</strong> منتج جاهز للاستيراد. راجع المعاينة أدناه ثم اضغط على "تأكيد وحفظ المنتجات".</div>
    `;

    tbody.innerHTML = items.map((p, idx) => `
      <tr>
        <td style="color:var(--muted);">${idx + 1}</td>
        <td><strong>${p.name}</strong>${ProductsManager.getSizes(p).length ? `<br><small style="color:var(--primary);">المقاسات: ${ProductsManager.getSizes(p).join('، ')}</small>` : ''}</td>
        <td><small style="color:var(--muted);">${p.nameEn || '—'}</small></td>
        <td><span class="badge" style="background:#e0f2fe;color:#0369a1;">${p.category || 'عام'}</span></td>
        <td style="font-weight:600; color:var(--primary);">${p.price} ${settings.currency}</td>
        <td>${p.cost} ${settings.currency}</td>
        <td>${p.stock}</td>
        <td><code style="font-size:11px; color:#475569;">${p.barcode || '✨ توليد تلقائي'}</code></td>
      </tr>
    `).join('');

    modal.classList.add('open');
  },

  closeExcelModal() {
    const modal = document.getElementById('excel-modal');
    modal.classList.remove('open');
    this.pendingImportProducts = [];
    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) fileInput.value = '';
  },

  confirmExcelImport() {
    if (!this.pendingImportProducts || this.pendingImportProducts.length === 0) {
      alert('لا توجد منتجات معلقة للاستيراد.');
      return;
    }

    const modeRadio = document.querySelector('input[name="excel-import-mode"]:checked');
    const mode = modeRadio ? modeRadio.value : 'merge';

    if (mode === 'replace') {
      if (!confirm('⚠️ تنبيه هام: اختيار "استبدال الكل" سيقوم بحذف جميع المنتجات الحالية واستبدالها بمحتوى الملف.\nهل أنت متأكد من الاستمرار؟')) {
        return;
      }
    }

    const result = ProductsManager.importProducts(this.pendingImportProducts, mode);
    this.closeExcelModal();

    this.renderCategories();
    this.renderProductTable();
    this.renderProducts();
    this.renderDashboard();
    this.renderPrintList();

    if (result.updated > 0) {
      this.showToast(`تم استيراد ${result.added} منتج جديد وتحديث ${result.updated} منتج بنجاح!`);
    } else {
      this.showToast(`تم استيراد ${result.added} منتج بنجاح!`);
    }
  },

  downloadExcelTemplate() {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة Excel غير متوفرة.');
      return;
    }

    const sampleData = [
      {
        'الصنف': 'تي شيرت أطفال',
        'وصف الموديل': 'قطن نصف كم',
        'اسم المصنع': 'مصنع الفارس',
        'سعر الجملة': 90,
        'سعر البيع': 150,
        'الربح': 60,
        'المخزون': 35,
        'سعر الجملة *العدد': 3150,
        'سعر البيع*العدد': 5250,
        'الربح*العدد': 2100,
        'المقاسات المتاحة': '4، 6، 8، 10'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws['!rtl'] = true;
    ws['!views'] = [{ rightToLeft: true }];
    ws['!cols'] = [
      { wch: 30 }, { wch: 35 }, { wch: 25 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 22 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المنتجات");
    XLSX.writeFile(wb, "نموذج_استيراد_منتجات_الفارس.xlsx");
    this.showToast('تم تحميل نموذج ملف Excel بنجاح');
  },

  // ---------- System Utilities & Top Bar ----------
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      this.showToast('تم تفعيل وضع ملء الشاشة');
    } else {
      document.exitFullscreen().catch(() => {});
      this.showToast('تم الخروج من وضع ملء الشاشة');
    }
  },

  toggleSound() {
    SoundEffects.enabled = !SoundEffects.enabled;
    localStorage.setItem('sound_enabled', SoundEffects.enabled);
    if (SoundEffects.enabled) SoundEffects.beep();
    this.updateSoundButtonUI();
    this.showToast(SoundEffects.enabled ? 'تم تفعيل المؤثرات الصوتية 🔊' : 'تم كتم المؤثرات الصوتية 🔇');
  },

  updateSoundButtonUI() {
    const btn = document.getElementById('sound-btn');
    if (btn) {
      btn.textContent = SoundEffects.enabled ? '🔊 صوت: مفعل' : '🔇 صوت: معطل';
    }
    const chk = document.getElementById('setting-sound-enabled');
    if (chk) chk.checked = SoundEffects.enabled;
  },

  downloadBackup() {
    const data = {
      version: '1.2',
      timestamp: new Date().toISOString(),
      products: ProductsManager.findAll(),
      categories: ProductsManager.getCategories(),
      sales: SalesManager.getAllSales(),
      settings: Store.getSettings()
    };
    const json = JSON.stringify(data, null, 2);
    const fileName = `نسخة_احتياطية_الفارس_${new Date().toISOString().split('T')[0]}.json`;
    // Web version with a connected data file: save into it so the next load
    // reconnects fast instead of re-picking the file every visit.
    if (!window.nativeStore && window.showSaveFilePicker) {
      window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      }).then(async handle => {
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        if (window.browserFlush) await window.browserFlush.attach(handle);
        this.showToast('تم حفظ النسخة الاحتياطية وربطها بالبرنامج بنجاح 💾');
      }).catch(() => {});
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('تم تحميل النسخة الاحتياطية بنجاح 💾');
  },

  // ---------- Settings Modal ----------
  openSettingsModal() {
    const settings = Store.getSettings();
    document.getElementById('setting-shop-name').value = settings.shopName || '';
    document.getElementById('setting-shop-name-en').value = settings.shopNameEn || '';
    document.getElementById('setting-shop-phone').value = settings.phone || '';
    document.getElementById('setting-currency').value = settings.currency || 'EGP';
    document.getElementById('setting-shop-address').value = settings.address || '';
    document.getElementById('setting-receipt-footer').value = settings.receiptFooter || 'شكراً لزيارتكم - نسعد بخدمتكم دائماً';
    document.getElementById('setting-sound-enabled').checked = SoundEffects.enabled;
    document.getElementById('settings-modal').classList.add('open');
  },

  closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('open');
  },

  saveSettings() {
    const newSettings = {
      shopName: document.getElementById('setting-shop-name').value.trim() || 'الفارس لمستلزمات السباحة و احذية الاطفال',
      shopNameEn: document.getElementById('setting-shop-name-en').value.trim() || 'Al-Fares Swimming & Kids Shoes',
      phone: document.getElementById('setting-shop-phone').value.trim() || '010 28007300',
      currency: document.getElementById('setting-currency').value.trim() || 'EGP',
      address: document.getElementById('setting-shop-address').value.trim() || 'سنتر اللؤلؤة, Obour',
      receiptFooter: document.getElementById('setting-receipt-footer').value.trim() || 'شكراً لزيارتكم - نسعد بخدمتكم دائماً'
    };
    SoundEffects.enabled = document.getElementById('setting-sound-enabled').checked;
    localStorage.setItem('sound_enabled', SoundEffects.enabled);
    this.updateSoundButtonUI();

    Store.saveSettings(newSettings);
    this.closeSettingsModal();
    this.renderProducts();
    this.renderCart();
    this.renderProductTable();
    this.renderSalesHistory();
    this.showToast('تم حفظ إعدادات المتجر بنجاح ⚙️');
  },

  // ---------- Categories Management ----------
  openCategoriesModal() {
    this.renderCategoriesManageTable();
    document.getElementById('new-category-name').value = '';
    document.getElementById('new-category-name-en').value = '';
    document.getElementById('categories-modal').classList.add('open');
  },

  closeCategoriesModal() {
    document.getElementById('categories-modal').classList.remove('open');
    this.renderCategories();
    this.renderProductTable();
  },

  renderCategoriesManageTable() {
    const tbody = document.getElementById('categories-manage-tbody');
    if (!tbody) return;
    const cats = ProductsManager.getCategories();
    const products = ProductsManager.findAll();

    tbody.innerHTML = cats.map((cat, idx) => {
      const pCount = products.filter(p => p.category === cat.id).length;
      return `
        <tr>
          <td style="color:var(--muted);">${idx + 1}</td>
          <td><strong>${cat.name}</strong></td>
          <td><small style="color:var(--muted);">${cat.nameEn || '—'}</small></td>
          <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${pCount} منتج</span></td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="App.editCategoryInline('${cat.id}')">✏️ تعديل</button>
            <button class="btn btn-sm btn-danger" onclick="App.deleteCategory('${cat.id}')">🗑️ حذف</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  saveNewCategory() {
    const name = document.getElementById('new-category-name').value.trim();
    const nameEn = document.getElementById('new-category-name-en').value.trim();
    if (!name) {
      alert('يرجى كتابة اسم القسم باللغة العربية');
      return;
    }
    ProductsManager.addCategory(name, nameEn);
    document.getElementById('new-category-name').value = '';
    document.getElementById('new-category-name-en').value = '';
    this.renderCategoriesManageTable();
    this.renderCategories();
    this.renderProductTable();
    this.showToast(`تم إضافة قسم "${name}" بنجاح`);
  },

  editCategoryInline(catId) {
    const cat = ProductsManager.getCategories().find(c => c.id === catId);
    if (!cat) return;
    const newName = prompt('تعديل اسم القسم (عربي):', cat.name);
    if (newName && newName.trim()) {
      const newNameEn = prompt('تعديل اسم القسم (English):', cat.nameEn || '') || '';
      ProductsManager.updateCategory(catId, newName.trim(), newNameEn.trim());
      this.renderCategoriesManageTable();
      this.renderCategories();
      this.renderProductTable();
      this.showToast('تم تحديث القسم بنجاح');
    }
  },

  deleteCategory(catId) {
    const cat = ProductsManager.getCategories().find(c => c.id === catId);
    if (!cat) return;
    if (confirm(`هل أنت متأكد من حذف قسم "${cat.name}"؟\nسيتم نقل أي منتجات بداخله إلى قسم "عام".`)) {
      ProductsManager.deleteCategory(catId);
      this.renderCategoriesManageTable();
      this.renderCategories();
      this.renderProductTable();
      this.showToast('تم حذف القسم بنجاح');
    }
  },

  // ---------- Held Carts (تعليق السلة) ----------
  holdCurrentCart() {
    if (SalesManager.cart.length === 0) {
      alert('السلة فارغة، لا يوجد ما يمكن تعليقه.');
      return;
    }
    const note = prompt('ملاحظة للفاتورة المعلقة (اختياري - مثل اسم العميل):');
    const held = SalesManager.holdCurrentCart(note);
    if (held) {
      SoundEffects.beep();
      this.renderCart();
      this.updateHeldCountBadge();
      this.showToast(`تم تعليق الفاتورة #${held.id}`);
    }
  },

  openHeldCartsModal() {
    const list = document.getElementById('held-carts-list');
    const heldCarts = SalesManager.getHeldCarts();
    const settings = Store.getSettings();

    if (heldCarts.length === 0) {
      list.innerHTML = '<div class="empty" style="padding:30px 10px;">لا توجد فواتير معلقة حالياً</div>';
    } else {
      list.innerHTML = heldCarts.map(h => `
        <div class="held-cart-item">
          <div class="held-cart-info">
            <h4>${h.note} <small style="color:var(--primary); font-size:12px;">(${h.id})</small></h4>
            <small>${new Date(h.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} • ${h.items.reduce((s, i) => s + i.qty, 0)} قطعة • <strong>${h.total} ${settings.currency}</strong></small>
          </div>
          <div class="held-cart-actions">
            <button class="btn btn-sm btn-primary" onclick="App.restoreHeldCart('${h.id}')">↩️ استرجاع للسلة</button>
            <button class="btn btn-sm btn-danger" onclick="App.deleteHeldCart('${h.id}')">🗑️</button>
          </div>
        </div>
      `).join('');
    }
    document.getElementById('held-carts-modal').classList.add('open');
  },

  closeHeldCartsModal() {
    document.getElementById('held-carts-modal').classList.remove('open');
  },

  restoreHeldCart(heldId) {
    if (SalesManager.cart.length > 0) {
      if (!confirm('توجد منتجات حالية في السلة، هل تريد استبدالها بالفاتورة المعلقة؟')) {
        return;
      }
    }
    const restored = SalesManager.restoreHeldCart(heldId);
    if (restored) {
      SoundEffects.click();
      this.closeHeldCartsModal();
      this.renderCart();
      this.updateHeldCountBadge();
      this.showToast(`تم استرجاع الفاتورة المعلقة #${restored.id} إلى السلة`);
    }
  },

  deleteHeldCart(heldId) {
    if (confirm('هل أنت متأكد من حذف هذه الفاتورة المعلقة؟')) {
      SalesManager.deleteHeldCart(heldId);
      this.updateHeldCountBadge();
      this.openHeldCartsModal();
      this.showToast('تم حذف الفاتورة المعلقة');
    }
  },

  updateHeldCountBadge() {
    const badge = document.getElementById('held-count');
    if (badge) {
      const count = SalesManager.getHeldCarts().length;
      badge.textContent = count;
      badge.style.color = count > 0 ? 'var(--danger)' : 'inherit';
    }
  },

  clearCart() {
    if (SalesManager.cart.length === 0) return;
    if (confirm('هل أنت متأكد من تفريغ السلة بالكامل؟')) {
      SalesManager.clearCart();
      SoundEffects.click();
      this.renderCart();
      this.showToast('تم تفريغ السلة');
    }
  },

  // ---------- Product Manager Filter ----------
  filterProductManager(query) {
    const q = (query || '').trim().toLowerCase();
    const rows = document.querySelectorAll('.category-tbody tr');
    let visibleCount = 0;

    rows.forEach(tr => {
      const text = tr.innerText.toLowerCase();
      const match = !q || text.includes(q);
      tr.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });

    // Hide empty category sections
    document.querySelectorAll('.category-section').forEach(sec => {
      const visibleRows = sec.querySelectorAll('.category-tbody tr:not([style*="display: none"])');
      sec.style.display = (visibleRows.length > 0 || !q) ? '' : 'none';
    });
  },

  // ---------- Thermal Receipt Modal ----------
  openReceiptModal(sale) {
    if (!sale) return;
    this.currentReceiptSale = sale;
    const settings = Store.getSettings();
    const currency = settings.currency || 'EGP';

    document.getElementById('receipt-shop-name').textContent = settings.shopName || 'الفارس لمستلزمات السباحة';
    document.getElementById('receipt-shop-en').textContent = settings.shopNameEn || 'Al-Fares Swimming & Kids Shoes';
    document.getElementById('receipt-shop-address').textContent = settings.address || '';
    document.getElementById('receipt-shop-phone').textContent = settings.phone ? 'هاتف: ' + settings.phone : '';
    document.getElementById('receipt-id').textContent = sale.id;
    document.getElementById('receipt-date').textContent = new Date(sale.date).toLocaleString('ar-EG');

    // Customer metadata on receipt
    const custMeta = document.getElementById('receipt-customer-meta');
    if (custMeta) {
      if (sale.customerName || sale.customerPhone || sale.customerAddress) {
        custMeta.style.display = 'flex';
        document.getElementById('receipt-customer-name').textContent = sale.customerName || 'عميل نقدي';
        document.getElementById('receipt-customer-phone').textContent = sale.customerPhone || '—';
        const addrRow = document.getElementById('receipt-customer-address-row');
        if (addrRow) {
          addrRow.style.display = sale.customerAddress ? 'block' : 'none';
          if (sale.customerAddress) document.getElementById('receipt-customer-address').textContent = sale.customerAddress;
        }
      } else {
        custMeta.style.display = 'none';
      }
    }

    const tbody = document.getElementById('receipt-items-tbody');
    tbody.innerHTML = (sale.items || []).map(i => `
      <tr>
        <td>${i.name}</td>
        <td>${i.qty}</td>
        <td>${i.price}</td>
        <td>${i.total}</td>
      </tr>
    `).join('');

    document.getElementById('receipt-subtotal').textContent = `${sale.subtotal || sale.total} ${currency}`;
    const discRow = document.getElementById('receipt-discount-row');
    if (sale.discount > 0) {
      discRow.style.display = 'flex';
      document.getElementById('receipt-discount').textContent = `-${sale.discount} ${currency}`;
    } else {
      discRow.style.display = 'none';
    }
    const shippingRow = document.getElementById('receipt-shipping-row');
    if (sale.shipping > 0) {
      shippingRow.style.display = 'flex';
      document.getElementById('receipt-shipping').textContent = `${sale.shipping} ${currency}`;
    } else {
      shippingRow.style.display = 'none';
    }
    document.getElementById('receipt-total').textContent = `${sale.total} ${currency}`;
    document.getElementById('receipt-paid').textContent = `${sale.paid || sale.total} ${currency}`;
    document.getElementById('receipt-change').textContent = `${sale.change || 0} ${currency}`;
    document.getElementById('receipt-footer-text').textContent = settings.receiptFooter || 'شكراً لزيارتكم - نسعد بخدمتكم دائماً';

    // Render receipt barcode
    const barcodeEl = document.getElementById('receipt-barcode-svg');
    if (barcodeEl) {
      BarcodeUtil.render(barcodeEl, sale.id, { height: 28, fontSize: 10, width: 1.2 });
    }

    document.getElementById('receipt-modal').classList.add('open');
  },

  closeReceiptModal() {
    document.getElementById('receipt-modal').classList.remove('open');
    this.currentReceiptSale = null;
  },

  reprintSale(saleId) {
    const sale = SalesManager.getAllSales().find(s => s.id === saleId);
    if (sale) {
      this.openReceiptModal(sale);
    } else {
      alert('لم يتم العثور على الفاتورة');
    }
  },

  voidSale(saleId) {
    const sale = SalesManager.getAllSales().find(s => s.id === saleId);
    if (!sale) return;
    if (confirm(`هل أنت متأكد من إلغاء واسترجاع الفاتورة #${sale.id} بمبلغ ${sale.total} EGP؟\nسيتم إرجاع كميات المنتجات المباعة إلى المخزون.`)) {
      SalesManager.voidSale(saleId);
      SoundEffects.error();
      this.renderProducts();
      this.renderProductTable();
      this.renderDashboard();
      this.renderSalesHistory();
      this.renderDetailedSales();
      if (this.currentView === 'analytics') this.renderAnalytics(AnalyticsManager.currentPeriod);
      if (this.currentView === 'ai') this.renderAIExecutiveReport(AIAssistant.currentPeriod);
      this.showToast(`تم إلغاء واسترجاع الفاتورة #${saleId} وإعادة المخزون`);
    }
  },

  // ---------- Customer CRM & Leaderboard ----------
  renderCustomers() {
    const metrics = CustomersManager.getMetrics();
    const settings = Store.getSettings();
    const currency = settings.currency || 'EGP';

    // 1. KPI Cards
    const totalEl = document.getElementById('cust-kpi-total');
    if (totalEl) totalEl.textContent = `${metrics.totalCustomers} عميل`;

    const repeatEl = document.getElementById('cust-kpi-repeat');
    if (repeatEl) repeatEl.textContent = `${metrics.repeatRate}% نسبة تكرار الشراء (${metrics.repeatCustomers} عميل)`;

    const vipCount = CustomersManager.findAll().filter(c => (c.totalSpent || 0) >= 1000).length;
    const vipEl = document.getElementById('cust-kpi-vip');
    if (vipEl) vipEl.textContent = `${vipCount} عميل`;

    const revEl = document.getElementById('cust-kpi-revenue');
    if (revEl) revEl.textContent = `${metrics.totalSpent.toLocaleString()} ${currency}`;

    const avgEl = document.getElementById('cust-kpi-avg');
    if (avgEl) avgEl.textContent = `${Math.round(metrics.avgSpent)} ${currency}`;

    // 2. Dropdown Selector
    const dropdown = document.getElementById('customer-dropdown-select');
    if (dropdown) {
      const customers = CustomersManager.getLeaderboard();
      dropdown.innerHTML = '<option value="">-- اختر عميلاً من القائمة لاستعراض ملفه --</option>' +
        customers.map(c => `<option value="${c.id}">${c.name} (${c.phone || 'بدون هاتف'}) - ${c.totalSpent.toLocaleString()} ${currency}</option>`).join('');
    }

    // 3. Leaderboard Table
    this.renderLeaderboardTable();
    const selected = document.getElementById('customer-dropdown-select')?.value;
    if (selected) this.renderCustomerInvoices(selected);
  },

  renderLeaderboardTable(filterQuery = '') {
    const tbody = document.getElementById('customers-leaderboard-tbody');
    if (!tbody) return;
    const settings = Store.getSettings();
    const currency = settings.currency || 'EGP';

    let leaderboard = CustomersManager.getLeaderboard();
    const q = (filterQuery || '').trim().toLowerCase();
    if (q) {
      leaderboard = leaderboard.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
      );
    }

    if (leaderboard.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:30px; color:var(--muted);">لا يوجد عملاء مسجلين حالياً</td></tr>';
      return;
    }

    tbody.innerHTML = leaderboard.map(c => {
      let rankHtml = `<span class="rank-pill">${c.rankBadge}</span>`;
      if (c.rank === 1) rankHtml = `<span class="rank-pill rank-1">${c.rankBadge}</span>`;
      else if (c.rank === 2) rankHtml = `<span class="rank-pill rank-2">${c.rankBadge}</span>`;
      else if (c.rank === 3) rankHtml = `<span class="rank-pill rank-3">${c.rankBadge}</span>`;

      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      const waLink = cleanPhone ? `https://wa.me/2${cleanPhone}` : '#';

      return `
        <tr>
          <td>${rankHtml}</td>
          <td><strong class="customer-name-link" onclick="App.inspectCustomer('${c.id}')">${c.name}</strong></td>
          <td>${c.phone ? `<code>${c.phone}</code>` : '<span style="color:var(--muted);">—</span>'}</td>
          <td><span class="badge ${c.tier.class}">${c.tier.label}</span></td>
          <td><span class="badge" style="background:#f1f5f9; color:#475569;">${c.ordersCount || 1} فواتير</span></td>
          <td style="font-weight:700; color:var(--primary);">${c.totalSpent.toLocaleString()} ${currency}</td>
          <td><small style="color:var(--muted);">${new Date(c.lastVisit).toLocaleDateString('ar-EG')}</small></td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="App.inspectCustomer('${c.id}')" title="استعراض الملف">👤 عرض</button>
            ${cleanPhone ? `<a href="${waLink}" target="_blank" class="btn btn-sm btn-success" style="text-decoration:none;" title="مراسلة واتساب">💬 واتساب</a>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  filterCustomersLeaderboard(query) {
    this.renderLeaderboardTable(query);
  },

  inspectCustomer(customerId) {
    if (!customerId) {
      document.getElementById('customer-profile-box').style.display = 'none';
      return;
    }
    const c = CustomersManager.findById(customerId);
    if (!c) return;

    const settings = Store.getSettings();
    const currency = settings.currency || 'EGP';
    const tier = CustomersManager.getTier(c.totalSpent);

    document.getElementById('cp-name').textContent = c.name;
    document.getElementById('cp-phone').textContent = c.phone || 'بدون رقم هاتف';
    const tierEl = document.getElementById('cp-tier');
    tierEl.textContent = tier.label;
    tierEl.className = `badge ${tier.class}`;

    document.getElementById('cp-orders').textContent = `${c.ordersCount || 1} فاتورة`;
    document.getElementById('cp-total').textContent = `${c.totalSpent.toLocaleString()} ${currency}`;
    document.getElementById('cp-last-visit').textContent = new Date(c.lastVisit).toLocaleString('ar-EG');

    const cleanPhone = (c.phone || '').replace(/\D/g, '');
    const waBtn = document.getElementById('cp-whatsapp-btn');
    if (cleanPhone) {
      waBtn.style.display = 'inline-flex';
      waBtn.href = `https://wa.me/2${cleanPhone}`;
    } else {
      waBtn.style.display = 'none';
    }

    this.renderCustomerInvoices(customerId);
    const box = document.getElementById('customer-profile-box');
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Sync dropdown value
    const dropdown = document.getElementById('customer-dropdown-select');
    if (dropdown) dropdown.value = customerId;
  },

  renderCustomerInvoices(customerId) {
    const container = document.getElementById('customer-invoices-list');
    const summary = document.getElementById('customer-invoices-summary');
    if (!container) return;
    const customer = CustomersManager.findById(customerId);
    const sales = customer ? SalesManager.getAllSales().filter(s => {
      const samePhone = customer.phone && s.customerPhone && customer.phone.replace(/\s+/g, '') === s.customerPhone.replace(/\s+/g, '');
      const sameName = customer.name && s.customerName && customer.name.trim().toLowerCase() === s.customerName.trim().toLowerCase();
      return samePhone || sameName;
    }) : [];
    const currency = Store.getSettings().currency || 'EGP';
    if (!customer) {
      summary.textContent = 'اختر عميلاً لعرض فواتيره';
      container.innerHTML = '<div class="empty">اضغط على اسم العميل أو زر «عرض» لعرض فواتيره</div>';
      return;
    }
    summary.textContent = `${sales.length} فاتورة • ${customer.name}`;
    container.innerHTML = sales.length ? sales.map(s => `
      <div class="customer-invoice-row">
        <div><strong class="invoice-id">${s.id}</strong><small>${new Date(s.date).toLocaleString('ar-EG')}</small><span>${(s.items || []).reduce((sum, i) => sum + (i.qty || 0), 0)} قطعة</span></div>
        <div><strong class="invoice-total">${s.total} ${currency}</strong><button class="btn btn-sm btn-outline" onclick="App.openSaleEditModal('${s.id}')">✏️ تعديل</button><button class="btn btn-sm btn-outline" onclick="App.reprintSale('${s.id}')">🖨️ طباعة</button></div>
      </div>`).join('') : '<div class="empty">لا توجد فواتير مرتبطة بهذا العميل</div>';
  },

  openSaleEditModal(saleId) {
    const sale = SalesManager.getAllSales().find(s => s.id === saleId);
    if (!sale) return;
    document.getElementById('edit-sale-id').value = sale.id;
    document.getElementById('edit-sale-customer-name').value = sale.customerName || '';
    document.getElementById('edit-sale-customer-phone').value = sale.customerPhone || '';
    document.getElementById('edit-sale-product-serial').value = '';
    document.getElementById('edit-sale-product-serial').removeAttribute('data-replace-index');
    this.renderSaleProductSuggestions('');
    document.getElementById('edit-sale-discount').value = sale.discount || 0;
    document.getElementById('edit-sale-shipping').value = sale.shipping || 0;
    document.getElementById('edit-sale-paid').value = sale.paid || sale.total || 0;
    document.getElementById('edit-sale-payment').value = sale.payment || 'cash';
    this.renderSaleEditItems(sale.items || []);
    document.getElementById('sale-edit-modal').classList.add('open');
    this.updateSaleEditPreview();
  },

  addProductToSaleBySerial() {
    const input = document.getElementById('edit-sale-product-serial');
    const serial = (input?.value || '').trim();
    if (!serial) { this.showToast('اكتب اسم أو سيريال أو باركود المنتج أولاً', true); return; }
    const exactProduct = ProductsManager.findById(serial) || ProductsManager.findByBarcode(serial);
    const matchingStockProducts = ProductsManager.search(serial).filter(item => (Number(item.stock) || 0) > 0);
    const product = exactProduct || matchingStockProducts[0];
    if (exactProduct && (Number(exactProduct.stock) || 0) <= 0) {
      this.showToast('المنتج موجود لكنه غير متوفر في المخزون حالياً', true);
      return;
    }
    if (!product) { this.showToast('لم يتم العثور على منتج متوفر بهذا الاسم أو السيريال أو الباركود', true); return; }
    if (!exactProduct && matchingStockProducts.length > 1) {
      this.showToast('يوجد أكثر من منتج متوفر بهذا البحث؛ اكتب الاسم بشكل أدق', true);
      return;
    }
    const sale = SalesManager.getAllSales().find(s => s.id === document.getElementById('edit-sale-id').value);
    if (!sale) return;
    const currentItems = this.getSaleEditItems();
    const replacementIndex = input.dataset.replaceIndex;
    const replacementItem = { productId: product.id, name: product.name, nameEn: product.nameEn || '', barcode: product.barcode || '', oldPrice: product.price, price: product.price, qty: 1, total: product.price };
    if (replacementIndex !== undefined && currentItems[Number(replacementIndex)]) {
      currentItems[Number(replacementIndex)] = replacementItem;
      delete input.dataset.replaceIndex;
    } else {
      const existing = currentItems.find(item => item.productId === product.id);
      if (existing) {
        existing.qty += 1;
        existing.total = existing.qty * existing.price;
      } else currentItems.push(replacementItem);
    }
    this.renderSaleEditItems(currentItems);
    input.value = '';
    this.renderSaleProductSuggestions('');
    this.updateSaleEditPreview();
  },

  renderSaleProductSuggestions(query) {
    const container = document.getElementById('edit-sale-product-suggestions');
    if (!container) return;
    const value = (query || '').trim();
    if (!value) { container.innerHTML = ''; return; }
    const matches = ProductsManager.search(value).filter(item => (Number(item.stock) || 0) > 0).slice(0, 8);
    container.innerHTML = matches.length ? matches.map(item => `<button type="button" class="edit-sale-product-suggestion" data-product-id="${item.id}"><strong>${item.name}</strong><small>${item.nameEn || ''} • المخزون: ${item.stock} • السعر: ${item.price}</small></button>`).join('') : '<div class="edit-sale-no-suggestions">لا توجد منتجات متوفرة بهذا البحث</div>';
    container.querySelectorAll('.edit-sale-product-suggestion').forEach(button => button.addEventListener('click', () => {
      const product = ProductsManager.findById(button.dataset.productId);
      if (!product) return;
      const input = document.getElementById('edit-sale-product-serial');
      input.value = product.id;
      this.renderSaleProductSuggestions('');
      this.addProductToSaleBySerial();
    }));
  },

  renderSaleEditItems(items) {
    document.getElementById('edit-sale-items-tbody').innerHTML = items.map((item, index) => `
      <tr data-product-id="${item.productId}"><td>${item.name}<br><small class="barcode-cell">السيريال: ${item.productId} | الباركود: ${item.barcode || '—'}</small></td><td><input class="edit-item-qty" data-index="${index}" type="number" min="1" value="${item.qty || 1}"></td><td><input class="edit-item-price" data-index="${index}" type="number" min="0" step="0.01" value="${item.price || 0}"></td><td class="edit-item-total" data-index="${index}">${((item.qty || 0) * (item.price || 0)).toFixed(2)}</td><td><button type="button" class="btn btn-sm btn-outline edit-remove-item" data-index="${index}">🗑️ إزالة</button><button type="button" class="btn btn-sm btn-outline edit-replace-item" data-index="${index}">🔄 تبديل</button></td></tr>`).join('');
    document.querySelectorAll('.edit-remove-item').forEach(button => button.addEventListener('click', () => this.removeSaleEditItem(Number(button.dataset.index))));
    document.querySelectorAll('.edit-replace-item').forEach(button => button.addEventListener('click', () => this.prepareSaleItemReplacement(Number(button.dataset.index))));
    document.querySelectorAll('#edit-sale-items-tbody input').forEach(input => input.addEventListener('input', () => this.updateSaleEditPreview()));
  },

  closeSaleEditModal() {
    document.getElementById('sale-edit-modal').classList.remove('open');
  },

  removeSaleEditItem(index) {
    const items = this.getSaleEditItems();
    if (!items[index]) return;
    if (!confirm(`هل تريد إزالة ${items[index].name} كـ ${document.getElementById('edit-sale-change-type').value === 'return' ? 'مرتجع' : 'تبديل'}؟`)) return;
    items.splice(index, 1);
    this.renderSaleEditItems(items);
    this.updateSaleEditPreview();
  },

  prepareSaleItemReplacement(index) {
    const items = this.getSaleEditItems();
    if (!items[index]) return;
    document.getElementById('edit-sale-change-type').value = 'exchange';
    const input = document.getElementById('edit-sale-product-serial');
    input.dataset.replaceIndex = index;
    input.focus();
    this.showToast('اكتب سيريال أو باركود المنتج البديل ثم اضغط إضافة');
  },

  getSaleEditItems() {
    const sale = SalesManager.getAllSales().find(s => s.id === document.getElementById('edit-sale-id').value);
    if (!sale) return [];
    return Array.from(document.querySelectorAll('#edit-sale-items-tbody tr')).map((row, index) => {
      const productId = row.dataset.productId;
      const oldItem = (sale.items || []).find(item => item.productId === productId) || {};
      const product = ProductsManager.findById(productId) || {};
      const qty = Math.max(1, parseInt(row.querySelector('.edit-item-qty')?.value, 10) || 1);
      const price = Math.max(0, parseFloat(row.querySelector('.edit-item-price')?.value) || 0);
      return { ...oldItem, productId, name: oldItem.name || product.name, nameEn: oldItem.nameEn || product.nameEn || '', barcode: oldItem.barcode || product.barcode || '', oldPrice: oldItem.oldPrice || price, price, qty, total: qty * price };
    });
  },

  updateSaleEditPreview() {
    const items = this.getSaleEditItems();
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discount = Math.min(subtotal, Math.max(0, parseFloat(document.getElementById('edit-sale-discount')?.value) || 0));
    const shipping = Math.max(0, parseFloat(document.getElementById('edit-sale-shipping')?.value) || 0);
    const total = subtotal - discount + shipping;
    const paid = Math.max(0, parseFloat(document.getElementById('edit-sale-paid')?.value) || 0);
    document.querySelectorAll('.edit-item-total').forEach((el, index) => { if (items[index]) el.textContent = items[index].total.toFixed(2); });
    const preview = document.getElementById('edit-sale-total-preview');
    if (preview) preview.textContent = `المجموع: ${subtotal.toFixed(2)} • الخصم: ${discount.toFixed(2)} • الشحن: ${shipping.toFixed(2)} • الصافي: ${total.toFixed(2)} • الباقي: ${Math.max(0, paid - total).toFixed(2)} ${Store.getSettings().currency || 'EGP'}`;
  },

  saveSaleEdit() {
    const saleId = document.getElementById('edit-sale-id').value;
    const items = this.getSaleEditItems();
    const discount = parseFloat(document.getElementById('edit-sale-discount').value) || 0;
    const shipping = Math.max(0, parseFloat(document.getElementById('edit-sale-shipping').value) || 0);
    const paid = parseFloat(document.getElementById('edit-sale-paid').value) || 0;
    const sale = SalesManager.getAllSales().find(s => s.id === saleId);
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    if (discount > subtotal || paid < subtotal - discount + shipping) { alert('راجع الخصم والشحن والمبلغ المدفوع؛ المبلغ المدفوع يجب أن يغطي صافي الفاتورة.'); return; }
    const changeType = document.getElementById('edit-sale-change-type').value;
    const updated = SalesManager.updateSale(saleId, { items, discount, shipping, paid, changeType, payment: document.getElementById('edit-sale-payment').value, customerName: document.getElementById('edit-sale-customer-name').value, customerPhone: document.getElementById('edit-sale-customer-phone').value });
    if (!updated) { alert('لا يمكن حفظ التعديل: الكمية الجديدة أكبر من المخزون المتاح.'); return; }
    this.closeSaleEditModal();
    this.renderProducts(); this.renderProductTable(); this.renderSalesHistory(); this.renderDetailedSales(); this.renderCustomers();
    const updatedCustomer = CustomersManager.findByName(updated.customerName) || CustomersManager.findByPhone(updated.customerPhone);
    this.inspectCustomer(updatedCustomer?.id || '');
    this.showToast(`تم تعديل الفاتورة ${sale ? sale.id : ''} كـ ${changeType === 'return' ? 'مرتجع' : 'تبديل'} وتحديث المخزون والتقارير`);
  },

  // ---------- Exports ----------
  exportAnalyticsToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة Excel غير متوفرة.');
      return;
    }
    const metrics = AnalyticsManager.getMetrics(AnalyticsManager.currentPeriod);
    const settings = Store.getSettings();
    const currency = settings.currency || 'EGP';

    const summaryData = [
      { 'المؤشر': 'الفترة الزمنية', 'القيمة': AIAssistant.getPeriodLabel(AnalyticsManager.currentPeriod) },
      { 'المؤشر': 'إجمالي الإيرادات', 'القيمة': `${metrics.totalRevenue} ${currency}` },
      { 'المؤشر': 'صافي الأرباح', 'القيمة': `${metrics.totalProfit} ${currency}` },
      { 'المؤشر': 'هامش الربح %', 'القيمة': `${metrics.profitMargin.toFixed(1)}%` },
      { 'المؤشر': 'عدد الفواتير والعمليات', 'القيمة': metrics.totalOrders },
      { 'المؤشر': 'إجمالي القطع المباعة', 'القيمة': metrics.totalItems },
      { 'المؤشر': 'متوسط قيمة الفاتورة', 'القيمة': `${Math.round(metrics.avgOrderValue)} ${currency}` }
    ];

    const productsData = metrics.topProducts.map((p, idx) => ({
      '#': idx + 1,
      'المنتج': p.name,
      'الكمية المباعة': p.qty,
      'الإيرادات': p.revenue,
      'التكلفة': p.cost,
      'صافي الربح': p.profit,
      'هامش الربح %': p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : 0
    }));

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsProducts = XLSX.utils.json_to_sheet(productsData);

    XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص المؤشرات");
    XLSX.utils.book_append_sheet(wb, wsProducts, "أداء المنتجات");

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `تقرير_تحليلات_المبيعات_${dateStr}.xlsx`);
    this.showToast('تم تصدير تقرير التحليلات إلى Excel 📊');
  },

  exportAIReport() {
    const insights = AIAssistant.generateInsights(AIAssistant.currentPeriod);
    const m = insights.metrics;
    const curr = insights.currency;

    let text = `📊 تقرير المحلل التجاري الذكي - متجر الفارس\n`;
    text += `الفترة: ${insights.periodName}\n`;
    text += `التاريخ: ${new Date().toLocaleString('ar-EG')}\n`;
    text += `-----------------------------------------\n`;
    text += `💰 إجمالي الإيرادات: ${m.totalRevenue.toLocaleString()} ${curr}\n`;
    text += `📈 صافي الأرباح: ${m.totalProfit.toLocaleString()} ${curr}\n`;
    text += `📊 هامش الربح: ${m.profitMargin.toFixed(1)}%\n`;
    text += `🧾 عدد الفواتير: ${m.totalOrders}\n`;
    text += `🛒 متوسط الفاتورة: ${Math.round(m.avgOrderValue)} ${curr}\n`;
    text += `-----------------------------------------\n`;
    if (insights.starProduct) {
      text += `🌟 الحصان الرابح: ${insights.starProduct.name} (أرباح: ${insights.starProduct.profit} ${curr})\n`;
    }
    if (insights.lowStockCount > 0) {
      text += `⚠️ نواقص المخزون: ${insights.lowStockList.map(p => p.name + ' (' + p.stock + ' قطعة)').join('، ')}\n`;
    }
    text += `-----------------------------------------\n`;
    text += `🎯 توصيات الذكاء الاصطناعي:\n`;
    insights.recommendations.forEach((r, idx) => {
      text += `${idx + 1}. ${r.replace(/<[^>]+>/g, '')}\n`;
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('تم نسخ التقرير الذكي إلى الحافظة 📋');
      });
    } else {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `تقرير_الذكاء_الاصطناعي_${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      this.showToast('تم تحميل التقرير الذكي بنجاح');
    }
  },

  showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + (isError ? 'error' : '');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
};

// Initialize when DOM is ready
window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
