/**
 * Brand-filter utilities for dashboards / analytics / reports (Phase 3, C11).
 *
 * Sits on top of the brandScope middleware. brandScope tells us *what
 * the user is allowed to see* (their accessibleBrands list). On
 * dashboards we additionally want to *narrow* that to a single brand for
 * the picker, via `?brandCode=X` query string.
 *
 * Single-brand users: the picker is hidden and ?brandCode is ignored;
 * scope is always their one brand. Multi-brand users: the picker passes
 * `?brandCode=FW` to focus or omits it to see all accessible brands.
 * Super_admin in cross-brand viewMode: brandScope.where is `{}` and
 * ?brandCode further narrows.
 *
 * Use this in any handler that does a Sequelize query whose model has a
 * brandCode column:
 *
 *     const where = { ...brandWhere(req), status: 'paid' };
 *     await db.Invoice.count({ where });
 *
 * For raw SQL, use the SQL-shape helper:
 *
 *     const { sql, params } = brandWhereSql(req, 'so');
 *     // sql is e.g. " AND so.brand_code IN (?, ?)" — empty string if no filter
 */

const { Op } = require('sequelize');

/**
 * Return a partial Sequelize `where` clause that narrows by brand. Caller
 * spreads it into their full where: `{ ...brandWhere(req), status: 'X' }`.
 *
 * Resolution order:
 *   1. ?brandCode in query (only honored if the brand is in accessibleBrands
 *      OR the user is super_admin in cross-brand mode).
 *   2. brandScope.where from the middleware (the accessibleBrands filter).
 *   3. Empty object (no filter) — should be unreachable in practice because
 *      brandScope always populates accessibleBrands.
 */
function brandWhere(req) {
  const scope = req.brandScope;
  const queried = req.query?.brandCode;

  if (queried) {
    const accessible = scope?.accessibleBrands || [];
    const allowed = scope?.isCrossBrand || accessible.includes(queried);
    if (allowed) return { brandCode: queried };
    // If the user requested a brand they can't access, fall through to
    // the safer scoped filter rather than silently broadening.
  }

  if (scope?.where) return { ...scope.where };
  return {};
}

/**
 * For raw SQL: returns an additive SQL fragment + replacement values for
 * narrowing by brand. Always starts with " AND " when non-empty so it
 * can splice into an existing WHERE clause.
 *
 *   const { sql, replacements } = brandWhereSql(req, 'so');
 *   const query = `SELECT * FROM SalesOrder so WHERE 1=1 ${sql}`;
 *   await db.sequelize.query(query, { replacements, type: 'SELECT' });
 *
 * @param {string} tableAlias  e.g. 'so' or 'c'.
 * @param {string} [columnName='brand_code']  Snake-case column. SQLite stores
 *   Sequelize STRING(8) as the underlying column name; default matches the
 *   freezeTableName + underscored convention used in this codebase.
 */
function brandWhereSql(req, tableAlias, columnName = 'brand_code') {
  const scope = req.brandScope;
  const queried = req.query?.brandCode;
  const col = `${tableAlias}.${columnName}`;

  if (queried) {
    const accessible = scope?.accessibleBrands || [];
    const allowed = scope?.isCrossBrand || accessible.includes(queried);
    if (allowed) return { sql: ` AND ${col} = ?`, replacements: [queried] };
  }

  if (scope?.isCrossBrand) return { sql: '', replacements: [] };

  const accessible = scope?.accessibleBrands || ['SH'];
  if (accessible.length === 1) {
    return { sql: ` AND ${col} = ?`, replacements: [accessible[0]] };
  }
  const placeholders = accessible.map(() => '?').join(', ');
  return { sql: ` AND ${col} IN (${placeholders})`, replacements: accessible };
}

/**
 * Customer queries are special: Customer.brandRelationships is a JSON
 * array (per L-023, raw, no JSON.stringify), so SQLite can't do a
 * straightforward IN/= filter on it. Use this to post-filter results in
 * application code. Use it after the query, not in the where clause:
 *
 *   let rows = await db.Customer.findAll();
 *   rows = filterCustomersByBrand(rows, req);
 *
 * Pass-through for super_admin in cross-brand mode (no filter).
 */
function filterCustomersByBrand(customers, req) {
  const scope = req.brandScope;
  const queried = req.query?.brandCode;

  let allowed = null;
  if (queried) {
    const accessible = scope?.accessibleBrands || [];
    if (scope?.isCrossBrand || accessible.includes(queried)) {
      allowed = new Set([queried]);
    }
  }
  if (!allowed) {
    if (scope?.isCrossBrand) return customers;
    allowed = new Set(scope?.accessibleBrands || ['SH']);
  }

  return customers.filter(c => {
    const rels = Array.isArray(c.brandRelationships) ? c.brandRelationships : ['SH'];
    return rels.some(r => allowed.has(r));
  });
}

module.exports = { brandWhere, brandWhereSql, filterCustomersByBrand };
