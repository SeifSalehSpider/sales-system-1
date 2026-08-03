# Sales System - Al-Fares Swimming & Kids Shoes

## TODO List

- [x] 1. Create project structure (folders)
- [x] 2. Create `data/seed-data.js` - sample products (swimming supplies, kids shoes)
- [x] 3. Create `js/storage.js` - localStorage data persistence layer
- [x] 4. Create `js/barcode.js` - barcode generation & label printing
- [x] 5. Create `js/products.js` - product management logic
- [x] 6. Create `js/sales.js` - POS cart & sales logic
- [x] 7. Create `js/app.js` - main app routing/navigation
- [x] 8. Create `css/style.css` - RTL Arabic/English modern UI
- [x] 9. Create `index.html` - main app shell (POS/Products/Print/Reports)
- [x] 10. Test in browser (open index.html)

## Bulk Delete Feature

- [x] 1. Add `removeMany(ids)` batch delete method to `js/products.js`
- [x] 2. Add bulk toolbar + checkbox column to `index.html`
- [x] 3. Add selection logic & bulk delete to `js/app.js`
- [x] 4. Add bulk delete styles to `css/style.css`
- [x] 5. Test multi-select delete in browser

## Per-Product Discount Feature

- [ ] 1. Add `oldPrice` (price before discount) to seed products in `data/seed-data.js`
- [ ] 2. Add "السعر قبل الخصم" field to product modal in `index.html`
- [ ] 3. Update `js/sales.js` cart logic (oldPrice, subtotal, auto-discount)
- [ ] 4. Update `js/app.js` (cart display, checkout discount auto-fill, save/load oldPrice)
- [ ] 5. Add discount display styles to `css/style.css`
- [ ] 6. Test in browser

## Barcode Print Select All/Deselect Feature

- [x] 1. Add "تحديد الكل" and "الغاء التحديد" buttons to `index.html` print section
- [x] 2. Add `selectAllPrint()` and `deselectAllPrint()` methods to `js/app.js`
- [x] 3. Bind button event listeners in `js/app.js`
- [x] 4. Test in browser
</content>
