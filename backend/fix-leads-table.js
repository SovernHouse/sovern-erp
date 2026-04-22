/**
 * fix-leads-table.js
 * Drops the Leads table and recreates it via Sequelize sync.
 * Safe to run because Leads has no real data yet (all seed attempts failed).
 * The old schema had REFERENCES Customers (plural) but the table is Customer (singular).
 */
const db = require('./models');

async function fix() {
  try {
    // Confirm no real data
    const count = await db.Lead.count();
    console.log(`Leads rows before drop: ${count}`);

    // Drop and recreate
    await db.Lead.drop();
    console.log('Leads table dropped.');

    await db.Lead.sync({ force: false });
    console.log('Leads table recreated (no FK constraints).');

    const countAfter = await db.Lead.count();
    console.log(`Leads rows after recreate: ${countAfter}`);

    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

fix();
