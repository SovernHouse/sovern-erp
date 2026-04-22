const { v4: uuidv4 } = require('uuid');
const db = require('../models');

const seed = async () => {
  try {
    console.log('Starting non-destructive prospect seeding...');
    console.log('Note: Using findOrCreate to avoid duplicates.');

    // Disable FK checks so Lead inserts don't fail on missing Customers table
    await db.sequelize.query('PRAGMA foreign_keys = OFF');
    // Ensure all tables exist (non-destructive — creates missing tables only)
    await db.sequelize.sync({ force: false });
    console.log('Tables verified.');

    // ════════════════════════════════════════════
    // CREATE ADMIN USER (Alex)
    // ════════════════════════════════════════════

    const [alexUser, created] = await db.User.findOrCreate({
      where: { email: 'alex@sovernhouse.co' },
      defaults: {
        id: uuidv4(),
        email: 'alex@sovernhouse.co',
        password: 'SovernHouse2026!',
        firstName: 'Alexander',
        lastName: 'McConnell',
        phone: '+886 970 781 818',
        role: 'admin',
        isActive: true,
      },
    });

    if (created) {
      console.log('✓ Created admin user: alex@sovernhouse.co');
    } else {
      console.log('✓ Admin user already exists: alex@sovernhouse.co');
    }

    // ════════════════════════════════════════════
    // EGYPT AUTO PARTS (7 leads)
    // ════════════════════════════════════════════

    const egyptLeads = [
      {
        companyName: 'A-part',
        contactName: 'Import Manager',
        email: 'info@a-part.com',
        website: 'a-part.com',
        address: 'Katameya, New Cairo',
        country: 'Egypt',
        vertical: 'auto_parts',
        industry: 'Automotive',
        description: 'Authorised distributor: Bosch, Valeo, Zexel, Delphi. Multi-branch.',
      },
      {
        companyName: 'Ezzat Kamel Co. (EKCO AutoParts)',
        contactName: 'Import Manager',
        email: 'info@ekautoparts.com',
        website: 'ekautoparts.com',
        address: '119 Ramses St, Downtown Cairo',
        country: 'Egypt',
        vertical: 'auto_parts',
        industry: 'Automotive',
        description: '40+ years importing from Korea/Taiwan/Malaysia/China.',
      },
      {
        companyName: 'Green Global for Import & Export',
        contactName: 'Alaa Hosny Darwish',
        email: 'info@greenglobal.com.eg',
        website: 'greenglobal.com.eg',
        address: 'Alexandria, Egypt',
        country: 'Egypt',
        vertical: 'auto_parts',
        industry: 'Automotive',
        description: 'Founded 2010 by Alaa Hosny Darwish. 30+ yrs auto field.',
      },
      {
        companyName: 'GE for Trading',
        contactName: 'Owner / Import Manager',
        email: 'info@getradingeg.com',
        website: 'getradingeg.com',
        address: 'Heliopolis, Cairo',
        country: 'Egypt',
        vertical: 'auto_parts',
        industry: 'Automotive',
        description: 'Founded 2019. Lubricants + spare parts for passenger cars and motorcycles.',
      },
      {
        companyName: 'Al-Fath Automotive',
        contactName: 'Procurement Lead',
        email: 'info@alfath-egypt.com',
        website: 'alfath-egypt.com',
        address: 'Cairo, Egypt',
        country: 'Egypt',
        vertical: 'auto_parts',
        industry: 'Automotive',
        description: 'Founded 2000. OEM + aftermarket importer/exporter.',
      },
      {
        companyName: 'ElKo Trade',
        contactName: 'Owner / Import Manager',
        email: 'info@elkotrade.com',
        website: 'elkotrade.com',
        address: 'Abbas Al Aqad St 86, Cairo',
        phone: '+20 1098834626',
        country: 'Egypt',
        vertical: 'auto_parts',
        industry: 'Automotive',
        description: '#1 Suzuki parts wholesaler in Egypt. Founded 2015.',
      },
      {
        companyName: 'Remas Group for Import & Export',
        contactName: 'Import Manager',
        email: 'info@remasgroup.com',
        website: '',
        address: 'El Mahatta Street, Farscor, Demietta',
        country: 'Egypt',
        vertical: 'auto_parts',
        industry: 'Automotive',
        description: '55 import shipments on Volza. Imports from China and Turkey.',
      },
    ];

    for (const lead of egyptLeads) {
      const [newLead, isCreated] = await db.Lead.findOrCreate({
        where: {
          companyName: lead.companyName,
          email: lead.email,
        },
        defaults: {
          id: uuidv4(),
          ...lead,
          source: 'cold_call',
          status: 'new',
          leadType: 'outbound_prospect',
          currency: 'USD',
          tags: [],
        },
      });

      if (isCreated) {
        console.log(`✓ Created Egypt auto parts lead: ${lead.companyName}`);
      } else {
        console.log(`  Egypt auto parts lead already exists: ${lead.companyName}`);
      }
    }

    // ════════════════════════════════════════════
    // US FLOORING (4 leads)
    // ════════════════════════════════════════════

    const usLeads = [
      {
        companyName: 'Home Legend LLC',
        contactName: 'VP Sourcing',
        email: 'info@homelegend.com',
        website: 'homelegend.com',
        address: 'Chino, CA',
        country: 'United States',
        vertical: 'flooring',
        industry: 'Building Materials',
        description: 'Sourcing in Vietnam/Cambodia/Malaysia/Indonesia. Taiwan sourcing next step.',
      },
      {
        companyName: 'Herregan Distributors',
        contactName: 'VP Sourcing',
        email: 'info@herregan.com',
        website: 'herregan.com',
        address: 'St. Paul, MN',
        country: 'United States',
        vertical: 'flooring',
        industry: 'Building Materials',
        description: '8 locations, 3500+ dealers.',
      },
      {
        companyName: 'J.J. Haines & Company',
        contactName: 'Sourcing Lead',
        email: 'info@jjhaines.com',
        website: 'jjhaines.com',
        address: 'Glen Burnie, MD',
        country: 'United States',
        vertical: 'flooring',
        industry: 'Building Materials',
        description: 'Largest US floor covering distributor.',
      },
      {
        companyName: 'Goldentree Import & Export Inc.',
        contactName: 'Owner / Principal',
        email: 'info@goldentreeimport.com',
        website: '',
        address: 'United States',
        country: 'United States',
        vertical: 'flooring',
        industry: 'Building Materials',
        description: 'WFCA Associate Member. Name signals importer — highest ICP match on US list.',
      },
    ];

    for (const lead of usLeads) {
      const [newLead, isCreated] = await db.Lead.findOrCreate({
        where: {
          companyName: lead.companyName,
          email: lead.email,
        },
        defaults: {
          id: uuidv4(),
          ...lead,
          source: 'cold_call',
          status: 'new',
          leadType: 'outbound_prospect',
          currency: 'USD',
          tags: [],
        },
      });

      if (isCreated) {
        console.log(`✓ Created US flooring lead: ${lead.companyName}`);
      } else {
        console.log(`  US flooring lead already exists: ${lead.companyName}`);
      }
    }

    // ════════════════════════════════════════════
    // AUSTRALIA FLOORING (3 leads)
    // ════════════════════════════════════════════

    const auLeads = [
      {
        companyName: 'Carpet Court Australia',
        contactName: 'Head of Sourcing',
        email: 'info@carpetcourt.com.au',
        website: 'carpetcourt.com.au',
        address: 'Sydney, NSW',
        country: 'Australia',
        vertical: 'flooring',
        industry: 'Building Materials',
        description: '250+ store national franchise network.',
      },
      {
        companyName: 'Choices Flooring',
        contactName: 'Procurement Lead',
        email: 'info@choicesflooring.com.au',
        website: 'choicesflooring.com.au',
        address: '21 York St, Collingwood VIC',
        country: 'Australia',
        vertical: 'flooring',
        industry: 'Building Materials',
        description: '140 stores, AUD 148M revenue. Matthew Wilkinson on LinkedIn.',
      },
      {
        companyName: 'Flooring Xtra',
        contactName: 'Procurement Lead',
        email: 'info@flooringxtra.com.au',
        website: 'flooringxtra.com.au',
        address: 'Brisbane, QLD',
        country: 'Australia',
        vertical: 'flooring',
        industry: 'Building Materials',
        description: 'Independent retailer network.',
      },
    ];

    for (const lead of auLeads) {
      const [newLead, isCreated] = await db.Lead.findOrCreate({
        where: {
          companyName: lead.companyName,
          email: lead.email,
        },
        defaults: {
          id: uuidv4(),
          ...lead,
          source: 'cold_call',
          status: 'new',
          leadType: 'outbound_prospect',
          currency: 'AUD',
          tags: [],
        },
      });

      if (isCreated) {
        console.log(`✓ Created Australia flooring lead: ${lead.companyName}`);
      } else {
        console.log(`  Australia flooring lead already exists: ${lead.companyName}`);
      }
    }

    // ════════════════════════════════════════════
    // CHILE FLOORING (3 leads)
    // ════════════════════════════════════════════

    const clLeads = [
      {
        companyName: 'Termaco S.A.',
        contactName: 'Gerente de Compras',
        email: 'info@termaco.cl',
        website: 'termaco.cl',
        address: 'Santiago, Chile',
        country: 'Chile',
        vertical: 'flooring',
        industry: 'Building Materials',
        description: 'Established Santiago building materials distributor.',
      },
      {
        companyName: 'Multi Company / Rollux / Floorcenter',
        contactName: 'Gerente de Compras',
        email: 'ventas@multicompany.cl',
        website: 'multicompany.cl',
        address: 'Vitacura, Santiago',
        phone: '+56 9 9020 7595',
        country: 'Chile',
        vertical: 'flooring',
        industry: 'Building Materials',
        description: '30+ years. LVT/SPC/laminate/carpet. Distribution centre: Los Libertadores 89, Colina.',
        emailVerified: true,
      },
      {
        companyName: 'CHC',
        contactName: 'Gerente de Compras',
        email: 'info@chc.cl',
        website: 'chc.cl',
        address: 'Isabel la Católica 4376, Las Condes, Santiago',
        country: 'Chile',
        vertical: 'flooring',
        industry: 'Building Materials',
        description: '40+ years, 10 showrooms. Bathrooms/kitchens/flooring/walls. 201-500 employees.',
      },
    ];

    for (const lead of clLeads) {
      const [newLead, isCreated] = await db.Lead.findOrCreate({
        where: {
          companyName: lead.companyName,
          email: lead.email,
        },
        defaults: {
          id: uuidv4(),
          ...lead,
          source: 'cold_call',
          status: 'new',
          leadType: 'outbound_prospect',
          currency: 'CLP',
          tags: [],
        },
      });

      if (isCreated) {
        console.log(`✓ Created Chile flooring lead: ${lead.companyName}`);
      } else {
        console.log(`  Chile flooring lead already exists: ${lead.companyName}`);
      }
    }

    // Re-enable FK checks
    await db.sequelize.query('PRAGMA foreign_keys = ON');

    console.log('');
    console.log('✓ Prospect seeding complete!');
    console.log('  Created/verified 17 prospects + 1 admin user');
    console.log('');

    process.exit(0);
  } catch (error) {
    // Re-enable FK checks even on failure
    try { await db.sequelize.query('PRAGMA foreign_keys = ON'); } catch (_) {}
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seed();
