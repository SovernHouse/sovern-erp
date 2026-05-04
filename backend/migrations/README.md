# Backend Migrations

This directory uses **Sequelize CLI** for schema migrations.

## Running migrations

From the repo root:
```
npm run migrate              # apply all pending migrations
npm run migrate:status       # show applied/pending state
npm run migrate:undo         # roll back the last migration
npm run migrate:generate -- migration-name   # scaffold a new file
```

Or from `backend/`:
```
npx sequelize-cli db:migrate
npx sequelize-cli migration:generate --name new-thing
```

Migration filenames must match the Sequelize CLI pattern:
`YYYYMMDDHHMMSS-name-of-migration.js` (e.g. `20260504120000-add-users-table.js`).

## Production state — IMPORTANT

The production SQLite database at `backend/database.sqlite` was built by
Sequelize `sync()` on first server startup, NOT by running migrations.
There is no `SequelizeMeta` table on the production DB. So if you ever
run `npm run migrate` against the live database, it will try to apply
`20260316000001-initial-schema.js` against an already-populated DB and
fail.

**Before running migrations against prod for the first time:**
1. Connect to the prod DB
2. Create `SequelizeMeta` and seed it with the names of every existing
   migration file (so Sequelize considers them "already applied"):
   ```sql
   CREATE TABLE SequelizeMeta (name VARCHAR(255) PRIMARY KEY);
   INSERT INTO SequelizeMeta VALUES ('20260316000001-initial-schema.js');
   INSERT INTO SequelizeMeta VALUES ('20260316000002-add-sso-accounts.js');
   ```
3. Then `npm run migrate` will only apply migrations newer than these.

## History

Two migration systems used to coexist here:
- **Homegrown** (`001_initial_schema.js`, `002_seed_data.js`, `migrate.js`) — deleted 2026-05-04 in favor of Sequelize CLI. Recover from git history if needed.
- **Sequelize CLI** (timestamp-prefixed files) — current.

The homegrown system used a `schema_migrations` table that also doesn't exist on prod. Both systems have been dormant since launch.
