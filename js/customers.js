// Customers CRM & Leaderboard Manager
const CustomersManager = {
  private: {
    customers: []
  },

  load() {
    this.private.customers = Store.getCustomers() || [];
    return this.private.customers;
  },

  findAll() {
    return [...this.private.customers];
  },

  findById(id) {
    return this.private.customers.find(c => c.id === id);
  },

  findByPhone(phone) {
    if (!phone) return null;
    const cleanPhone = String(phone).replace(/\s+/g, '');
    return this.private.customers.find(c => c.phone && c.phone.replace(/\s+/g, '') === cleanPhone);
  },

  findByName(name) {
    if (!name) return null;
    const cleanName = String(name).trim().toLowerCase();
    return this.private.customers.find(c => c.name && c.name.trim().toLowerCase() === cleanName);
  },

  addOrUpdate(name, phone, saleAmount = 0, invoiceId = null) {
    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    if (!cleanName && !cleanPhone) return null;

    let customer = null;
    if (cleanPhone) {
      customer = this.findByPhone(cleanPhone);
    }
    if (!customer && cleanName) {
      customer = this.findByName(cleanName);
    }

    const now = new Date().toISOString();
    const amount = parseFloat(saleAmount) || 0;

    if (customer) {
      customer.ordersCount = (customer.ordersCount || 0) + 1;
      customer.totalSpent = (customer.totalSpent || 0) + amount;
      customer.lastVisit = now;
      if (cleanName && !customer.name) customer.name = cleanName;
      if (cleanPhone && !customer.phone) customer.phone = cleanPhone;
      if (invoiceId && !customer.invoices.includes(invoiceId)) {
        customer.invoices.push(invoiceId);
      }
    } else {
      customer = {
        id: 'cust_' + Date.now() + Math.floor(Math.random() * 1000),
        name: cleanName || 'عميل نقدي',
        phone: cleanPhone || '',
        totalSpent: amount,
        ordersCount: 1,
        firstVisit: now,
        lastVisit: now,
        invoices: invoiceId ? [invoiceId] : []
      };
      this.private.customers.push(customer);
    }

    Store.saveCustomers(this.private.customers);
    return customer;
  },

  rebuildFromSales(sales) {
    const previous = this.private.customers || [];
    const byKey = {};
    (sales || []).forEach(sale => {
      const name = (sale.customerName || '').trim();
      const phone = (sale.customerPhone || '').trim();
      if (!name && !phone) return;
      const key = phone.replace(/\s+/g, '') || name.toLowerCase();
      if (!byKey[key]) {
        const old = previous.find(c => (phone && c.phone && c.phone.replace(/\s+/g, '') === phone.replace(/\s+/g, '')) || (name && c.name && c.name.toLowerCase() === name.toLowerCase()));
        byKey[key] = { id: old?.id || ('cust_' + Date.now() + Math.floor(Math.random() * 1000)), name: name || old?.name || 'عميل', phone: phone || old?.phone || '', totalSpent: 0, ordersCount: 0, firstVisit: old?.firstVisit || sale.date, lastVisit: sale.date, invoices: [] };
      }
      const customer = byKey[key];
      customer.totalSpent += parseFloat(sale.total) || 0;
      customer.ordersCount += 1;
      customer.lastVisit = new Date(customer.lastVisit) > new Date(sale.date) ? customer.lastVisit : sale.date;
      if (!customer.invoices.includes(sale.id)) customer.invoices.push(sale.id);
    });
    this.private.customers = Object.values(byKey);
    Store.saveCustomers(this.private.customers);
    return this.private.customers;
  },

  getTier(totalSpent) {
    const val = parseFloat(totalSpent) || 0;
    if (val >= 5000) return { label: '💎 VIP ماسي', class: 'tier-diamond' };
    if (val >= 2500) return { label: '🥇 عميل ذهبي', class: 'tier-gold' };
    if (val >= 1000) return { label: '🥈 عميل فضي', class: 'tier-silver' };
    return { label: '🥉 عميل برونزي', class: 'tier-bronze' };
  },

  getLeaderboard(limit = 100) {
    const sorted = [...this.private.customers].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
    return sorted.slice(0, limit).map((c, index) => {
      let rankBadge = `${index + 1}`;
      if (index === 0) rankBadge = '🥇 الأول';
      else if (index === 1) rankBadge = '🥈 الثاني';
      else if (index === 2) rankBadge = '🥉 الثالث';

      return {
        ...c,
        rank: index + 1,
        rankBadge,
        tier: this.getTier(c.totalSpent)
      };
    });
  },

  getMetrics() {
    const customers = this.private.customers || [];
    const totalCustomers = customers.length;
    let totalSpent = 0;
    let repeatCustomers = 0;

    customers.forEach(c => {
      totalSpent += (c.totalSpent || 0);
      if (c.ordersCount > 1) repeatCustomers += 1;
    });

    const avgSpent = totalCustomers > 0 ? (totalSpent / totalCustomers) : 0;
    const topCustomer = customers.length > 0 ? [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0] : null;

    return {
      totalCustomers,
      totalSpent,
      avgSpent,
      repeatCustomers,
      repeatRate: totalCustomers > 0 ? ((repeatCustomers / totalCustomers) * 100).toFixed(1) : 0,
      topCustomer
    };
  },

  exportToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة Excel غير متوفرة.');
      return;
    }
    const leaderboard = this.getLeaderboard();
    const settings = Store.getSettings();
    const currency = settings.currency || 'EGP';

    const rows = leaderboard.map(c => ({
      'الترتيب': c.rank,
      'اسم العميل': c.name,
      'رقم الهاتف': c.phone || '—',
      'فئة العميل': c.tier.label,
      'عدد الفواتير': c.ordersCount || 1,
      'إجمالي المشتريات': c.totalSpent,
      'متوسط الفاتورة': c.ordersCount > 0 ? Math.round(c.totalSpent / c.ordersCount) : c.totalSpent,
      'تاريخ آخر زيارة': new Date(c.lastVisit).toLocaleDateString('ar-EG'),
      'العملة': currency
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },  // رتبة
      { wch: 25 }, // اسم
      { wch: 16 }, // هاتف
      { wch: 16 }, // فئة
      { wch: 14 }, // فواتير
      { wch: 16 }, // اجمالي
      { wch: 14 }, // متوسط
      { wch: 16 }, // اخر زيارة
      { wch: 10 }  // عملة
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ليدربورد_العملاء");
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `ليدربورد_بيانات_العملاء_الفارس_${dateStr}.xlsx`);
  }
};

window.CustomersManager = CustomersManager;
