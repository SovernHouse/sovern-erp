#!/usr/bin/env node
/**
 * Schema Fix Script
 * Adds missing columns to existing tables so sync() can run without alter:true
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../models');

async function fixSchema() {
  await db.sequelize.authenticate();
  console.log('DB connected');
  const qi = db.sequelize.getQueryInterface();

  // Get all existing tables
  const [tables] = await db.sequelize.query("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.map(t => t.name);
  console.log('Existing tables:', tableNames.length);

  let fixCount = 0;
  const modelNames = Object.keys(db).filter(k => db[k] && db[k].rawAttributes);

  for (const modelName of modelNames) {
    const model = db[modelName];
    const tableName = model.getTableName();

    if (typeof tableName !== 'string') continue;

    if (tableNames.indexOf(tableName) === -1) {
      console.log('NEW TABLE:', tableName, '(will be created by sync)');
      continue;
    }

    let desc;
    try {
      desc = await qi.describeTable(tableName);
    } catch(e) {
      console.log('Skip', tableName + ':', e.message.substring(0, 60));
      continue;
    }

    const existingCols = Object.keys(desc);

    for (const [attrName, attrDef] of Object.entries(model.rawAttributes)) {
      const colName = attrDef.field || attrName;
      if (existingCols.indexOf(colName) !== -1) continue;

      // Determine SQL type
      let sqlType = 'TEXT';
      const dtKey = attrDef.type && attrDef.type.key ? attrDef.type.key : '';
      if (dtKey === 'INTEGER' || dtKey === 'BIGINT') sqlType = 'INTEGER';
      else if (dtKey === 'BOOLEAN') sqlType = 'BOOLEAN DEFAULT 0';
      else if (dtKey === 'DECIMAL' || dtKey === 'FLOAT' || dtKey === 'DOUBLE') sqlType = 'REAL';
      else if (dtKey === 'DATE' || dtKey === 'DATEONLY') sqlType = 'DATETIME';

      // Check for default values
      let defaultClause = '';
      if (attrDef.defaultValue !== undefined && attrDef.defaultValue !== null && sqlType === 'TEXT') {
        // skip complex defaults
      }

      console.log('  ADD:', tableName + '.' + colName, '(' + sqlType + ')');
      try {
        await db.sequelize.query('ALTER TABLE "' + tableName + '" ADD COLUMN "' + colName + '" ' + sqlType);
        fixCount++;
      } catch(e) {
        if (e.message.indexOf('duplicate column') !== -1) {
          console.log('    (already exists)');
        } else {
          console.log('    ERROR:', e.message.substring(0, 80));
        }
      }
    }
  }

  console.log('\nFixed', fixCount, 'missing columns');

  // Drop orphan indexes that may conflict with sync
  const orphanIndexes = [
    'product_specification_product_id',
    'product_specifications_product_id'
  ];
  for (const idx of orphanIndexes) {
    try {
      await db.sequelize.query('DROP INDEX IF EXISTS "' + idx + '"');
      console.log('Dropped orphan index:', idx);
    } catch(e) {
      // ignore
    }
  }

  // Now sync to create new tables
  console.log('\nRunning sync...');
  await db.sequelize.sync();
  console.log('SYNC OK - all tables ready');

  // Verify users exist
  const userCount = await db.User.count();
  console.log('Users in DB:', userCount);

  process.exit(0);
}

fixSchema().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
