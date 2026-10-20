// Barcode generation & label printing
const BarcodeUtil = {
  // Generate a valid EAN-13 check digit
  calculateCheckDigit(code) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    return check;
  },

  // Generate a full EAN-13 barcode from a base or random
  generateEAN13(prefix) {
    let base = prefix || '622';
    // Ensure 12 digits total before check digit
    while (base.length < 12) {
      base += Math.floor(Math.random() * 10);
    }
    base = base.substring(0, 12);
    return base + this.calculateCheckDigit(base);
  },

  // Render a single barcode SVG into a container
  render(container, code, options) {
    if (!container) return;
    const opts = Object.assign({
      format: 'EAN13',
      displayValue: true,
      fontSize: 14,
      margin: 5,
      width: 2,
      height: 60
    }, options || {});
    try {
      container.innerHTML = '';
      JsBarcode(container, code, opts);
    } catch (e) {
      container.innerHTML = '<span style="color:red">' + code + '</span>';
    }
  },

  // Print barcode labels for selected products
  printLabels(products) {
    if (!products || products.length === 0) return;
    const settings = Store.getSettings();
    const vendorScriptUrl = new URL('js/vendor-jsbarcode.all.min.js', window.location.href).href;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups to print labels');
      return;
    }

    let labelsHtml = '';
    products.forEach(p => {
      labelsHtml += `
        <div class="label">
          <div class="label-shop">${settings.shopName}</div>
          <div class="label-name">${p.name}<br><small>${p.nameEn || ''}</small></div>
          <div class="label-barcode">
            <svg id="barcode-${p.barcode}"></svg>
          </div>
          <div class="label-price">${p.price} ${settings.currency}</div>
        </div>`;
    });

    printWindow.document.write(`
      <html>
      <head>
        <title>Barcode Labels - ${settings.shopName}</title>
        <style>
          @page { size: A4; margin: 8mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; }
          .label {
            width: 60mm; height: 35mm; border: 1px dashed #ccc;
            display: inline-block; margin: 2mm; padding: 3mm;
            text-align: center; vertical-align: top; box-sizing: border-box;
            page-break-inside: avoid;
          }
          .label-shop { font-size: 8px; font-weight: bold; color: #333; margin-bottom: 2px; }
          .label-name { font-size: 10px; min-height: 16px; margin-bottom: 2px; }
          .label-name small { color: #888; }
          .label-barcode svg { width: 100%; height: 18mm; }
          .label-price { font-size: 13px; font-weight: bold; color: #c00; margin-top: 2px; }
        </style>
      </head>
      <body>
        ${labelsHtml}
        <script>
          window.onload = function() {
            const labels = ${JSON.stringify(products)};
            labels.forEach(p => {
              const el = document.getElementById('barcode-' + p.barcode);
              if (el) {
                try {
                  JsBarcode(el, p.barcode, { format: 'EAN13', displayValue: false, width: 2, height: 50 });
                } catch(e) {}
              }
            });
            setTimeout(function(){ window.print(); }, 500);
          };
        <\/script>
        <script src="${vendorScriptUrl}"><\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  },

  // Print receipt for a sale
  printReceipt(sale) {
    if (!sale) return;
    const settings = Store.getSettings();
    const printWindow = window.open('', '_blank', 'width=350,height=700');
    if (!printWindow) {
      alert('Please allow popups to print receipt');
      return;
    }

    let itemsHtml = '';
    sale.items.forEach(item => {
      itemsHtml += `
        <tr>
          <td>${item.name}</td>
          <td class="c">${item.qty}</td>
          <td class="c">${item.price}</td>
          <td class="c">${item.total}</td>
        </tr>`;
    });

    const date = new Date(sale.date).toLocaleString('ar-EG');
    const paymentLabel = sale.payment === 'cash' ? 'نقدي' : (sale.payment === 'card' ? 'بطاقة' : 'دفع عند الاستلام');

    printWindow.document.write(`
      <html>
      <head>
        <title>Receipt</title>
        <style>
          @page { size: 80mm auto; margin: 5mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; width: 70mm; margin: 0 auto; font-size: 12px; }
          .receipt { text-align: center; }
          .shop { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
          .shop-en { font-size: 10px; color: #555; }
          .meta { font-size: 10px; color: #333; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th, td { padding: 3px 2px; text-align: right; font-size: 11px; }
          th { border-bottom: 1px solid #000; }
          .c { text-align: center; }
          .totals { margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px; }
          .totals div { display: flex; justify-content: space-between; padding: 2px 0; }
          .grand { font-size: 15px; font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .thank { margin-top: 8px; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="shop">${settings.shopName}</div>
          <div class="shop-en">${settings.shopNameEn}</div>
          <div class="meta">${settings.address}</div>
          <div class="meta">هاتف: ${settings.phone}</div>
          <div class="meta">فاتورة رقم: ${sale.id}</div>
          <div class="meta">${date}</div>
          <div class="divider"></div>
          <table>
            <thead><tr><th>الصنف</th><th class="c">كمية</th><th class="c">سعر</th><th class="c">اجمالي</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="totals">
            <div><span>الاجمالي</span><span>${sale.subtotal} ${settings.currency}</span></div>
            <div><span>الخصم</span><span>${sale.discount || 0} ${settings.currency}</span></div>
            <div><span>تكلفة الشحن</span><span>${sale.shipping || 0} ${settings.currency}</span></div>
            <div class="grand"><span>الصافي</span><span>${sale.total} ${settings.currency}</span></div>
            <div><span>المدفوع</span><span>${sale.paid} ${settings.currency}</span></div>
            <div><span>الباقي</span><span>${sale.change} ${settings.currency}</span></div>
            <div><span>طريقة الدفع</span><span>${paymentLabel}</span></div>
            ${sale.customerName ? `<div><span>العميل</span><span>${sale.customerName}</span></div>` : ''}
            ${sale.customerPhone ? `<div><span>الهاتف</span><span>${sale.customerPhone}</span></div>` : ''}
          </div>
          ${sale.customerAddress ? `<div class="divider"></div><div class="meta" style="text-align:right;"><strong>عنوان التوصيل:</strong> ${sale.customerAddress}</div>` : ''}
          <div class="divider"></div>
          <div class="thank">شكرا لزيارتكم! نتمنى لكم يوما سعيدا</div>
        </div>
        <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }
};

window.BarcodeUtil = BarcodeUtil;
