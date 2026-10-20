// Al-Fares AI Sales Assistant & Analytical Model
const AIAssistant = {
  chatHistory: [],
  currentPeriod: '30days',

  normalizeDigits(value) {
    return String(value || '').replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit)).replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit));
  },

  formatMoney(value, currency) {
    return `${(Number(value) || 0).toLocaleString('ar-EG')} ${currency}`;
  },

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[character]));
  },

  getProductSizes(product) {
    if (typeof ProductsManager.getSizes === 'function') return ProductsManager.getSizes(product);
    return ProductsManager.parseSizes ? ProductsManager.parseSizes(product?.availableSizes) : [];
  },

  getPeriodLabel(period) {
    const labels = {
      'today': 'اليوم',
      '7days': 'آخر 7 أيام (أسبوعياً)',
      'week': 'آخر 7 أيام (أسبوعياً)',
      '30days': 'آخر 30 يوماً (شهرياً)',
      'month': 'آخر 30 يوماً (شهرياً)',
      '3months': 'آخر 3 شهور (90 يوماً)',
      '90days': 'آخر 3 شهور (90 يوماً)',
      '6months': 'آخر 6 شهور (180 يوماً)',
      '180days': 'آخر 6 شهور (180 يوماً)',
      'year': 'آخر سنة (365 يوماً)',
      '365days': 'آخر سنة (365 يوماً)',
      'all': 'كافة الفترات (منذ البداية)'
    };
    return labels[period] || 'الفترة المحددة';
  },

  // Generates automatic structured executive insights
  generateInsights(period = this.currentPeriod) {
    const metrics = AnalyticsManager.getMetrics(period);
    const safeMetrics = metrics || { totalRevenue: 0, totalCost: 0, totalProfit: 0, profitMargin: 0, totalOrders: 0, totalItems: 0, avgOrderValue: 0, productStats: [], topProducts: [] };
    const catData = AnalyticsManager.getCategoryData(period);
    const peakData = AnalyticsManager.getHourlyAndWeekdayData(period);
    const allProducts = ProductsManager.findAll() || [];
    const settings = Store.getSettings();
    const currency = settings.currency || 'EGP';
    const periodName = this.getPeriodLabel(period);

    // تنبيه المخزون المنخفض عند بقاء قطعة واحدة أو أقل.
    const lowStockAlerts = allProducts.filter(p => Number(p.stock) <= 1);

    // Identify slow moving items (products with 0 sales in period)
    const soldProductIds = new Set((safeMetrics.productStats || []).map(p => p.id));
    const slowMoving = allProducts.filter(p => !soldProductIds.has(p.id));

    // Top profitable product
    const topByProfit = [...(safeMetrics.productStats || [])].sort((a, b) => b.profit - a.profit);
    const starProduct = topByProfit.length > 0 ? topByProfit[0] : null;

    // Build recommendations
    const recommendations = [];
    if (lowStockAlerts.length > 0) {
      const topLow = lowStockAlerts.slice(0, 3).map(p => p.name).join('، ');
      recommendations.push(`⚠️ <strong>إعادة طلب مخزون عاجل:</strong> المنتجات (${topLow}) وصلت للحد الأدنى للمخزون ويجب توريدها فوراً لتجنب فقدان المبيعات.`);
    }
    if (starProduct && starProduct.profit > 0) {
      recommendations.push(`⭐ <strong>التركيز على الحصان الرابح:</strong> المنتج <strong>"${starProduct.name}"</strong> هو الأكثر ربحية بأرباح بلغت ${starProduct.profit.toLocaleString()} ${currency}، يُنصح بإبرازه في واجهة المحل أو عمل حملات ترويجية له.`);
    }
    if (slowMoving.length > 0) {
      recommendations.push(`🏷️ <strong>تصفية الرواكد:</strong> يوجد <strong>${slowMoving.length}</strong> منتج لم يتم بيع أي قطعة منها في هذه الفترة. يُنصح بعمل خصم ترويجي بنسبة 10-15% أو تضمينها في باقات (Bundle) لتنشيط حركتها.`);
    }
    if (safeMetrics.totalOrders > 0 && safeMetrics.avgOrderValue > 0) {
      recommendations.push(`🛒 <strong>زيادة متوسط الفاتورة:</strong> متوسط الفاتورة الحالي <strong>${Math.round(safeMetrics.avgOrderValue)} ${currency}</strong>. يمكنك رفعه بتدريب الكاشير على الـ Cross-selling واقتراح إكسسوارات سريعة عند الدفع.`);
    }
    if (recommendations.length === 0) {
      recommendations.push(`📈 <strong>المحافظة على وتيرة النمو:</strong> استمر في تسجيل الفواتير بانتظام لمتابعة الأنماط الشرائية وتقديم توصيات أكثر دقة.`);
    }

    return {
      periodName,
      metrics: safeMetrics,
      currency,
      catData,
      peakData,
      starProduct,
      lowStockCount: lowStockAlerts.length,
      lowStockList: lowStockAlerts.slice(0, 5),
      slowMovingCount: slowMoving.length,
      recommendations
    };
  }
};

window.AIAssistant = AIAssistant;

// Natural Language Processing & Response Generation Engine
AIAssistant.processQuery = function(rawQuery, period = this.currentPeriod) {
  const query = this.normalizeDigits(rawQuery).trim().toLowerCase();
  const settings = Store.getSettings();
  const currency = settings.currency || 'EGP';

  // Determine target period if mentioned in query
  let targetPeriod = period;
  if (/اليوم|النهارده|today/i.test(query)) {
    targetPeriod = 'today';
  } else if (/أسبوع|اسبوع|7 أيام|7 ايام|week/i.test(query)) {
    targetPeriod = '7days';
  } else if (/3 شهور|٣ شهور|ثلاثة شهور|3months|quarter/i.test(query)) {
    targetPeriod = '3months';
  } else if (/6 شهور|٦ شهور|نصف سنة|نص سنة|6months/i.test(query)) {
    targetPeriod = '6months';
  } else if (/سنة|سنوي|سنويا|عام|365|year/i.test(query)) {
    targetPeriod = 'year';
  } else if (/شهر|شهري|شهريا|30 يوم|month/i.test(query)) {
    targetPeriod = '30days';
  } else if (/الكل|كل الفترات|من البداية|all/i.test(query)) {
    targetPeriod = 'all';
  }

  const metrics = AnalyticsManager.getMetrics(targetPeriod) || {
    totalRevenue: 0, totalCost: 0, totalProfit: 0, profitMargin: 0,
    totalOrders: 0, totalItems: 0, avgOrderValue: 0,
    productStats: [], topProducts: []
  };
  const periodLabel = this.getPeriodLabel(targetPeriod);
  const allProducts = ProductsManager.findAll() || [];
  // تنبيه المخزون المنخفض عند بقاء قطعة واحدة أو أقل.
  const lowStock = allProducts.filter(p => Number(p.stock) <= 1);

  // 1. Greetings & Identity
  if (/^(مرحبا|أهلا|اهلا|سلام|مساء الخير|صباح الخير|ازيك|hi|hello|hey)/i.test(query)) {
    return `
      👋 <strong>أهلاً بك! أنا مساعدك التجاري الذكي (AI Sales Assistant).</strong><br><br>
      أنا هنا لمساعدتك في تحليل أداء متجرك ومبيعاتك والإجابة على أي استفسار مالي أو تسويقي.<br><br>
      💡 <strong>يمكنك سؤالي عن:</strong>
      <ul style="margin-top:6px; padding-right:20px;">
        <li>"كم مبيعات وأرباح اليوم أو هذا الشهر؟"</li>
        <li>"ما هي أكثر 5 منتجات مبيعاً وأكثرها ربحية؟"</li>
        <li>"ما هي البضاعة التي أوشكت على النفاد وتحتاج طلب؟"</li>
        <li>"قارن بين أداء الأقسام المختلفة ونسبها"</li>
        <li>"أفضل أوقات الذروة وأيام الأسبوع للبيع"</li>
        <li>"أعطني نصائح لزيادة الأرباح والمبيعات"</li>
      </ul>
    `;
  }

  // 2. Specific Product Lookup
  const matchedProducts = allProducts.filter(p => {
    const name = String(p.name || '').toLowerCase();
    const nameEn = String(p.nameEn || '').toLowerCase();
    const barcode = String(p.barcode || '');
    return (name && query.includes(name)) || (nameEn && query.includes(nameEn)) || (barcode && query.includes(barcode));
  });

  if (matchedProducts.length > 0 && matchedProducts.length <= 3) {
    const p = matchedProducts[0];
    const productSizes = this.getProductSizes(p);
    const stat = (metrics.productStats || []).find(s => s.id === p.id) || { qty: 0, revenue: 0, profit: 0 };
    return `
      📦 <strong>تقرير عن منتج: "${p.name}"</strong><br>
      <div style="background:var(--light); padding:10px; border-radius:8px; margin:8px 0; border:1px solid var(--border);">
        🔹 <strong>سعر البيع:</strong> ${p.price} ${currency} (السعر السابق: ${p.oldPrice || p.price} ${currency})<br>
        🔹 <strong>سعر التكلفة:</strong> ${p.cost || 0} ${currency}<br>
        🔹 <strong>الربح في القطعة:</strong> ${(p.price - (p.cost || 0))} ${currency}<br>
        🔹 <strong>المخزون الحالي:</strong> <span style="font-weight:bold; color:${Number(p.stock) <= 1 ? 'var(--danger)' : 'var(--success)'};">${p.stock} قطعة</span> (التنبيه عند بقاء قطعة واحدة أو أقل)<br>
        🔹 <strong>الباركود:</strong> <code>${p.barcode}</code><br>
        ${productSizes.length ? `🔹 <strong>المقاسات المتاحة:</strong> ${productSizes.join('، ')}<br>` : ''}
        🔹 <strong>المبيعات في فترة (${periodLabel}):</strong> تم بيع <strong>${stat.qty}</strong> قطعة بإجمالي <strong>${stat.revenue.toLocaleString()} ${currency}</strong> وأرباح <strong>${stat.profit.toLocaleString()} ${currency}</strong>.
      </div>
      ${Number(p.stock) <= 1 ? '⚠️ <strong>تنبيه:</strong> المخزون منخفض جداً! لم يتبقَّ سوى قطعة واحدة أو أقل، ويُفضل طلب دفعة جديدة من المورد الآن.' : '✔️ المخزون في حالة جيدة.'}
    `;
  }

  // 3. Inventory value and product count
  if (/قيمة المخزون|فلوس المخزن|رأس المال|عدد المنتجات|كام منتج|inventory value|stock value/i.test(query)) {
    const inventory = allProducts.reduce((summary, product) => {
      const stock = Number(product.stock) || 0;
      const cost = Number(product.cost) || 0;
      const price = Number(product.price) || 0;
      summary.items += stock;
      summary.cost += stock * cost;
      summary.retail += stock * price;
      return summary;
    }, { items: 0, cost: 0, retail: 0 });
    return `📦 <strong>ملخص المخزون الحالي:</strong><br>
      🔹 عدد الأصناف: <strong>${allProducts.length}</strong> منتج<br>
      🔹 إجمالي القطع: <strong>${inventory.items.toLocaleString('ar-EG')}</strong> قطعة<br>
      🔹 قيمة المخزون بسعر التكلفة: <strong>${this.formatMoney(inventory.cost, currency)}</strong><br>
      🔹 القيمة المتوقعة بسعر البيع: <strong>${this.formatMoney(inventory.retail, currency)}</strong><br>
      🔹 هامش الربح المتوقع للمخزون: <strong>${this.formatMoney(inventory.retail - inventory.cost, currency)}</strong>`;
  }

  // 4. Customers and repeat-purchase overview
  if (/العملاء|الزبائن|العملاء المميزين|vip|customer|customers/i.test(query)) {
    const customers = typeof CustomersManager !== 'undefined' ? (CustomersManager.findAll() || []) : [];
    const totalSpent = customers.reduce((sum, customer) => sum + (Number(customer.totalSpent) || 0), 0);
    const vip = customers.filter(customer => (Number(customer.totalSpent) || 0) >= 1000).length;
    const repeat = customers.filter(customer => (Number(customer.ordersCount) || 0) > 1).length;
    return `👥 <strong>ملخص العملاء:</strong><br>
      🔹 إجمالي العملاء: <strong>${customers.length}</strong><br>
      🔹 عملاء VIP (مشتريات 1000 أو أكثر): <strong>${vip}</strong><br>
      🔹 العملاء المتكررون: <strong>${repeat}</strong><br>
      🔹 إجمالي مشتريات العملاء المسجلة: <strong>${this.formatMoney(totalSpent, currency)}</strong>`;
  }

  // 5. Low Stock / Reorder Queries
  if (/نواقص|ناقص|مخزون|قرب يخلص|يخلص|خلص|أوشكت|اوشكت|نفاد|ينفد|حد ادنى|طلب بضاعة|إعادة طلب|اعادة طلب|توريد|low stock/i.test(query)) {
    if (lowStock.length === 0) {
      return `🎉 <strong>مستوى المخزون ممتاز!</strong> لا توجد أي منتجات وصلت لحد الطلب الأدنى حالياً. كل المنتجات متوفرة بكميات كافية.`;
    }
    const itemsList = lowStock.map((p, idx) => `
      <li><strong>${p.name}</strong>: المتبقي <span style="color:var(--danger); font-weight:bold;">${p.stock}</span> قطعة فقط (الحد الأدنى: ${p.minStock || 5}) - سعر التكلفة: ${p.cost} ${currency}</li>
    `).join('');
    return `
      ⚠️ <strong>تنبيهات المخزون والنواقص (يوجد ${lowStock.length} منتجات تحتاج إعادة طلب):</strong><br>
      <ul style="margin:8px 0; padding-right:20px;">${itemsList}</ul>
      💡 <strong>التوصية:</strong> بادر بتجهيز طلبية للموردين لتغطية هذه النواقص سريعاً لتفادي ضياع فرص بيع محتملة.
    `;
  }

  // 6. Profit & Margins Queries
  if (/أرباح|ارباح|ربح|مكسب|صافي|هامش|تكلفة|profit|margin/i.test(query) && !/أعلى|اكتر|أكثر|افضل|أفضل|توب|best|top|مبيع|منتجات/i.test(query)) {
    return `
      📈 <strong>تحليل الأرباح والهوامش لفترة (${periodLabel}):</strong><br>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:10px 0;">
        <div style="background:#e0f2fe; padding:10px; border-radius:8px;">
          <small>إجمالي الإيرادات</small><br>
          <strong style="font-size:16px; color:#0369a1;">${metrics.totalRevenue.toLocaleString()} ${currency}</strong>
        </div>
        <div style="background:#dcfce7; padding:10px; border-radius:8px;">
          <small>صافي الأرباح</small><br>
          <strong style="font-size:16px; color:#15803d;">${metrics.totalProfit.toLocaleString()} ${currency}</strong>
        </div>
      </div>
      🔹 <strong>إجمالي التكلفة التقديرية للبضاعة المباعة:</strong> ${metrics.totalCost.toLocaleString()} ${currency}<br>
      🔹 <strong>نسبة هامش الربح الإجمالي:</strong> <span class="badge" style="background:#dcfce7; color:#15803d; font-size:13px;">${metrics.profitMargin.toFixed(1)}%</span><br>
      🔹 <strong>متوسط الربح لكل فاتورة:</strong> ${metrics.totalOrders > 0 ? (metrics.totalProfit / metrics.totalOrders).toFixed(1) : 0} ${currency}<br><br>
      💡 <strong>التقييم التجاري:</strong> ${metrics.profitMargin >= 35 ? 'هوامش ربحية ممتازة جداً فوق المتوسط.' : 'هوامش مقبولة، ويمكن تحسينها عبر التركيز على المنتجات الأعلى ربحاً وتقليل الخصومات الكبيرة.'}
    `;
  }

  // 7. Top Selling Products
  if (/أعلى|اكتر|أكثر|افضل|أفضل|توب|best|top|ماشية|مبيع/i.test(query) && !/قسم|أقسام|مخزون|نواقص|نفاد|أوشكت|اعادة طلب|إعادة طلب/i.test(query)) {
    const top5 = (metrics.topProducts || []).slice(0, 5);
    if (top5.length === 0) {
      return `ℹ️ لا توجد مبيعات مسجلة في فترة (${periodLabel}) لحساب قائمة الأكثر مبيعاً.`;
    }
    const list = top5.map((p, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border);">
        <div><strong>#${idx + 1} ${p.name}</strong> <small style="color:var(--muted);">(${p.qty} قطعة)</small></div>
        <div style="font-weight:bold; color:var(--primary);">${p.revenue.toLocaleString()} ${currency} <small style="color:var(--success);">(ربح: ${p.profit.toLocaleString()})</small></div>
      </div>
    `).join('');
    return `
      🏆 <strong>أعلى 5 منتجات مبيعاً وتحقيقاً للإيراد في (${periodLabel}):</strong><br>
      <div style="margin:10px 0; background:var(--light); padding:10px; border-radius:8px;">${list}</div>
      💡 <strong>ملاحظة ذكية:</strong> هذه المنتجات تمثل النواة الأساسية لإيراداتك، احرص دائماً على وفرتها في المخزن بنسبة لا تقل عن 20 قطعة.
    `;
  }

  // 8. Slow Moving / Dead Stock
  if (/راكد|رواكد|مش بيتباع|مش شغالة|واقفة|بطيء|slow|dead/i.test(query)) {
    const soldIds = new Set((metrics.productStats || []).map(p => p.id));
    const slow = allProducts.filter(p => !soldIds.has(p.id));
    if (slow.length === 0) {
      return `🎉 <strong>أداء ممتاز!</strong> جميع المنتجات المعروضة في المحل تم بيع قطع منها خلال هذه الفترة ولا توجد منتجات راكدة.`;
    }
    const sample = slow.slice(0, 5).map(p => `<li><strong>${p.name}</strong> (المخزون الحالي: ${p.stock} قطعة - السعر: ${p.price} ${currency})</li>`).join('');
    return `
      📦 <strong>تقرير الرواكد والمنتجات بطيئة الحركة (${slow.length} منتج):</strong><br>
      <ul style="margin:8px 0; padding-right:20px;">${sample}</ul>
      ${slow.length > 5 ? `<small style="color:var(--muted);">وغيرها ${slow.length - 5} منتجات أخرى...</small><br>` : ''}
      <br>💡 <strong>خطة تصريف الرواكد المقترحة:</strong>
      <ol style="margin-top:4px; padding-right:20px;">
        <li>عمل عرض خصم بنسبة 15% على هذه الأصناف.</li>
        <li>إنشاء عروض ترويجية مركبة (اشتري منتجاً من الأكثر مبيعاً واحصل على منتج راكد بنصف السعر).</li>
        <li>تغيير مكان عرض المنتج في المحل ووضعه بالقرب من الكاشير.</li>
      </ol>
    `;
  }

  // 9. Categories Breakdown
  if (/قسم|أقسام|اقسام|تصنيف|فئات|category/i.test(query)) {
    const catData = AnalyticsManager.getCategoryData(targetPeriod);
    if (catData.categories.length === 0) {
      return `ℹ️ لا توجد بيانات مبيعات كافية للأقسام في فترة (${periodLabel}).`;
    }
    const catRows = catData.categories.map(c => {
      const pct = catData.totalRev > 0 ? ((c.revenue / catData.totalRev) * 100).toFixed(1) : 0;
      return `
        <div style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:2px;">
            <span>🏷️ ${c.name} (${c.qty} قطعة)</span>
            <span>${c.revenue.toLocaleString()} ${currency} (${pct}%)</span>
          </div>
          <div style="height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:#0d6efd; border-radius:3px;"></div>
          </div>
        </div>
      `;
    }).join('');
    return `
      📊 <strong>مقارنة أداء وتوزيع الأقسام في (${periodLabel}):</strong><br>
      <div style="background:var(--light); padding:12px; border-radius:8px; margin:10px 0;">${catRows}</div>
      🔹 <strong>القسم الرائد:</strong> <strong>${catData.categories[0].name}</strong> باستحواذ قدره <strong>${catData.percentages[0]}%</strong> من المبيعات.
    `;
  }

  // 10. Peak Times & Days
  if (/وقت|ساعات|ذروة|يوم|أيام|ايام|متى|peak|time/i.test(query)) {
    const peak = AnalyticsManager.getHourlyAndWeekdayData(targetPeriod);
    return `
      ⏰ <strong>تحليل أوقات الذروة وأنماط الشراء في (${periodLabel}):</strong><br>
      <div style="background:var(--light); padding:12px; border-radius:8px; margin:10px 0;">
        🔹 <strong>أفضل يوم في الأسبوع للمبيعات:</strong> <span style="font-weight:bold; color:var(--primary); font-size:15px;">🌟 يوم ${peak.peakDay}</span><br>
        🔹 <strong>ساعات الذروة الأكثر نشاطاً:</strong> <span style="font-weight:bold; color:var(--primary); font-size:15px;">⏱️ ${peak.peakHour}</span>
      </div>
      💡 <strong>نصيحة تشغيلية:</strong> احرص على تواجد عدد كافٍ من الموظفين في أوقات الذروة، وتجهيز الفكة وتجديد رصيد الأرفف قبل بدء ساعات النشاط.
    `;
  }

  // 11. Business Advice / Tips
  if (/نصائح|توصيات|ازاي ازود|إزاي أزود|أفكار|تطوير|خطة|تسويق|advice|tips/i.test(query)) {
    return `
      🎯 <strong>5 نصائح عملية ومخصصة لزيادة مبيعات وأرباح متجر الفارس:</strong><br>
      <ol style="margin:10px 0; padding-right:20px; line-height:1.7;">
        <li><strong>العروض المجمعة (Bundles):</strong> ادمج نظارات السباحة مع طوق أو كاب سباحة بخصم رمزي لتشجيع العميل على زيادة حجم الفاتورة.</li>
        <li><strong>رفع متوسط الفاتورة (Upselling):</strong> شجع الكاشير على اقتراح إكسسوارات سريعة (شرابات، سدادات أذن، شنط سباحة) عند الحساب.</li>
        <li><strong>إعادة طلب الأصناف الرابحة:</strong> تأكد من عدم نفاد المنتجات الأكثر طلباً في عطلة نهاية الأسبوع.</li>
        <li><strong>تصفية المخزون البطيء:</strong> خصص ركناً صغيراً في المحل لـ "عروض التصفية الأسبوعية" لتدوير السيولة النقدية.</li>
        <li><strong>برنامج ولاء بسيط:</strong> قدم خصماً 5% أو هدية رمزية للعملاء المتكررين لضمان عودتهم دائماً.</li>
      </ol>
    `;
  }

  // 12. General Period / Sales Summary Fallback
  return `
    📊 <strong>ملخص المبيعات لفترة (${periodLabel}):</strong><br>
    <div style="background:var(--light); padding:12px; border-radius:8px; margin:10px 0; line-height:1.8;">
      🔹 <strong>إجمالي الإيرادات:</strong> <span style="color:var(--primary); font-weight:bold;">${metrics.totalRevenue.toLocaleString()} ${currency}</span><br>
      🔹 <strong>صافي الأرباح:</strong> <span style="color:var(--success); font-weight:bold;">${metrics.totalProfit.toLocaleString()} ${currency}</span> (هامش ربح: ${metrics.profitMargin.toFixed(1)}%)<br>
      🔹 <strong>عدد العمليات والفواتير:</strong> ${metrics.totalOrders} فاتورة<br>
      🔹 <strong>إجمالي القطع المباعة:</strong> ${metrics.totalItems} قطعة<br>
      🔹 <strong>متوسط قيمة الفاتورة:</strong> ${Math.round(metrics.avgOrderValue)} ${currency}<br>
    </div>
    ${metrics.topProducts.length > 0 ? `🏆 <strong>المنتج الأكثر مبيعاً:</strong> "${metrics.topProducts[0].name}" (${metrics.topProducts[0].qty} قطعة).<br>` : ''}
    ${lowStock.length > 0 ? `⚠️ <strong>تنبيه:</strong> يوجد ${lowStock.length} منتجات وصلت لحد الطلب الأدنى.<br>` : ''}
    <br>💬 يمكنك سؤالي عن أي تفاصيل إضافية مثل الأرباح، النواقص، أو أداء أي قسم ومنتج!
  `;
};

// Chat UI & State Management
AIAssistant.initChat = function() {
  if (this.chatHistory.length === 0) {
    this.chatHistory.push({
      sender: 'bot',
      text: `
        👋 <strong>مرحباً بك في المساعد الذكي لمبيعات الفارس! 🤖</strong><br><br>
        أنا هنا لتحليل أداء متجرك ومساعدتك على فهم الأرقام وزيادة المبيعات والأرباح.<br>
        اختر أحد الأسئلة السريعة أدناه أو اكتب سؤالك مباشرة في المربع بالأسفل.
      `,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    });
  }
  this.renderChatMessages();
};

AIAssistant.renderChatMessages = function() {
  const container = document.getElementById('ai-chat-messages');
  if (!container) return;

  container.innerHTML = this.chatHistory.map(msg => `
    <div class="chat-msg ${msg.sender === 'bot' ? 'bot' : 'user'}">
      <div class="chat-avatar">${msg.sender === 'bot' ? '🤖' : '👤'}</div>
      <div class="chat-content">
        <div class="chat-bubble">${msg.text}</div>
        <div class="chat-time">${msg.time}</div>
      </div>
    </div>
  `).join('');

  container.scrollTop = container.scrollHeight;
};

AIAssistant.sendMessage = function(text) {
  const query = (text || '').trim();
  if (!query) return;
  if (this.isProcessing) return;
  this.isProcessing = true;

  const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // Add User Message
  this.chatHistory.push({
    sender: 'user',
    text: this.escapeHtml(query),
    time: nowTime
  });
  this.renderChatMessages();

  // Show Typing Indicator
  const container = document.getElementById('ai-chat-messages');
  const typingEl = document.createElement('div');
  typingEl.className = 'chat-msg bot typing';
  typingEl.id = 'ai-typing-indicator';
  typingEl.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div class="chat-content">
      <div class="chat-bubble typing-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  if (container) {
    container.appendChild(typingEl);
    container.scrollTop = container.scrollHeight;
  }

  // Generate Response
  setTimeout(() => {
    let responseText;
    try {
      responseText = this.processQuery(query, this.currentPeriod);
    } catch (error) {
      console.error('AI assistant error:', error);
      responseText = '⚠️ حصلت مشكلة أثناء تحليل السؤال. جرّب صياغة السؤال بطريقة أبسط أو اضغط تحديث التحليل.';
    }
    this.isProcessing = false;
    // Remove typing indicator
    const ind = document.getElementById('ai-typing-indicator');
    if (ind) ind.remove();

    this.chatHistory.push({
      sender: 'bot',
      text: responseText,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    });
    this.renderChatMessages();
  }, 400);
};

AIAssistant.clearChat = function() {
  this.isProcessing = false;
  const indicator = document.getElementById('ai-typing-indicator');
  if (indicator) indicator.remove();
  this.chatHistory = [];
  this.initChat();
};
