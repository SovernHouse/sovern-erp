const { v4: uuidv4 } = require('uuid');
const db = require('../models');

const seed = async () => {
  try {
    console.log('Starting database seeding...');
    console.log('Dropping and recreating all tables...');

    // Force: true drops all tables and recreates them
    await db.sequelize.sync({ force: true });
    console.log('Tables created successfully.');

    // ════════════════════════════════════════════
    //  USERS
    // ════════════════════════════════════════════

    const adminUser = await db.User.create({
      id: uuidv4(),
      email: process.env.ADMIN_EMAIL || 'admin@sovernhouse.co',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1-800-ADMIN',
      role: 'admin',
      isActive: true
    });

    const customerUser = await db.User.create({
      id: uuidv4(),
      email: 'alice@premiumflooring.com',
      password: 'password123',
      firstName: 'Alice',
      lastName: 'Johnson',
      phone: '+1-555-0101',
      role: 'customer',
      isActive: true
    });

    const factoryUser = await db.User.create({
      id: uuidv4(),
      email: 'contact@asialinkflooring.com',
      password: 'factory123',
      firstName: 'David',
      lastName: 'Chen',
      phone: '+86-512-8888',
      role: 'factory',
      isActive: true
    });

    const salesUser1 = await db.User.create({
      id: uuidv4(),
      email: 'john.sales@sovernhouse.co',
      password: 'password123',
      firstName: 'John',
      lastName: 'Sales',
      phone: '+1-800-JOHN',
      role: 'sales',
      isActive: true
    });

    const salesUser2 = await db.User.create({
      id: uuidv4(),
      email: 'sarah.sales@sovernhouse.co',
      password: 'password123',
      firstName: 'Sarah',
      lastName: 'Sales',
      phone: '+1-800-SARAH',
      role: 'sales',
      isActive: true
    });

    const opsUser = await db.User.create({
      id: uuidv4(),
      email: 'mike.ops@sovernhouse.co',
      password: 'password123',
      firstName: 'Mike',
      lastName: 'Operations',
      phone: '+1-800-MIKE',
      role: 'operations',
      isActive: true
    });
    console.log('Users created.');

    // ════════════════════════════════════════════
    //  CUSTOMERS
    // ════════════════════════════════════════════

    const customer1 = await db.Customer.create({
      id: uuidv4(),
      companyName: 'Flooring 4 Less Online',
      contactPerson: 'Alex Martinez',
      email: 'alex@flooring4lessonline.com',
      phone: '+1-888-555-0101',
      address: '500 Commerce Blvd',
      city: 'Dallas',
      country: 'USA',
      currency: 'USD',
      paymentTerms: 'Net 30',
      creditLimit: 150000,
      rating: 5
    });

    const customer2 = await db.Customer.create({
      id: uuidv4(),
      companyName: 'Premium Flooring Solutions',
      contactPerson: 'Alice Johnson',
      email: 'alice@premiumflooring.com',
      phone: '+1-555-0101',
      address: '123 Main St',
      city: 'New York',
      country: 'USA',
      currency: 'USD',
      paymentTerms: 'Net 30',
      creditLimit: 75000,
      rating: 5
    });

    const customer3 = await db.Customer.create({
      id: uuidv4(),
      companyName: 'Elite Floors Inc',
      contactPerson: 'Bob Smith',
      email: 'bob@elitefloors.com',
      phone: '+1-555-0102',
      address: '456 Oak Ave',
      city: 'Los Angeles',
      country: 'USA',
      currency: 'USD',
      paymentTerms: 'Net 45',
      creditLimit: 100000,
      rating: 5
    });

    const customer4 = await db.Customer.create({
      id: uuidv4(),
      companyName: 'Modern Living Floors Ltd',
      contactPerson: 'James Wilson',
      email: 'james@modernlivingfloors.co.uk',
      phone: '+44-20-7946-0958',
      address: '12 High Street',
      city: 'London',
      country: 'UK',
      currency: 'GBP',
      paymentTerms: 'Net 60',
      creditLimit: 80000,
      rating: 4
    });

    const customer5 = await db.Customer.create({
      id: uuidv4(),
      companyName: 'EuroFloor Distributors GmbH',
      contactPerson: 'Hans Mueller',
      email: 'hans@eurofloor.de',
      phone: '+49-89-1234-5678',
      address: '88 Industrie Strasse',
      city: 'Munich',
      country: 'Germany',
      currency: 'EUR',
      paymentTerms: 'Net 45',
      creditLimit: 120000,
      rating: 5
    });
    console.log('Customers created.');

    // ════════════════════════════════════════════
    //  FACTORIES (Based on Asia Link Flooring supply chain)
    // ════════════════════════════════════════════

    const factory1 = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Asia Link Flooring - SPC/WPC Division',
      contactPerson: 'David Chen',
      email: 'contact@asialinkflooring.com',
      phone: '+86-512-8888-1001',
      address: '100 Flooring Industrial Park',
      city: 'Zhangjiagang',
      country: 'China',
      currency: 'USD',
      paymentTerms: 'Net 60',
      leadTimeDays: 35,
      certifications: ['ISO 9001', 'ISO 14001', 'FloorScore', 'CARB2', 'CE'],
      specializations: ['SPC Flooring', 'WPC Flooring', 'LVT', 'Vinyl Dry Back'],
      rating: 5
    });

    const factory2 = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Asia Link Flooring - Laminate Division',
      contactPerson: 'Li Wei',
      email: 'laminate@asialinkflooring.com',
      phone: '+86-572-8888-2002',
      address: '200 Wood Industrial Zone',
      city: 'Huzhou',
      country: 'China',
      currency: 'USD',
      paymentTerms: 'Net 60',
      leadTimeDays: 40,
      certifications: ['ISO 9001', 'CE', 'CARB2'],
      specializations: ['Laminate Flooring', 'HDF Core'],
      rating: 5
    });

    const factory3 = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Asia Link Flooring - Engineered Wood Division',
      contactPerson: 'Zhang Jun',
      email: 'wood@asialinkflooring.com',
      phone: '+86-572-8888-3003',
      address: '300 Timber Park',
      city: 'Huzhou',
      country: 'China',
      currency: 'USD',
      paymentTerms: 'Net 60',
      leadTimeDays: 45,
      certifications: ['FSC', 'ISO 9001', 'CE', 'EUDR', 'UKTR'],
      specializations: ['Engineered Wood', 'Solid Wood', 'European Oak', 'American Oak'],
      rating: 5
    });

    const factory4 = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Asia Link Flooring - Bamboo & Decking',
      contactPerson: 'Wang Mei',
      email: 'bamboo@asialinkflooring.com',
      phone: '+86-572-8888-4004',
      address: '400 Bamboo Industrial Base',
      city: 'Anji',
      country: 'China',
      currency: 'USD',
      paymentTerms: 'Net 60',
      leadTimeDays: 40,
      certifications: ['FSC', 'ISO 9001', 'CE'],
      specializations: ['Bamboo Flooring', 'WPC Decking', 'WPC Cladding'],
      rating: 4
    });
    // Bathroom & Hardware factory
    const factory5 = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Guangdong Prestige Sanitary Ware Co., Ltd.',
      contactPerson: 'Chen Wei',
      email: 'exports@gdprestige-sanitary.com',
      phone: '+86-757-2988-5500',
      address: '18 Ceramic Industry Park',
      city: 'Foshan',
      country: 'China',
      currency: 'USD',
      paymentTerms: 'Net 60',
      leadTimeDays: 45,
      certifications: ['ISO 9001', 'CE', 'WRAS', 'cUPC', 'WATERMARK'],
      specializations: ['Bathroom Fittings', 'Sanitary Ware', 'Architectural Hardware', 'OEM/Private Label'],
      rating: 4
    });

    // Garments & Fabrics factory
    const factory6 = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Hangzhou Textile Alliance Co., Ltd.',
      contactPerson: 'Zhang Mei',
      email: 'sourcing@hztextilealliance.com',
      phone: '+86-571-8800-3322',
      address: '55 Textile Innovation Park',
      city: 'Hangzhou',
      country: 'China',
      currency: 'USD',
      paymentTerms: 'Net 45',
      leadTimeDays: 60,
      certifications: ['ISO 9001', 'OEKO-TEX Standard 100', 'GOTS', 'BSCI', 'WRAP'],
      specializations: ['Apparel', 'Home Textiles', 'Technical Fabrics', 'Sustainable Materials'],
      rating: 4
    });

    // Travel Accessories factory
    const factory7 = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Xiamen Moda Bags & Cases Co., Ltd.',
      contactPerson: 'Lin Jianfeng',
      email: 'trade@xmmoda-bags.com',
      phone: '+86-592-6688-1010',
      address: '200 Industrial Boulevard South',
      city: 'Xiamen',
      country: 'China',
      currency: 'USD',
      paymentTerms: 'Net 45',
      leadTimeDays: 50,
      certifications: ['ISO 9001', 'BSCI', 'REACH'],
      specializations: ['Hard-Shell Luggage', 'Backpacks', 'Duffel Bags', 'Travel Accessories', 'OEM'],
      rating: 4
    });
    console.log('Factories created.');

    // ════════════════════════════════════════════
    //  PRODUCT CATEGORIES (Flooring-focused)
    // ════════════════════════════════════════════

    const catSPC = await db.ProductCategory.create({ id: uuidv4(), name: 'SPC Flooring', description: 'Stone Plastic Composite rigid core flooring - waterproof, durable, click-lock installation' });
    const catWPC = await db.ProductCategory.create({ id: uuidv4(), name: 'WPC Flooring', description: 'Wood Plastic Composite flooring - softer underfoot, waterproof, built-in sound absorption' });
    const catLVT = await db.ProductCategory.create({ id: uuidv4(), name: 'LVT / Vinyl Plank', description: 'Luxury Vinyl Tile and Plank - versatile, waterproof, available in glue-down and click formats' });
    const catLaminate = await db.ProductCategory.create({ id: uuidv4(), name: 'Laminate Flooring', description: 'High-pressure laminate flooring with HDF core - AC3 to AC5 rated' });
    const catEngineered = await db.ProductCategory.create({ id: uuidv4(), name: 'Engineered Wood', description: 'Multi-layer engineered hardwood with real wood veneer top layer' });
    const catSolidWood = await db.ProductCategory.create({ id: uuidv4(), name: 'Solid Wood', description: 'Solid hardwood flooring - premium quality, sand and refinish capable' });
    const catBamboo = await db.ProductCategory.create({ id: uuidv4(), name: 'Bamboo Flooring', description: 'Sustainable bamboo flooring - strand woven, horizontal, and vertical options' });
    const catDecking = await db.ProductCategory.create({ id: uuidv4(), name: 'WPC Decking', description: 'Outdoor WPC composite decking - weather resistant, low maintenance' });
    const catAccessories = await db.ProductCategory.create({ id: uuidv4(), name: 'Underlay & Accessories', description: 'Underlayment, trims, moldings, stair sets, adhesives' });

    // Bathroom & Hardware categories
    const catBathFittings = await db.ProductCategory.create({ id: uuidv4(), name: 'Bathroom Fittings', description: 'Faucets, mixer taps, shower systems, thermostatic valves, towel rails and accessories' });
    const catSanitaryWare = await db.ProductCategory.create({ id: uuidv4(), name: 'Sanitary Ware', description: 'Ceramic basins, toilets, bidets, bathtubs, shower trays and enclosures' });
    const catArchHardware = await db.ProductCategory.create({ id: uuidv4(), name: 'Architectural Hardware', description: 'Door handles, locksets, hinges, slides, cabinet hardware, window fittings' });

    // Garments & Fabrics categories
    const catApparel = await db.ProductCategory.create({ id: uuidv4(), name: 'Apparel', description: 'Casualwear, activewear, outerwear and lifestyle clothing — private label and branded programs' });
    const catHomeTextiles = await db.ProductCategory.create({ id: uuidv4(), name: 'Home Textiles', description: 'Bedding, bath towels, robes, curtains, cushions and table linens' });
    const catTechFabrics = await db.ProductCategory.create({ id: uuidv4(), name: 'Technical Fabrics', description: 'Performance materials, moisture-wicking, UV protection, recycled and sustainable fiber fabrics' });

    // Travel Accessories categories
    const catLuggage = await db.ProductCategory.create({ id: uuidv4(), name: 'Luggage & Cases', description: 'Hard-shell and soft-shell luggage, carry-on bags, business and pilot cases' });
    const catBagsBackpacks = await db.ProductCategory.create({ id: uuidv4(), name: 'Bags & Backpacks', description: 'Backpacks, duffel bags, tote bags, laptop and travel bags' });
    const catTravelAccs = await db.ProductCategory.create({ id: uuidv4(), name: 'Travel Accessories', description: 'Packing cubes, travel pillows, passport holders, luggage tags and travel organisers' });
    console.log('Categories created.');

    // ════════════════════════════════════════════
    //  PRODUCTS (Based on Asia Link Flooring & Flooring4Less catalogs)
    // ════════════════════════════════════════════

    // --- SPC Flooring ---
    const spc1 = await db.Product.create({
      id: uuidv4(), name: 'SPC Classic Oak 5.5mm', sku: 'ALF-SPC-CLOAK-55',
      description: 'Classic Oak look SPC flooring with IXPE attached underlayment, 20mil wear layer, 100% waterproof',
      categoryId: catSPC.id, factoryId: factory1.id,
      unit: 'sqm', specifications: { thickness: '5.5mm', width: '181mm', length: '1220mm', material: 'SPC', finish: 'EIR', wearLayer: '0.5mm/20mil' },
      minOrderQty: 500, weight: 22, hsCode: '3918109000'
    });

    const spc2 = await db.Product.create({
      id: uuidv4(), name: 'SPC Hickory Peppercorn 6mm', sku: 'ALF-SPC-HIKPEP-60',
      description: 'Hickory Peppercorn SPC with rigid core, deep embossed texture, attached IXPE pad',
      categoryId: catSPC.id, factoryId: factory1.id,
      unit: 'sqm', specifications: { thickness: '6mm', width: '181mm', length: '1220mm', material: 'SPC', finish: 'EIR', wearLayer: '0.5mm/20mil' },
      minOrderQty: 500, weight: 24, hsCode: '3918109000'
    });

    const spc3 = await db.Product.create({
      id: uuidv4(), name: 'SPC Herringbone Grey Wash 5mm', sku: 'ALF-SPC-HBGW-50',
      description: 'Herringbone format SPC in Grey Wash color, perfect for modern interiors',
      categoryId: catSPC.id, factoryId: factory1.id,
      unit: 'sqm', specifications: { thickness: '5mm', width: '120mm', length: '600mm', material: 'SPC', finish: 'Matt', wearLayer: '0.3mm/12mil' },
      minOrderQty: 300, weight: 20, hsCode: '3918109000'
    });

    const spc4 = await db.Product.create({
      id: uuidv4(), name: 'SPC Natural Walnut 7mm', sku: 'ALF-SPC-NATWAL-70',
      description: 'Premium 7mm SPC with 28mil wear layer, wood veneer top, click-lock installation',
      categoryId: catSPC.id, factoryId: factory1.id,
      unit: 'sqm', specifications: { thickness: '7mm', width: '228mm', length: '1524mm', material: 'SPC-Wood Veneer', finish: 'Natural Oil Look', wearLayer: '0.7mm/28mil' },
      minOrderQty: 300, weight: 28, hsCode: '3918109000'
    });

    // --- WPC Flooring ---
    const wpc1 = await db.Product.create({
      id: uuidv4(), name: 'WPC European Oak 8mm', sku: 'ALF-WPC-EUOAK-80',
      description: 'Premium WPC with foam core for sound absorption, European Oak look, attached cork underlayment',
      categoryId: catWPC.id, factoryId: factory1.id,
      unit: 'sqm', specifications: { thickness: '8mm', width: '181mm', length: '1220mm', material: 'WPC', finish: 'EIR', wearLayer: '0.5mm/20mil' },
      minOrderQty: 400, weight: 18, hsCode: '3918109000'
    });

    const wpc2 = await db.Product.create({
      id: uuidv4(), name: 'WPC Smoky Mountain 7mm', sku: 'ALF-WPC-SMKMTN-70',
      description: 'Smoky Mountain grey tone WPC plank, warm underfoot, waterproof core',
      categoryId: catWPC.id, factoryId: factory1.id,
      unit: 'sqm', specifications: { thickness: '7mm', width: '178mm', length: '1219mm', material: 'WPC', finish: 'Embossed', wearLayer: '0.5mm/20mil' },
      minOrderQty: 400, weight: 16, hsCode: '3918109000'
    });

    // --- LVT / Vinyl ---
    const lvt1 = await db.Product.create({
      id: uuidv4(), name: 'LVT Glue-Down Natural Oak 3mm', sku: 'ALF-LVT-GD-NOAK-30',
      description: 'Commercial grade glue-down LVT, Natural Oak, 20mil wear layer',
      categoryId: catLVT.id, factoryId: factory1.id,
      unit: 'sqm', specifications: { thickness: '3mm', width: '178mm', length: '1219mm', material: 'LVT', finish: 'Matt', wearLayer: '0.5mm/20mil' },
      minOrderQty: 500, weight: 14, hsCode: '3918109000'
    });

    const lvt2 = await db.Product.create({
      id: uuidv4(), name: 'Digital Print SPC Marble Effect 5.5mm', sku: 'ALF-DP-MARBLE-55',
      description: 'Digital print SPC with marble stone look, ideal for bathrooms and kitchens',
      categoryId: catLVT.id, factoryId: factory1.id,
      unit: 'sqm', specifications: { thickness: '5.5mm', width: '305mm', length: '610mm', material: 'SPC Digital Print', finish: 'Crystal', wearLayer: '0.3mm/12mil' },
      minOrderQty: 300, weight: 22, hsCode: '3918109000'
    });

    // --- Laminate ---
    const lam1 = await db.Product.create({
      id: uuidv4(), name: 'Laminate AC5 Wide Plank Oak 12mm', sku: 'ALF-LAM-WPOAK-12',
      description: 'AC5 commercial grade laminate, extra wide plank, synchronized emboss finish, water-resistant HDF',
      categoryId: catLaminate.id, factoryId: factory2.id,
      unit: 'sqm', specifications: { thickness: '12mm', width: '242mm', length: '2260mm', material: 'Laminate', finish: 'Synchronized', acRating: 'AC5' },
      minOrderQty: 300, weight: 10, hsCode: '4411149000'
    });

    const lam2 = await db.Product.create({
      id: uuidv4(), name: 'Laminate AC4 Herringbone Walnut 8mm', sku: 'ALF-LAM-HBWAL-08',
      description: 'Herringbone format laminate in Walnut tone, AC4 rated, EIR finish',
      categoryId: catLaminate.id, factoryId: factory2.id,
      unit: 'sqm', specifications: { thickness: '8mm', width: '120mm', length: '600mm', material: 'Laminate', finish: 'EIR', acRating: 'AC4' },
      minOrderQty: 300, weight: 8, hsCode: '4411149000'
    });

    const lam3 = await db.Product.create({
      id: uuidv4(), name: 'Laminate AC4 Natural Maple 10mm', sku: 'ALF-LAM-NMAP-10',
      description: 'Natural Maple tone laminate, AC4 rated, hand-scraped texture, 10mm thick',
      categoryId: catLaminate.id, factoryId: factory2.id,
      unit: 'sqm', specifications: { thickness: '10mm', width: '195mm', length: '1280mm', material: 'Laminate', finish: 'Hand-scraped', acRating: 'AC4' },
      minOrderQty: 300, weight: 9, hsCode: '4411149000'
    });

    // --- Engineered Wood ---
    const eng1 = await db.Product.create({
      id: uuidv4(), name: 'Engineered European Oak AB Grade 15mm', sku: 'ALF-ENG-EUOAK-AB-15',
      description: 'Premium 3-ply engineered European Oak, AB grade, brushed and oiled, EUDR compliant',
      categoryId: catEngineered.id, factoryId: factory3.id,
      unit: 'sqm', specifications: { thickness: '15mm', width: '190mm', length: '1900mm', material: 'Engineered Wood', species: 'European Oak', grade: 'AB', construction: '3-ply' },
      minOrderQty: 200, weight: 12, hsCode: '4418750000'
    });

    const eng2 = await db.Product.create({
      id: uuidv4(), name: 'Engineered American Black Walnut 14mm', sku: 'ALF-ENG-ABWAL-14',
      description: 'American Black Walnut engineered plank, multiply construction, UV lacquered, FSC available',
      categoryId: catEngineered.id, factoryId: factory3.id,
      unit: 'sqm', specifications: { thickness: '14mm', width: '190mm', length: '1860mm', material: 'Engineered Wood', species: 'American Black Walnut', grade: 'AB', construction: 'Multiply' },
      minOrderQty: 200, weight: 11, hsCode: '4418750000'
    });

    const eng3 = await db.Product.create({
      id: uuidv4(), name: 'Engineered Birch Reactive Stain 20mm', sku: 'ALF-ENG-BIRCH-RS-20',
      description: 'Birch engineered plank with reactive stain finish, 2-ply construction, 6mm top layer',
      categoryId: catEngineered.id, factoryId: factory3.id,
      unit: 'sqm', specifications: { thickness: '20mm', width: '220mm', length: '2200mm', material: 'Engineered Wood', species: 'Birch', grade: 'BC', construction: '2-ply' },
      minOrderQty: 150, weight: 14, hsCode: '4418750000'
    });

    const eng4 = await db.Product.create({
      id: uuidv4(), name: 'Engineered Oak Herringbone 12mm', sku: 'ALF-ENG-OAKHB-12',
      description: 'European Oak herringbone engineered flooring, multiply, brushed and lacquered',
      categoryId: catEngineered.id, factoryId: factory3.id,
      unit: 'sqm', specifications: { thickness: '12mm', width: '90mm', length: '600mm', material: 'Engineered Wood', species: 'European Oak', grade: 'AB', construction: 'Multiply' },
      minOrderQty: 200, weight: 10, hsCode: '4418750000'
    });

    // --- Solid Wood ---
    const sw1 = await db.Product.create({
      id: uuidv4(), name: 'Solid European Oak 18mm', sku: 'ALF-SW-EUOAK-18',
      description: 'Solid European Oak flooring, AB grade, FSC certified, EUDR compliant, unfinished or prefinished',
      categoryId: catSolidWood.id, factoryId: factory3.id,
      unit: 'sqm', specifications: { thickness: '18mm', width: '150mm', length: '1800mm', material: 'Solid Wood', species: 'European Oak', grade: 'AB' },
      minOrderQty: 150, weight: 15, hsCode: '4418750000'
    });

    // --- Bamboo ---
    const bam1 = await db.Product.create({
      id: uuidv4(), name: 'Strand Woven Bamboo Natural 14mm', sku: 'ALF-BAM-SWNAT-14',
      description: 'Strand woven bamboo, extremely hard, natural color, click-lock, FSC certified',
      categoryId: catBamboo.id, factoryId: factory4.id,
      unit: 'sqm', specifications: { thickness: '14mm', width: '140mm', length: '1850mm', material: 'Bamboo', construction: 'Strand Woven', finish: 'Natural' },
      minOrderQty: 200, weight: 12, hsCode: '4418910000'
    });

    const bam2 = await db.Product.create({
      id: uuidv4(), name: 'Strand Woven Bamboo Carbonized 14mm', sku: 'ALF-BAM-SWCAR-14',
      description: 'Strand woven bamboo in carbonized (dark) tone, tongue and groove or click-lock',
      categoryId: catBamboo.id, factoryId: factory4.id,
      unit: 'sqm', specifications: { thickness: '14mm', width: '140mm', length: '1850mm', material: 'Bamboo', construction: 'Strand Woven', finish: 'Carbonized' },
      minOrderQty: 200, weight: 12, hsCode: '4418910000'
    });

    // --- WPC Decking ---
    const deck1 = await db.Product.create({
      id: uuidv4(), name: 'WPC Outdoor Decking Teak 25mm', sku: 'ALF-DECK-TEAK-25',
      description: 'Second generation WPC outdoor decking, double-sided texture, hollow core, UV resistant',
      categoryId: catDecking.id, factoryId: factory4.id,
      unit: 'sqm', specifications: { thickness: '25mm', width: '145mm', length: '2200mm', material: 'WPC', finish: 'Woodgrain' },
      minOrderQty: 100, weight: 20, hsCode: '3918109000'
    });

    // --- Accessories ---
    const acc1 = await db.Product.create({
      id: uuidv4(), name: 'IXPE Underlayment 1.5mm Gold Foil', sku: 'ALF-UL-IXPE-15G',
      description: 'Premium IXPE underlayment with gold foil moisture barrier, ideal for SPC/WPC/Laminate',
      categoryId: catAccessories.id, factoryId: factory1.id,
      unit: 'roll', specifications: { thickness: '1.5mm', width: '1000mm', length: '15000mm', material: 'IXPE with Gold Foil' },
      minOrderQty: 50, weight: 5, hsCode: '3921199000'
    });

    const acc2 = await db.Product.create({
      id: uuidv4(), name: 'PVA D3 Wood Flooring Adhesive 15kg', sku: 'ALF-ADH-PVAD3-15',
      description: 'PVA D3 grade adhesive for engineered wood flooring, water resistant',
      categoryId: catAccessories.id, factoryId: factory3.id,
      unit: 'piece', specifications: { weight: '15kg', material: 'PVA D3' },
      minOrderQty: 20, weight: 15, hsCode: '3506910000'
    });

    // ─────────────────────────────────────────
    //  BATHROOM & HARDWARE PRODUCTS
    // ─────────────────────────────────────────

    const bath1 = await db.Product.create({
      id: uuidv4(), name: 'Thermostatic Shower Column 1200mm — Chrome', sku: 'BH-THERM-COL-1200',
      description: 'Wall-mounted thermostatic shower column with overhead rain head (300mm), hand shower, body jets, and diverter. Brass body, chrome finish. WRAS and CE certified.',
      categoryId: catBathFittings.id, factoryId: factory5.id,
      unit: 'piece',
      specifications: { material: 'Brass', finish: 'Chrome', rainHead: '300mm', bodyJets: 6, certification: 'WRAS/CE', connections: '1/2"' },
      minOrderQty: 50, weight: 8.5, hsCode: null
    });

    const bath2 = await db.Product.create({
      id: uuidv4(), name: 'Single Lever Basin Mixer Tap — Brushed Nickel', sku: 'BH-BASIN-BN-SL',
      description: 'Single lever basin mixer tap with ceramic disc cartridge, pop-up waste included. Brushed nickel PVD finish. cUPC and WRAS certified.',
      categoryId: catBathFittings.id, factoryId: factory5.id,
      unit: 'piece',
      specifications: { material: 'Brass', finish: 'Brushed Nickel PVD', cartridge: 'Ceramic Disc', spoutHeight: '170mm', certification: 'cUPC/WRAS', connections: '3/8"' },
      minOrderQty: 100, weight: 1.2, hsCode: null
    });

    const bath3 = await db.Product.create({
      id: uuidv4(), name: 'Freestanding Oval Bathtub 1700mm — White Gloss Acrylic', sku: 'BH-BATH-FREE-1700',
      description: 'Freestanding oval bathtub in high-gloss white acrylic with reinforced fibreglass base. Includes chrome overflow and waste. 1700×800×600mm.',
      categoryId: catSanitaryWare.id, factoryId: factory5.id,
      unit: 'piece',
      specifications: { material: 'Acrylic/Fibreglass', finish: 'Gloss White', dimensions: '1700x800x600mm', capacity: '220L', thickness: '8mm acrylic shell' },
      minOrderQty: 20, weight: 52, hsCode: null
    });

    const bath4 = await db.Product.create({
      id: uuidv4(), name: 'Door Handle Set — Matte Black (Lever on Rose)', sku: 'BH-DOOR-MB-LVR',
      description: 'Contemporary lever-on-rose door handle set, matte black powder coat, solid zinc alloy. Includes pair of levers, escutcheon roses, and concealed fixings. DIN standard latch compatible.',
      categoryId: catArchHardware.id, factoryId: factory5.id,
      unit: 'pair',
      specifications: { material: 'Zinc Alloy', finish: 'Matte Black Powder Coat', type: 'Lever on Rose', standard: 'DIN', backSet: '60mm' },
      minOrderQty: 200, weight: 0.8, hsCode: null
    });

    // ─────────────────────────────────────────
    //  GARMENTS & FABRICS PRODUCTS
    // ─────────────────────────────────────────

    const gmt1 = await db.Product.create({
      id: uuidv4(), name: 'Heavyweight Cotton Jersey Tee 240gsm — Unisex', sku: 'GF-TEE-COT-240',
      description: 'Unisex heavyweight cotton jersey t-shirt, 240gsm ring-spun combed cotton. Available in S–3XL. OEKO-TEX Standard 100 certified. Min 1 colour screen print or embroidery on request.',
      categoryId: catApparel.id, factoryId: factory6.id,
      unit: 'piece',
      specifications: { fabric: '100% Ring-Spun Combed Cotton', gsm: '240', construction: 'Single Jersey', certification: 'OEKO-TEX Standard 100', sizing: 'S–3XL (unisex)', printOptions: 'Screen print / embroidery' },
      minOrderQty: 300, weight: 0.35, hsCode: null
    });

    const gmt2 = await db.Product.create({
      id: uuidv4(), name: 'Bamboo Blend Sheet Set Queen — 300TC', sku: 'GF-SHEET-BAMB-QN',
      description: 'Queen size sheet set: flat sheet, fitted sheet (38cm pocket depth), 2× pillowcases. 70% bamboo viscose / 30% cotton, 300 thread count. OEKO-TEX certified. Brushed sateen weave.',
      categoryId: catHomeTextiles.id, factoryId: factory6.id,
      unit: 'set',
      specifications: { composition: '70% Bamboo Viscose / 30% Cotton', threadCount: '300TC', weave: 'Brushed Sateen', size: 'Queen (152x203cm)', pocketDepth: '38cm', certification: 'OEKO-TEX Standard 100' },
      minOrderQty: 200, weight: 1.4, hsCode: null
    });

    const gmt3 = await db.Product.create({
      id: uuidv4(), name: 'Recycled rPET Packable Windbreaker — Unisex', sku: 'GF-WIND-RPET-PKB',
      description: 'Lightweight packable windbreaker made from 100% recycled polyester (rPET), taffeta lining, full-zip, packable into internal chest pocket. DWR treated. Unisex fit S–2XL.',
      categoryId: catApparel.id, factoryId: factory6.id,
      unit: 'piece',
      specifications: { fabric: '100% rPET Recycled Polyester Taffeta', gsm: '70', treatment: 'DWR (Durable Water Repellent)', sizing: 'S–2XL (unisex)', features: 'Packable into chest pocket, full-zip, adjustable hem', certification: 'GRS (Global Recycled Standard)' },
      minOrderQty: 200, weight: 0.28, hsCode: null
    });

    // ─────────────────────────────────────────
    //  TRAVEL ACCESSORIES PRODUCTS
    // ─────────────────────────────────────────

    const trv1 = await db.Product.create({
      id: uuidv4(), name: 'Polycarbonate 4-Wheel Luggage Set — 3pc (20"+24"+28")', sku: 'TA-LUG-PC-3SET',
      description: 'Three-piece hard-shell luggage set in 100% polycarbonate. Spinner 4-wheel system, TSA-approved lock, expandable zipper (+5cm), telescopic handle, interior cross straps. Customisable shell colour and lining.',
      categoryId: catLuggage.id, factoryId: factory7.id,
      unit: 'set',
      specifications: { material: 'Polycarbonate', pieces: '3 (20"/24"/28")', wheels: '4-wheel spinner (dual)', lock: 'TSA integrated', expandable: 'Yes +5cm', handle: 'Telescopic aluminium', shell: 'Customisable' },
      minOrderQty: 50, weight: 9.8, hsCode: null
    });

    const trv2 = await db.Product.create({
      id: uuidv4(), name: '40L Roll-Top Travel Backpack — Waterproof Nylon', sku: 'TA-PACK-RLTOP-40L',
      description: '40L roll-top daypack / travel backpack in 600D ripstop nylon. Padded laptop compartment (fits 15.6"), hip belt, sternum strap, tuck-away shoulder straps for carry-on compatibility. Hydration port ready.',
      categoryId: catBagsBackpacks.id, factoryId: factory7.id,
      unit: 'piece',
      specifications: { capacity: '40L', material: '600D Ripstop Nylon (PU coated)', laptopCompartment: '15.6"', closure: 'Roll-top + top zip', features: 'Hip belt, sternum strap, tuck-away straps, hydration port', dimensions: '55x32x22cm' },
      minOrderQty: 100, weight: 1.2, hsCode: null
    });

    const trv3 = await db.Product.create({
      id: uuidv4(), name: '6-Piece Honeycomb Packing Cube Set', sku: 'TA-CUBE-HONEY-6PC',
      description: 'Six-piece packing cube set: 2 large, 2 medium, 1 small, 1 shoe bag. Honeycomb mesh top panel, YKK zippers, double-pull design. Nylon 210D ripstop. Lightweight at 380g per set.',
      categoryId: catTravelAccs.id, factoryId: factory7.id,
      unit: 'set',
      specifications: { pieces: '6 (2L + 2M + 1S + 1 shoe bag)', material: 'Nylon 210D Ripstop + Mesh top', zippers: 'YKK', setWeight: '380g', panel: 'Honeycomb mesh visibility panel' },
      minOrderQty: 200, weight: 0.42, hsCode: null
    });

    console.log('Products created (22 flooring + 10 multi-vertical products).');

    // ════════════════════════════════════════════
    //  PRODUCT PRICES
    // ════════════════════════════════════════════

    const priceData = [
      // SPC (cost / sell per sqm)
      { product: spc1, cost: 6.50, sell: 14.50 },
      { product: spc2, cost: 7.20, sell: 16.00 },
      { product: spc3, cost: 6.00, sell: 13.50 },
      { product: spc4, cost: 9.50, sell: 22.00 },
      // WPC
      { product: wpc1, cost: 8.00, sell: 18.50 },
      { product: wpc2, cost: 7.50, sell: 17.00 },
      // LVT
      { product: lvt1, cost: 4.50, sell: 10.00 },
      { product: lvt2, cost: 6.80, sell: 15.00 },
      // Laminate
      { product: lam1, cost: 5.50, sell: 12.50 },
      { product: lam2, cost: 4.80, sell: 11.00 },
      { product: lam3, cost: 5.00, sell: 11.50 },
      // Engineered Wood
      { product: eng1, cost: 22.00, sell: 45.00 },
      { product: eng2, cost: 28.00, sell: 58.00 },
      { product: eng3, cost: 24.00, sell: 50.00 },
      { product: eng4, cost: 20.00, sell: 42.00 },
      // Solid Wood
      { product: sw1, cost: 30.00, sell: 62.00 },
      // Bamboo
      { product: bam1, cost: 16.00, sell: 34.00 },
      { product: bam2, cost: 16.00, sell: 34.00 },
      // Decking
      { product: deck1, cost: 12.00, sell: 28.00 },
      // Accessories
      { product: acc1, cost: 0.80, sell: 2.00 },
      { product: acc2, cost: 8.00, sell: 18.00 },
      // Bathroom & Hardware (per piece / per pair)
      { product: bath1, cost: 68.00, sell: 185.00 },
      { product: bath2, cost: 22.00, sell: 68.00 },
      { product: bath3, cost: 210.00, sell: 580.00 },
      { product: bath4, cost: 12.00, sell: 38.00 },
      // Garments & Fabrics (per piece / per set)
      { product: gmt1, cost: 3.80, sell: 11.50 },
      { product: gmt2, cost: 14.00, sell: 38.00 },
      { product: gmt3, cost: 18.00, sell: 52.00 },
      // Travel Accessories (per set / per piece)
      { product: trv1, cost: 42.00, sell: 125.00 },
      { product: trv2, cost: 24.00, sell: 72.00 },
      { product: trv3, cost: 6.50, sell: 19.00 },
    ];

    for (const p of priceData) {
      await db.ProductPrice.create({
        id: uuidv4(),
        productId: p.product.id,
        factoryId: p.product.factoryId,
        costPrice: p.cost,
        markup: Math.round(((p.sell - p.cost) / p.cost) * 100),
        sellingPrice: p.sell,
        currency: 'USD',
        isActive: true
      });
    }
    console.log('Product prices created.');

    // ════════════════════════════════════════════
    //  SPEC TEMPLATES (Flooring defaults)
    // ════════════════════════════════════════════

    await db.SpecTemplate.create({
      name: 'SPC Standard 5.5mm',
      flooringType: 'SPC',
      description: 'Standard SPC plank template - 5.5mm with IXPE, 20mil wear layer',
      coreType: 'Stone Plastic Composite',
      dimensionLength: 1220, dimensionWidth: 181, dimensionThickness: 5.5,
      wearLayerThickness: 0.5, wearLayerMil: 20,
      waterproof: true, fireRating: 'Bfl-s1', slipRating: 'R10',
      surfaceFinish: 'EIR', surfaceTexture: 'Wood Grain', edgeType: 'Micro-bevel',
      installationMethod: 'Click-lock', clickSystem: 'Uniclick',
      underlaymentRequired: 'Attached', underlaymentType: 'IXPE',
      sqftPerBox: 23.64, sqmPerBox: 2.20, planksPerBox: 10,
      warrantyResidential: 'Lifetime', warrantyCommercial: '15 Years',
      certifications: ['FloorScore', 'CARB2', 'CE'],
      format: 'Plank',
      isActive: true, createdBy: adminUser.id
    });

    await db.SpecTemplate.create({
      name: 'WPC Premium 8mm',
      flooringType: 'WPC',
      description: 'Premium WPC plank - 8mm with cork underlayment',
      coreType: 'Wood Plastic Composite',
      dimensionLength: 1220, dimensionWidth: 181, dimensionThickness: 8,
      wearLayerThickness: 0.5, wearLayerMil: 20,
      waterproof: true, fireRating: 'Bfl-s1', slipRating: 'R10',
      surfaceFinish: 'EIR', surfaceTexture: 'Wood Grain', edgeType: 'Micro-bevel',
      installationMethod: 'Click-lock', clickSystem: 'Valinge',
      underlaymentRequired: 'Attached', underlaymentType: 'Cork',
      sqftPerBox: 23.64, sqmPerBox: 2.20, planksPerBox: 10,
      warrantyResidential: 'Lifetime', warrantyCommercial: '10 Years',
      certifications: ['FloorScore', 'CARB2', 'CE'],
      format: 'Plank',
      isActive: true, createdBy: adminUser.id
    });

    await db.SpecTemplate.create({
      name: 'Laminate AC5 12mm',
      flooringType: 'Laminate',
      description: 'Commercial grade laminate - AC5, 12mm, synchronized finish',
      coreType: 'HDF',
      dimensionLength: 2260, dimensionWidth: 242, dimensionThickness: 12,
      acRating: 'AC5',
      waterproof: false, fireRating: 'Cfl-s1',
      surfaceFinish: 'Synchronized', surfaceTexture: 'Registered Emboss', edgeType: 'V-groove',
      installationMethod: 'Click-lock', clickSystem: 'Uniclick',
      underlaymentRequired: 'Required', underlaymentType: 'IXPE',
      sqftPerBox: 26.80, sqmPerBox: 2.49, planksPerBox: 6,
      warrantyResidential: '30 Years', warrantyCommercial: '10 Years',
      certifications: ['CE', 'CARB2'],
      format: 'Wide Plank',
      isActive: true, createdBy: adminUser.id
    });

    await db.SpecTemplate.create({
      name: 'Engineered Oak 3-ply 15mm',
      flooringType: 'Engineered Wood',
      description: 'European Oak 3-ply engineered, AB grade, brushed and oiled',
      coreType: 'Plywood',
      construction: '3-ply',
      dimensionLength: 1900, dimensionWidth: 190, dimensionThickness: 15,
      wearLayerThickness: 4,
      surfaceFinish: 'Oiled', surfaceTexture: 'Wire Brushed', edgeType: 'Micro-bevel',
      woodSpecies: 'European Oak', woodGrade: 'AB',
      installationMethod: 'Floating', clickSystem: 'Uniclick',
      underlaymentRequired: 'Required', underlaymentType: 'Cork',
      sqftPerBox: 21.50, sqmPerBox: 2.00, planksPerBox: 6,
      warrantyResidential: '25 Years', warrantyCommercial: '5 Years',
      certifications: ['FSC', 'CE', 'EUDR'],
      format: 'Plank',
      isActive: true, createdBy: adminUser.id
    });

    await db.SpecTemplate.create({
      name: 'LVT Glue-Down 3mm',
      flooringType: 'LVT',
      description: 'Commercial LVT glue-down, 20mil wear layer',
      coreType: 'None',
      dimensionLength: 1219, dimensionWidth: 178, dimensionThickness: 3,
      wearLayerThickness: 0.5, wearLayerMil: 20,
      waterproof: true,
      surfaceFinish: 'Matt', surfaceTexture: 'Wood Grain', edgeType: 'Square Edge',
      installationMethod: 'Glue-down', clickSystem: 'N/A',
      underlaymentRequired: 'Not Required',
      sqftPerBox: 35.96, sqmPerBox: 3.34, planksPerBox: 16,
      warrantyResidential: 'Lifetime', warrantyCommercial: '15 Years',
      certifications: ['FloorScore', 'CARB2', 'CE'],
      format: 'Plank',
      isActive: true, createdBy: adminUser.id
    });

    await db.SpecTemplate.create({
      name: 'Bamboo Strand Woven 14mm',
      flooringType: 'Bamboo',
      description: 'Strand woven bamboo, extremely hard and durable',
      coreType: 'Solid Wood',
      construction: 'Strand Woven',
      dimensionLength: 1850, dimensionWidth: 140, dimensionThickness: 14,
      wearLayerThickness: 4,
      surfaceFinish: 'Lacquered', surfaceTexture: 'Smooth', edgeType: 'Micro-bevel',
      installationMethod: 'Click-lock', clickSystem: 'Uniclick',
      underlaymentRequired: 'Required', underlaymentType: 'Cork',
      sqftPerBox: 22.60, sqmPerBox: 2.10, planksPerBox: 8,
      warrantyResidential: '25 Years', warrantyCommercial: '5 Years',
      certifications: ['FSC', 'CE'],
      format: 'Plank',
      isActive: true, createdBy: adminUser.id
    });
    console.log('Spec templates created (6 flooring presets).');

    // ════════════════════════════════════════════
    //  SAMPLE INQUIRIES
    // ════════════════════════════════════════════

    await db.Inquiry.create({
      id: uuidv4(), inquiryNumber: 'INQ-20260301-001',
      customerId: customer1.id, salesPersonId: salesUser1.id,
      status: 'new', priority: 'high', source: 'email'
    });

    await db.Inquiry.create({
      id: uuidv4(), inquiryNumber: 'INQ-20260302-002',
      customerId: customer2.id, salesPersonId: salesUser2.id,
      status: 'quoted', priority: 'medium', source: 'portal'
    });

    await db.Inquiry.create({
      id: uuidv4(), inquiryNumber: 'INQ-20260305-003',
      customerId: customer4.id, salesPersonId: salesUser1.id,
      status: 'new', priority: 'high', source: 'website'
    });
    console.log('Inquiries created.');

    console.log('');
    console.log('========================================');
    console.log('  Database seeding completed!');
    console.log('========================================');
    console.log('');
    console.log('  32 products: 22 flooring + 4 bathroom/hardware + 3 garments + 3 travel accessories');
    console.log('  19 categories across 4 verticals: Flooring, Bathroom & Hardware, Garments & Fabrics, Travel Accessories');
    console.log('  5 customers (USA/UK/DE), 7 factories (China)');
    console.log('  6 flooring spec templates');
    console.log('');
    console.log('Login credentials:');
    console.log('  Admin Portal  (localhost:5173): admin@sovernhouse.co / admin123');
    console.log('  Customer Portal (localhost:3000): alice@premiumflooring.com / password123');
    console.log('  Factory Portal  (localhost:3001): contact@asialinkflooring.com / factory123');
    console.log('');

  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

// Connect and seed - use force:true to drop and recreate
db.sequelize.authenticate()
  .then(() => {
    console.log('Database connected');
    return seed();
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
