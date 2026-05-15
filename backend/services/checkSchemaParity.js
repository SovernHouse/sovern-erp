/**
 * Phase 4.9.3 (final) Part H — schema/model parity check.
 *
 * Boot-time sanity pass: walks every Sequelize model with a tableName
 * and rawAttributes, compares the model's attribute fields against
 * PRAGMA table_info for the corresponding table, and logs any
 * mismatch.
 *
 * Three categories:
 *   - inModelMissingFromDb: model declares X but DB has no X column.
 *     Usually means a schema migration didn't run, or sync() was
 *     supposed to alter and didn't.
 *   - inDbMissingFromModel: DB has X but model doesn't declare X.
 *     Usually means dead/legacy columns left over from a half-done
 *     migration, OR a column added via raw SQL without updating
 *     the model.
 *   - tableMissing: model exists but no table in the DB. Usually
 *     means sync() never ran for this model OR the table name
 *     resolution disagrees between model and migration.
 *
 * Never throws. Visibility only. Counts every mismatch into one
 * summary log line so the deploy log surfaces the problem at a
 * glance.
 */

const logger = require('../utils/logger');

const SKIP_MODELS = new Set([
  'sequelize', 'Sequelize',
]);

async function checkSchemaParity(db) {
  if (!db?.sequelize) return { skipped: true };
  const findings = {
    perfect: [],
    inModelMissingFromDb: {},
    inDbMissingFromModel: {},
    tableMissing: [],
    errored: [],
  };

  for (const modelName of Object.keys(db)) {
    if (SKIP_MODELS.has(modelName)) continue;
    const Model = db[modelName];
    if (!Model || !Model.rawAttributes || !Model.tableName) continue;
    const tableName = Model.tableName;

    let rows;
    try {
      const [r] = await db.sequelize.query(`PRAGMA table_info(${tableName})`);
      rows = r;
    } catch (e) {
      findings.errored.push({ model: modelName, table: tableName, error: e.message });
      continue;
    }
    if (!rows || rows.length === 0) {
      findings.tableMissing.push({ model: modelName, table: tableName });
      continue;
    }

    const dbCols = new Set(rows.map(r => r.name));
    const modelFields = new Set(Object.values(Model.rawAttributes).map(a => a.field || a.fieldName));

    const missingFromDb = [...modelFields].filter(f => !dbCols.has(f));
    const missingFromModel = [...dbCols].filter(c => !modelFields.has(c));

    if (missingFromDb.length === 0 && missingFromModel.length === 0) {
      findings.perfect.push(modelName);
      continue;
    }
    if (missingFromDb.length > 0) findings.inModelMissingFromDb[modelName] = missingFromDb;
    if (missingFromModel.length > 0) findings.inDbMissingFromModel[modelName] = missingFromModel;
  }

  const mismatchCount = Object.keys(findings.inModelMissingFromDb).length
    + Object.keys(findings.inDbMissingFromModel).length
    + findings.tableMissing.length
    + findings.errored.length;

  logger.info(`[parity] checked ${findings.perfect.length} model(s) clean, ${mismatchCount} with mismatch(es).`);

  if (Object.keys(findings.inModelMissingFromDb).length > 0) {
    logger.warn(
      '[parity] models declaring attributes that DB does NOT have: ' +
      Object.entries(findings.inModelMissingFromDb)
        .map(([m, fs]) => `${m}=[${fs.join(',')}]`)
        .join('; ')
    );
  }
  if (Object.keys(findings.inDbMissingFromModel).length > 0) {
    logger.warn(
      '[parity] DB tables with columns NOT declared in the model: ' +
      Object.entries(findings.inDbMissingFromModel)
        .map(([m, cs]) => `${m}=[${cs.join(',')}]`)
        .join('; ')
    );
  }
  if (findings.tableMissing.length > 0) {
    logger.warn(
      '[parity] models with NO table in the DB: ' +
      findings.tableMissing.map(t => `${t.model} (expected table ${t.table})`).join(', ')
    );
  }
  if (findings.errored.length > 0) {
    logger.warn(
      '[parity] PRAGMA failed for: ' +
      findings.errored.map(e => `${e.model}/${e.table}: ${e.error}`).join('; ')
    );
  }

  return findings;
}

module.exports = { checkSchemaParity };
