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

**Phase 4.10 update — bootstrap is now automatic on every boot.** `backend/services/bootstrapMigrationsMeta.js` runs at server startup:
1. Creates `SequelizeMeta` if absent.
2. Seeds it with every filename in `migrations/`.
3. Records the bootstrap in AuditLog under `phase4_10_sequelize_meta_bootstrapped`.

Result: `npm run migrate:status` shows every file in `migrations/` as APPLIED on any environment that previously relied on `sync()`. Any NEW migration generated via `npm run migrate:generate -- <name>` shows PENDING and is applied by `npm run migrate`.

## Contract going forward

NEW schema changes use `npm run migrate:generate -- <name>` and live in this directory with proper `up()` / `down()`. The bootstrap above ensures the CLI sees the existing schema as the baseline.

OLD service-style migrations (`backend/services/migrate*.js`, 7 files as of Phase 4.10) are sentinel-guarded via AuditLog + idempotent + working in prod. They are NOT being retroactively converted — that would be busy work that adds zero value. Leave them alone. Going forward, just don't create new ones.

If a service-style migration ever needs to change, prefer rewriting it as a proper migration file under `migrations/` rather than editing the service.

## L-046 / L-048 / L-049 follow-ups

This bootstrap closes the deferred follow-up tracked since Phase 4.9.1. The defensive `ALTER ... TRY/CATCH` pattern that L-046 documents (and that every recent migration adopted) was a symptom of having no migration tracking. With `SequelizeMeta` populated, future migrations can declare their schema changes once and let Sequelize-cli decide whether to apply them.

## History

Two migration systems used to coexist here:
- **Homegrown** (`001_initial_schema.js`, `002_seed_data.js`, `migrate.js`) — deleted 2026-05-04 in favor of Sequelize CLI. Recover from git history if needed.
- **Sequelize CLI** (timestamp-prefixed files) — current.

The homegrown system used a `schema_migrations` table that also doesn't exist on prod. Both systems have been dormant since launch.
