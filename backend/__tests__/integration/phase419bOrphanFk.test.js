// Phase 4.19b — orphan-FK detector.
//
// Pins the Phase 4.16.4 lesson: inline `references: { model: 'X' }` on
// Sequelize columns pin the SQLite FK target by literal table name.
// Archive/rename migrations on the parent table leave the child FK
// pointing at the dead target. With PRAGMA foreign_keys=ON every INSERT
// against the child then fails with SQLITE_CONSTRAINT.
//
// This test syncs the model registry to a fresh in-memory DB and walks
// sqlite_master looking for any table whose CREATE TABLE SQL contains
// "_orphan_" in a REFERENCES clause. Returns 0 today; will catch any
// future inline `references` block that the next archive-rename
// migration leaves stranded.

const { getApp, getDb, cleanup } = require('../setup');

describe('Phase 4.19b — orphan-FK detector', () => {
  let db;

  beforeAll(async () => {
    await getApp();
    db = getDb();
  }, 30000);

  afterAll(async () => {
    await cleanup();
  });

  it('no table references an _orphan_-named archive', async () => {
    const [rows] = await db.sequelize.query(
      `SELECT name, sql FROM sqlite_master
       WHERE type='table'
         AND sql LIKE '%_orphan_%'
         AND name NOT LIKE '%_orphan_%'
       ORDER BY name`
    );

    if (rows.length > 0) {
      const offenders = rows.map(r => {
        // Pull the dead target name out of the REFERENCES clause so the
        // diagnostic points at the exact migration that needs to repair
        // the FK or strip the inline `references` block.
        const m = r.sql.match(/REFERENCES\s+["']?([A-Za-z0-9_]*_orphan_[A-Za-z0-9_]+)["']?/);
        return `  - ${r.name}${m ? ' → REFERENCES ' + m[1] : ''}`;
      }).join('\n');
      throw new Error([
        '',
        'Found table(s) with FK constraints pointing at an _orphan_-named archive:',
        offenders,
        '',
        'Per L-052: drop the inline `references` block from the model column AND',
        'rebuild the table on prod (PRAGMA foreign_keys = OFF; CREATE TABLE X_new',
        'without the FK; INSERT INTO X_new SELECT * FROM X; DROP X; RENAME).',
        'Phase 4.16.4 + 4.17 follow-up fixed Product + ProductAttribute; new',
        'offenders are new bugs.',
      ].join('\n'));
    }

    expect(rows).toEqual([]);
  });
});
