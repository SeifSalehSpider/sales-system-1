// Sales Analytics Engine & Chart Visualizations
const AnalyticsManager = {
  currentPeriod: '30days',
  charts: {},

  getStartDateForPeriod(period) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'today':
        return startOfToday;
      case '7days':
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30days':
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '3months':
      case '90days':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '6months':
      case '180days':
        return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      case 'year':
      case '365days':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      case 'all':
      default:
        return new Date(0); // All time
    }
  },

  getFilteredSales(period = this.currentPeriod) {
    const allSales = SalesManager.getAllSales() || [];
    const startDate = this.getStartDateForPeriod(period);
    return allSales.filter(s => new Date(s.date) >= startDate);
  },

  getMetrics(period = this.currentPeriod) {
    const sales = this.getFilteredSales(period);
    const settings = Store.getSettings();
    let totalRevenue = 0;
    let totalCost = 0;
    let totalItems = 0;
    const productStats = {};

    sales.forEach(sale => {
      totalRevenue += (sale.total || 0);
      (sale.items || []).forEach(item => {
        const p = ProductsManager.findById(item.productId);
        const unitCost = p ? (parseFloat(p.cost) || 0) : 0;
        const qty = item.qty || 1;
        const itemRev = item.total || (item.price * qty);
        const itemCost = unitCost * qty;
        
        totalCost += itemCost;
        totalItems += qty;

        if (!productStats[item.productId]) {
          productStats[item.productId] = {
            id: item.productId,
            name: item.name,
            nameEn: item.nameEn || '',
            category: p ? p.category : '',
            barcode: item.barcode || (p ? p.barcode : ''),
            qty: 0,
            revenue: 0,
            cost: 0,
            profit: 0
          };
        }
        productStats[item.productId].qty += qty;
        productStats[item.productId].revenue += itemRev;
        productStats[item.productId].cost += itemCost;
        productStats[item.productId].profit += (itemRev - itemCost);
      });
    });

    const totalProfit = Math.max(0, totalRevenue - totalCost);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const totalOrders = sales.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const avgItemsPerOrder = totalOrders > 0 ? totalItems / totalOrders : 0;

    const topProducts = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);

    return {
      period,
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin,
      totalOrders,
      totalItems,
      avgOrderValue,
      avgItemsPerOrder,
      productStats: Object.values(productStats),
      topProducts,
      salesCount: totalOrders,
      currency: settings.currency || 'EGP'
    };
  },

  getMonthlySummary(period = this.currentPeriod) {
    const startDate = this.getStartDateForPeriod(period);
    const entries = Store.getStockEntries().filter(entry => new Date(entry.date) >= startDate);
    const months = {};

    entries.forEach(entry => {
      const date = new Date(entry.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) {
        months[key] = {
          key,
          label: date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
          quantity: 0,
          wholesale: 0,
          sales: 0,
          profit: 0
        };
      }

      const qty = Number(entry.qty) || 0;
      const wholesaleTotal = (Number(entry.cost) || 0) * qty;
      const salesTotal = (Number(entry.price) || 0) * qty;
      months[key].quantity += qty;
      months[key].wholesale += wholesaleTotal;
      months[key].sales += salesTotal;
      months[key].profit += salesTotal - wholesaleTotal;
    });

    return Object.values(months).sort((a, b) => b.key.localeCompare(a.key));
  }
};

window.AnalyticsManager = AnalyticsManager;

// Methods for aggregating data and building charts
AnalyticsManager.getTimelineData = function(period = this.currentPeriod) {
  const sales = this.getFilteredSales(period);
  const now = new Date();
  const grouped = {};

  // Decide bucket type based on period
  const isHourly = (period === 'today');
  const isMonthly = (period === 'year' || period === 'all' || period === '6months');

  sales.forEach(s => {
    const d = new Date(s.date);
    let key;
    if (isHourly) {
      key = d.getHours() + ':00';
    } else if (isMonthly) {
      key = d.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
    } else {
      key = d.toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' });
    }

    if (!grouped[key]) {
      grouped[key] = { revenue: 0, profit: 0, count: 0, timestamp: d.getTime() };
    }
    grouped[key].revenue += (s.total || 0);
    grouped[key].count += 1;

    let cost = 0;
    (s.items || []).forEach(item => {
      const p = ProductsManager.findById(item.productId);
      const unitCost = p ? (parseFloat(p.cost) || 0) : 0;
      cost += unitCost * (item.qty || 1);
    });
    grouped[key].profit += Math.max(0, (s.total || 0) - cost);
  });

  const labels = Object.keys(grouped);
  const revenueData = labels.map(l => grouped[l].revenue);
  const profitData = labels.map(l => grouped[l].profit);

  return { labels, revenueData, profitData, count: labels.length };
};

AnalyticsManager.getCategoryData = function(period = this.currentPeriod) {
  const sales = this.getFilteredSales(period);
  const catMap = {};
  let totalRev = 0;

  sales.forEach(s => {
    (s.items || []).forEach(item => {
      const p = ProductsManager.findById(item.productId);
      const catId = p ? p.category : 'other';
      const catName = p ? ProductsManager.getCategoryName(catId) : 'أخرى';
      const rev = item.total || (item.price * (item.qty || 1));
      
      if (!catMap[catName]) {
        catMap[catName] = { name: catName, revenue: 0, qty: 0 };
      }
      catMap[catName].revenue += rev;
      catMap[catName].qty += (item.qty || 1);
      totalRev += rev;
    });
  });

  const categories = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);
  const labels = categories.map(c => c.name);
  const data = categories.map(c => c.revenue);
  const percentages = categories.map(c => totalRev > 0 ? ((c.revenue / totalRev) * 100).toFixed(1) : 0);

  return { labels, data, percentages, categories, totalRev };
};

AnalyticsManager.getHourlyAndWeekdayData = function(period = this.currentPeriod) {
  const sales = this.getFilteredSales(period);
  const weekdays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  const dayRevenues = [0, 0, 0, 0, 0, 0, 0];
  const hourCounts = Array(24).fill(0);

  sales.forEach(s => {
    const d = new Date(s.date);
    const day = d.getDay();
    const hour = d.getHours();
    dayCounts[day] += 1;
    dayRevenues[day] += (s.total || 0);
    hourCounts[hour] += 1;
  });

  // Find peak hour & peak day
  let maxDayIdx = 0;
  dayRevenues.forEach((rev, idx) => {
    if (rev > dayRevenues[maxDayIdx]) maxDayIdx = idx;
  });

  let maxHourIdx = 0;
  hourCounts.forEach((c, idx) => {
    if (c > hourCounts[maxHourIdx]) maxHourIdx = idx;
  });

  return {
    weekdays,
    dayRevenues,
    dayCounts,
    hourCounts,
    peakDay: weekdays[maxDayIdx],
    peakHour: `${maxHourIdx}:00 - ${maxHourIdx + 1}:00`
  };
};

AnalyticsManager.destroyCharts = function() {
  Object.keys(this.charts).forEach(key => {
    if (this.charts[key] && typeof this.charts[key].destroy === 'function') {
      this.charts[key].destroy();
      delete this.charts[key];
    }
  });
};

AnalyticsManager.renderCharts = function(period = this.currentPeriod) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js library is not loaded');
    return;
  }

  this.currentPeriod = period;
  this.destroyCharts();

  const settings = Store.getSettings();
  const currency = settings.currency || 'EGP';

  // 1. Timeline Chart (Sales & Profit)
  const timelineCanvas = document.getElementById('chart-timeline');
  if (timelineCanvas) {
    const timelineData = this.getTimelineData(period);
    this.charts.timeline = new Chart(timelineCanvas, {
      type: 'line',
      data: {
        labels: timelineData.labels.length > 0 ? timelineData.labels : ['لا توجد بيانات'],
        datasets: [
          {
            label: `إجمالي المبيعات (${currency})`,
            data: timelineData.revenueData.length > 0 ? timelineData.revenueData : [0],
            borderColor: '#0d6efd',
            backgroundColor: 'rgba(13, 110, 253, 0.12)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#0d6efd',
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3
          },
          {
            label: `صافي الأرباح (${currency})`,
            data: timelineData.profitData.length > 0 ? timelineData.profitData : [0],
            borderColor: '#198754',
            backgroundColor: 'rgba(25, 135, 84, 0.1)',
            borderWidth: 2,
            borderDash: [4, 4],
            fill: false,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 7,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#198754',
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 2200,
          easing: 'easeInOutQuart',
          delay(context) {
            if (context.type !== 'data' || context.mode) return 0;
            return context.dataIndex * 140 + context.datasetIndex * 260;
          }
        },
        animations: {
          y: {
            from: 0,
            duration: 1800,
            easing: 'easeOutQuart'
          },
          x: {
            duration: 1200,
            easing: 'easeOutQuart'
          },
          radius: {
            from: 0,
            duration: 900,
            easing: 'easeOutBack'
          }
        },
        transitions: {
          active: {
            animation: {
              duration: 250
            }
          },
          resize: {
            animation: {
              duration: 450
            }
          }
        },
        plugins: {
          legend: { position: 'top', rtl: true, labels: { font: { family: 'Cairo, Segoe UI' } } },
          tooltip: { rtl: true, textDirection: 'rtl' }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // 2. Categories Doughnut Chart
  const categoryCanvas = document.getElementById('chart-categories');
  if (categoryCanvas) {
    const catData = this.getCategoryData(period);
    const palette = ['#0d6efd', '#20c997', '#ffc107', '#fd7e14', '#6f42c1', '#d63384', '#6c757d', '#0dcaf0'];
    this.charts.categories = new Chart(categoryCanvas, {
      type: 'doughnut',
      data: {
        labels: catData.labels.length > 0 ? catData.labels : ['لا توجد مبيعات'],
        datasets: [{
          data: catData.data.length > 0 ? catData.data : [1],
          backgroundColor: catData.data.length > 0 ? palette.slice(0, catData.labels.length) : ['#e2e8f0'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', rtl: true, labels: { font: { family: 'Cairo, Segoe UI', size: 11 } } },
          tooltip: {
            rtl: true,
            callbacks: {
              label: function(ctx) {
                const label = ctx.label || '';
                const val = ctx.parsed || 0;
                return `${label}: ${val} ${currency}`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  // 3. Top Products Bar Chart
  const topProductsCanvas = document.getElementById('chart-top-products');
  if (topProductsCanvas) {
    const metrics = this.getMetrics(period);
    const top10 = metrics.topProducts.slice(0, 8);
    const labels = top10.map(p => p.name.length > 20 ? p.name.slice(0, 18) + '...' : p.name);
    const revenues = top10.map(p => p.revenue);
    const quantities = top10.map(p => p.qty);

    this.charts.topProducts = new Chart(topProductsCanvas, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['لا توجد بيانات'],
        datasets: [
          {
            label: `الإيراد (${currency})`,
            data: revenues.length > 0 ? revenues : [0],
            backgroundColor: '#0d6efd',
            borderRadius: 6
          },
          {
            label: 'القطع المباعة',
            data: quantities.length > 0 ? quantities : [0],
            backgroundColor: '#0dcaf0',
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', rtl: true, labels: { font: { family: 'Cairo, Segoe UI' } } },
          tooltip: { rtl: true }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  // 4. Peak Days / Hours Bar Chart
  const peakTimesCanvas = document.getElementById('chart-peak-times');
  if (peakTimesCanvas) {
    const peakData = this.getHourlyAndWeekdayData(period);
    this.charts.peakTimes = new Chart(peakTimesCanvas, {
      type: 'bar',
      data: {
        labels: peakData.weekdays,
        datasets: [{
          label: `مبيعات أيام الأسبوع (${currency})`,
          data: peakData.dayRevenues,
          backgroundColor: '#3b82f6',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { rtl: true }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
};
