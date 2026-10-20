// Sample seed data for Al-Fares Swimming & Kids Shoes
// الفارس لمستلزمات السباحة و احذية الاطفال
window.SEED_DATA = {
  categories: [
    { id: 'cat_swim', name: 'مستلزمات السباحة', nameEn: 'Swimming Supplies' },
    { id: 'cat_shoes', name: 'احذية الاطفال', nameEn: 'Kids Shoes' },
    { id: 'cat_access', name: 'اكسسوارات', nameEn: 'Accessories' }
  ],
  products: [
    {
      id: 'p1',
      name: 'نظارة سباحة',
      nameEn: 'Swimming Goggles',
      barcode: '6221001010010',
      category: 'cat_swim',
      oldPrice: 150,
      price: 120,
      cost: 80,
      stock: 50,
      minStock: 10
    },
    {
      id: 'p2',
      name: 'قبعة سباحة',
      nameEn: 'Swimming Cap',
      barcode: '6221001010027',
      category: 'cat_swim',
      oldPrice: 75,
      price: 60,
      cost: 35,
      stock: 40,
      minStock: 10
    },
    {
      id: 'p3',
      name: 'مايوه سباحة اطفال',
      nameEn: 'Kids Swimsuit',
      barcode: '6221001010034',
      category: 'cat_swim',
      oldPrice: 300,
      price: 250,
      cost: 160,
      stock: 30,
      minStock: 8
    },
    {
      id: 'p4',
      name: 'حذاء رياضي اطفال',
      nameEn: 'Kids Sports Shoes',
      barcode: '6221001010041',
      category: 'cat_shoes',
      oldPrice: 400,
      price: 350,
      cost: 230,
      stock: 25,
      minStock: 5
    },
    {
      id: 'p5',
      name: 'صندل اطفال',
      nameEn: 'Kids Sandals',
      barcode: '6221001010058',
      category: 'cat_shoes',
      oldPrice: 180,
      price: 150,
      cost: 90,
      stock: 60,
      minStock: 12
    },
    {
      id: 'p6',
      name: 'حذاء مدرسه اطفال',
      nameEn: 'Kids School Shoes',
      barcode: '6221001010065',
      category: 'cat_shoes',
      oldPrice: 320,
      price: 280,
      cost: 180,
      stock: 20,
      minStock: 8
    },
    {
      id: 'p7',
      name: 'كفوف سباحة',
      nameEn: 'Swimming Fins',
      barcode: '6221001010072',
      category: 'cat_swim',
      oldPrice: 380,
      price: 320,
      cost: 210,
      stock: 15,
      minStock: 5
    },
    {
      id: 'p8',
      name: 'حقيبة سباحة',
      nameEn: 'Swimming Bag',
      barcode: '6221001010089',
      category: 'cat_access',
      oldPrice: 220,
      price: 180,
      cost: 110,
      stock: 35,
      minStock: 10
    },
    {
      id: 'p9',
      name: 'منشفة شاطئ',
      nameEn: 'Beach Towel',
      barcode: '6221001010096',
      category: 'cat_access',
      oldPrice: 110,
      price: 90,
      cost: 50,
      stock: 45,
      minStock: 10
    },
    {
      id: 'p10',
      name: 'جوارب اطفال',
      nameEn: 'Kids Socks',
      barcode: '6221001010102',
      category: 'cat_access',
      oldPrice: 50,
      price: 40,
      cost: 18,
      stock: 100,
      minStock: 20
    }
  ]
};
