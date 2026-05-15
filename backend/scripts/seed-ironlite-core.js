#!/usr/bin/env node
/**
 * seed-ironlite-core.js — One-shot seed for the 9 IronLite Core SKUs
 * (FW brand, multi-origin via HanHua/CN + FlorWay/MY).
 *
 * SCOPE
 *   Creates 9 Product rows + 18 ProductPrice rows under the
 *   "Engineered SPC" ProductCategory. Idempotent, transactional,
 *   dry-run capable. Designed to be run ONCE against the live VM DB
 *   per factory quote drop.
 *
 * SECRETS HANDLING (repo is public)
 *   Factory cost prices are NOT hardcoded. They are read from an
 *   external XLSX whose path is passed via --file. The XLSX lives
 *   outside the repo (suggested location /home/alex/quotes/ on the
 *   VM). Console output is restricted to:
 *     - SKU strings (already public — they describe plank geometry)
 *     - Origin labels (China / Malaysia)
 *     - Counts (9 products, 18 prices)
 *     - LANDED-price RANGES (low–high) summarised across the family
 *   The script never echoes a per-SKU cost or landed figure.
 *
 * USAGE
 *   1. scp the HanHua quote XLSX from the Windows host to the VM:
 *        scp hanhua-ironlite-2026-05-14.xlsx \
 *          alex@<vm>:/home/alex/quotes/
 *   2. Dry-run preview (no writes):
 *        node backend/scripts/seed-ironlite-core.js \
 *          --file /home/alex/quotes/hanhua-ironlite-2026-05-14.xlsx \
 *          --dry-run
 *   3. Review SKU list + landed-price ranges, then execute for real:
 *        node backend/scripts/seed-ironlite-core.js \
 *          --file /home/alex/quotes/hanhua-ironlite-2026-05-14.xlsx
 *   4. Delete the XLSX from /home/alex/quotes/ after a clean run
 *      (or move it to a permanent off-repo audit folder).
 *
 * EXIT CODES
 *    0  success or dry-run printed
 *    1  preflight/input failure — no writes attempted
 *    2  transaction rolled back mid-run — DB unchanged
 *
 * SPREADSHEET CONTRACT  (sheet 1, rows 8..16, cols A..Q)
 *    A  size string, e.g. "7 x 48 x 5mm". If multiple thicknesses are
 *       listed ("9 x 60 x 6/7mm"), each thickness becomes a separate
 *       Product per the spec ("do not collapse").
 *    D  pieces per box
 *    E  boxes per pallet
 *    F  pallets per container
 *    M  USD/m² ex-factory cost — China origin (Anhui HanHua)
 *    N  USD/m² ex-factory cost — Malaysia origin (FlorWay)
 *    O  m²/box
 *    P  m²/pallet
 *    Q  m²/container
 *
 * The script does NOT read columns B/C (sqft cost variants) — m² is
 * canonical storage per Phase 4.9.2b ProductPrice.costPriceUsdPerM2.
 * Wear-layer mil is not in column A on this sheet; the field is
 * stored as null and flagged in the report so Alex can fill it in
 * after seeding.
 *
 * TARIFFS (public, hardcoded)
 *    CN→US 40.7714%  per HanHua note 2026-05-14
 *    MY→US 15.5214%  per HanHua note 2026-05-14
 *    validFrom 2026-05-14  validTo 2026-05-15
 *
 * FUTURE DIRECTION
 *   See DEVELOPER_GUIDE §15.5 — this is a tactical script. A bulk
 *   import admin UI for factory quote drops is the right long-term
 *   solution and is filed as a separate phase.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const ExcelJS = require('exceljs');
const db = require('../models');

// ── Constants (public; safe to commit) ─────────────────────────────────────
const CN_TARIFF = 0.407714;
const MY_TARIFF = 0.155214;
const VALID_FROM = '2026-05-14';
const VALID_TO = '2026-05-15';
const TARIFF_DEST = 'USA';
const MARKUP = 0.07;
const SHEET_INDEX = 0; // first sheet in workbook
const ROW_START = 8;
const ROW_END = 16;

const HANHUA_NAME = 'Anhui HanHua Building Materials Technology Co., Ltd.';
const FLORWAY_NAME = 'FlorWay SDN. BHD.';

const COMMON_SPECS = Object.freeze({
  productSubType: 'IronLite Core',
  constructionType: 'SPC outer + WPC middle + SPC outer (three-layer sandwich)',
  fullBuildDescription:
    'UV coating, wear layer, décor paper, vinyl top, IronLite Core (three-layer SPC/WPC/SPC sandwich), 1mm IXPE underlay bonded to back.',
  ironliteBadged: true,
  defaultCommissionRate: 0.07,
  densityKgPerCbm: 1200,
  shrinkageHorizontalPercent: 0.10,
  shrinkageVerticalPercent: 0.10,
  shrinkageTestStandard: 'ISO 23999:2021',
  weightAdvantagePercentVsConventionalSpc: 41,
  stabilityAdvantagePercentVsConventionalWpc: 50,
  underlayAttached: '1mm IXPE',
});

// ── CLI ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { file: null, dryRun: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' && argv[i + 1]) {
      args.file = argv[++i];
    } else if (a.startsWith('--file=')) {
      args.file = a.split('=').slice(1).join('=');
    } else if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '-h' || a === '--help') {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`usage: node backend/scripts/seed-ironlite-core.js --file <PATH-TO-XLSX> [--dry-run]

  --file        Absolute path to the HanHua quote XLSX (kept outside the repo).
  --dry-run     Parse + preflight only. Prints the SKU plan; performs no writes.
  -h, --help    Show this help.

Costs are read from the file; nothing in this script knows the per-SKU number.`);
}

// ── XLSX helpers ───────────────────────────────────────────────────────────
function readCellString(row, colLetter) {
  const cell = row.getCell(colLetter);
  if (!cell) return null;
  const v = cell.value;
  if (v == null || v === '') return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && v.result != null) return String(v.result);
  if (typeof v === 'object' && typeof v.text === 'string') return v.text.trim() || null;
  if (typeof v === 'object' && Array.isArray(v.richText)) {
    return v.richText.map(r => r.text).join('').trim() || null;
  }
  return String(v);
}

function readCellNumber(row, colLetter) {
  const cell = row.getCell(colLetter);
  if (!cell) return null;
  const v = cell.value;
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.result != null) {
    const n = Number(v.result);
    return Number.isFinite(n) ? n : null;
  }
  const s = String(v).replace(/[$,\s]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// "7 x 48 x 5mm" -> [{w:7, l:48, t:5}]
// "9 x 60 x 6/7mm" -> [{w:9, l:60, t:6}, {w:9, l:60, t:7}]
// "7 x 48 x 5,6mm" -> [{w:7, l:48, t:5}, {w:7, l:48, t:6}]
function parseSizeString(s) {
  if (!s) return [];
  const cleaned = String(s).trim().toLowerCase().replace(/['"”″]/g, '').replace(/\s+/g, '');
  const m = cleaned.match(/^([0-9.]+)x([0-9.]+)x([0-9./,]+)mm$/);
  if (!m) return [];
  const w = parseFloat(m[1]);
  const l = parseFloat(m[2]);
  const thicknessPart = m[3];
  const thicknesses = thicknessPart
    .split(/[/,]/)
    .map(t => parseFloat(t))
    .filter(t => Number.isFinite(t));
  if (!Number.isFinite(w) || !Number.isFinite(l) || thicknesses.length === 0) return [];
  return thicknesses.map(t => ({ w, l, t }));
}

function numToToken(n) {
  // Integer → "7", decimal → "5p5" (period replaced with 'p' so SKU stays
  // ASCII identifier-safe).
  return Number.isInteger(n) ? String(n) : String(n).replace('.', 'p');
}

function formatSku({ w, l, t }) {
  return `IL-${numToToken(w)}x${numToToken(l)}-${numToToken(t)}mm`;
}

function formatName({ w, l, t }) {
  return `IronLite Core ${w} x ${l} x ${t}mm Engineered SPC`;
}

function formatDescription({ w, l, t }) {
  return (
    `IronLite Core engineered SPC flooring, ${w}" x ${l}" plank, ${t}mm total. ` +
    `Three-layer rigid core construction: SPC outer wear layers sandwiching a WPC ` +
    `middle layer for impact dampening and acoustic performance. Bonded 1mm IXPE ` +
    `underlay eliminates the need for separate underlayment SKU. Approximately 41% ` +
    `lighter than conventional single-layer SPC and roughly half the dimensional ` +
    `shrinkage of conventional WPC under ISO 23999 heat cycling. Available from ` +
    `FlorWay Sdn. Bhd. (Malaysia) or Anhui HanHua (China).`
  );
}

function fmtRange(arr) {
  if (!arr.length) return 'n/a';
  const lo = Math.min(...arr);
  const hi = Math.max(...arr);
  return `$${lo.toFixed(2)} – $${hi.toFixed(2)} USD/m²`;
}

// ── Preflight ──────────────────────────────────────────────────────────────
async function runPreflight() {
  const failures = [];
  const warnings = [];

  // Categories. Spec: Flooring > Resilient (sortOrder 2) > Engineered SPC (sortOrder 3).
  const flooring = await db.ProductCategory.findOne({
    where: { name: 'Flooring', parentId: null },
  });
  if (!flooring) {
    failures.push('Flooring root ProductCategory not found.');
  }

  let resilient = null;
  if (flooring) {
    resilient = await db.ProductCategory.findOne({
      where: { name: 'Resilient', parentId: flooring.id },
    });
    if (!resilient) failures.push('Resilient ProductCategory not under Flooring.');
    else if (resilient.sortOrder !== 2) {
      warnings.push(`Resilient.sortOrder=${resilient.sortOrder} (spec expected 2).`);
    }
  }

  let engineeredSpc = null;
  if (resilient) {
    engineeredSpc = await db.ProductCategory.findOne({
      where: { name: 'Engineered SPC', parentId: resilient.id },
    });
    if (!engineeredSpc) {
      failures.push('Engineered SPC ProductCategory not under Flooring > Resilient.');
    } else if (engineeredSpc.sortOrder !== 3) {
      warnings.push(`Engineered SPC.sortOrder=${engineeredSpc.sortOrder} (spec expected 3).`);
    }
  }

  // Brand
  const fwBrand = await db.Brand.findOne({ where: { code: 'FW' } });
  if (!fwBrand) {
    failures.push('FW Brand row not found.');
  } else {
    if (Number(fwBrand.commissionRate) !== 0.07) {
      failures.push(
        `FW.commissionRate=${fwBrand.commissionRate} (spec expected 0.0700). ` +
          'Update the Brand row before seeding.'
      );
    }
    if (!fwBrand.active) failures.push('FW Brand is not active.');
  }

  // Factories
  const hanhua = await db.Factory.findOne({ where: { companyName: HANHUA_NAME } });
  if (!hanhua) {
    failures.push(`Factory "${HANHUA_NAME}" not found.`);
  } else if (hanhua.brandCode !== 'FW') {
    failures.push(`HanHua.brandCode=${hanhua.brandCode} (spec expected FW).`);
  }

  const florway = await db.Factory.findOne({ where: { companyName: FLORWAY_NAME } });
  if (!florway) {
    failures.push(`Factory "${FLORWAY_NAME}" not found.`);
  } else if (florway.brandCode !== 'FW') {
    failures.push(`FlorWay.brandCode=${florway.brandCode} (spec expected FW).`);
  }

  // Phase 4.9.2 ProductPrice schema sanity
  const pp = db.ProductPrice.rawAttributes;
  const required = [
    'factoryId',
    'origin',
    'costPriceUsdPerM2',
    'costPriceUsdPerSqft',
    'markupPercent',
    'tariffRate',
    'tariffDestination',
    'landedPriceUsdPerM2',
    'validFrom',
    'validTo',
    'sourceNote',
  ];
  const ppMissing = required.filter(f => !pp[f]);
  // costPriceUsdPerSqft / landedPriceUsdPerM2 are SPEC-NAMED but may be
  // virtual/computed accessors rather than columns. Treat missing virtuals as
  // a warning, not a hard failure, since the live row math still works as
  // long as the four authoritative fields exist.
  for (const f of ppMissing) {
    if (f === 'costPriceUsdPerSqft' || f === 'landedPriceUsdPerM2') {
      warnings.push(
        `ProductPrice.${f} not present as a column/virtual — computing on the fly is OK.`
      );
    } else {
      failures.push(`ProductPrice missing field ${f}.`);
    }
  }
  if (pp.factoryId && pp.factoryId.allowNull !== true) {
    warnings.push('ProductPrice.factoryId not nullable as Phase 4.9.2 spec implies.');
  }

  // Existing IL-* SKUs
  const existingIl = await db.Product.findAll({
    where: { sku: { [db.Sequelize.Op.like]: 'IL-%' } },
    attributes: ['id', 'sku', 'brandCode'],
  });
  if (existingIl.length > 0) {
    failures.push(
      `${existingIl.length} existing IL-* SKU(s) detected — refusing to seed (idempotency guard):`
    );
    for (const p of existingIl) {
      failures.push(`    - ${p.sku} (${p.brandCode}) id=${p.id}`);
    }
  }

  return { failures, warnings, refs: { engineeredSpc, hanhua, florway, fwBrand } };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (!args.file) {
    printHelp();
    console.error('\n[seed-ironlite-core] ERROR: --file is required.');
    process.exit(1);
  }

  const filePath = path.resolve(args.file);
  console.log(`[seed-ironlite-core] file=${filePath} dryRun=${args.dryRun}`);

  await db.sequelize.authenticate();
  console.log('[seed-ironlite-core] db connected.');

  // ── Preflight ────────────────────────────────────────────────────────────
  const { failures, warnings, refs } = await runPreflight();
  for (const w of warnings) console.warn(`[seed-ironlite-core] WARN: ${w}`);
  if (failures.length > 0) {
    console.error('[seed-ironlite-core] PREFLIGHT FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error('[seed-ironlite-core] No writes performed.');
    process.exit(1);
  }
  console.log('[seed-ironlite-core] preflight OK.');

  // ── Parse XLSX ───────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[SHEET_INDEX];
  if (!ws) {
    console.error(`[seed-ironlite-core] ERROR: sheet index ${SHEET_INDEX} not found.`);
    process.exit(1);
  }

  const planned = [];
  const skippedRows = [];

  for (let r = ROW_START; r <= ROW_END; r++) {
    const row = ws.getRow(r);
    const sizeRaw = readCellString(row, 'A');
    if (!sizeRaw) {
      skippedRows.push({ row: r, reason: 'col A empty (no size)' });
      continue;
    }
    const dimsList = parseSizeString(sizeRaw);
    if (dimsList.length === 0) {
      skippedRows.push({ row: r, reason: `unparseable size "${sizeRaw}"` });
      continue;
    }

    const piecesPerBox = readCellNumber(row, 'D');
    const boxesPerPallet = readCellNumber(row, 'E');
    const palletsPerContainer = readCellNumber(row, 'F');
    const costCn = readCellNumber(row, 'M');
    const costMy = readCellNumber(row, 'N');
    const m2PerBox = readCellNumber(row, 'O');
    const m2PerPallet = readCellNumber(row, 'P');
    const m2PerContainer = readCellNumber(row, 'Q');

    const missingFields = [];
    if (piecesPerBox == null) missingFields.push('D');
    if (boxesPerPallet == null) missingFields.push('E');
    if (palletsPerContainer == null) missingFields.push('F');
    if (costCn == null) missingFields.push('M');
    if (costMy == null) missingFields.push('N');
    if (m2PerBox == null) missingFields.push('O');
    if (m2PerPallet == null) missingFields.push('P');
    if (m2PerContainer == null) missingFields.push('Q');
    if (missingFields.length > 0) {
      skippedRows.push({
        row: r,
        reason: `missing required columns: ${missingFields.join(', ')}`,
      });
      continue;
    }

    for (const dims of dimsList) {
      planned.push({
        sourceRow: r,
        sizeRaw,
        dims,
        sku: formatSku(dims),
        name: formatName(dims),
        description: formatDescription(dims),
        piecesPerBox,
        boxesPerPallet,
        palletsPerContainer,
        m2PerBox,
        m2PerPallet,
        m2PerContainer,
        costCn,
        costMy,
        wearLayerMil: null, // spec: not present in col A on this sheet
      });
    }
  }

  // SKU collision within the parsed plan
  const skuSet = new Set();
  const dupSkus = [];
  for (const p of planned) {
    if (skuSet.has(p.sku)) dupSkus.push(p.sku);
    skuSet.add(p.sku);
  }

  if (skippedRows.length > 0 || dupSkus.length > 0) {
    console.error('[seed-ironlite-core] STOP: source data incomplete:');
    for (const s of skippedRows) console.error(`  - row ${s.row}: ${s.reason}`);
    for (const d of dupSkus) console.error(`  - duplicate SKU within plan: ${d}`);
    console.error('[seed-ironlite-core] No writes performed.');
    process.exit(1);
  }

  console.log(`[seed-ironlite-core] parsed ${planned.length} product rows from rows ${ROW_START}..${ROW_END}.`);
  console.log('[seed-ironlite-core] SKU plan:');
  for (const p of planned) {
    console.log(`  - ${p.sku}  (source row ${p.sourceRow})`);
  }

  // Landed price RANGE preview (low/high only; never per-SKU).
  const cnLandeds = planned.map(p => p.costCn * (1 + MARKUP) * (1 + CN_TARIFF));
  const myLandeds = planned.map(p => p.costMy * (1 + MARKUP) * (1 + MY_TARIFF));
  console.log(`[seed-ironlite-core] preview landed (China,   incl. tariff): ${fmtRange(cnLandeds)}`);
  console.log(`[seed-ironlite-core] preview landed (Malaysia,incl. tariff): ${fmtRange(myLandeds)}`);

  if (args.dryRun) {
    console.log('[seed-ironlite-core] DRY RUN — no writes performed.');
    console.log(`  Plan: ${planned.length} Products + ${planned.length * 2} ProductPrice rows.`);
    console.log(`  Category: Engineered SPC (${refs.engineeredSpc.id}), brandCode=FW.`);
    console.log(`  ProductPrice China  factoryId=${refs.hanhua.id}  origin=China   tariff=${CN_TARIFF}`);
    console.log(`  ProductPrice Malaysia factoryId=${refs.florway.id} origin=Malaysia tariff=${MY_TARIFF}`);
    console.log(`  validFrom=${VALID_FROM} validTo=${VALID_TO} markup=${MARKUP} sellingPrice=null`);
    process.exit(0);
  }

  // ── Transaction ──────────────────────────────────────────────────────────
  const t = await db.sequelize.transaction();
  const productSummaries = [];
  const priceSummaries = [];
  try {
    for (const p of planned) {
      const product = await db.Product.create(
        {
          brandCode: 'FW',
          sku: p.sku,
          name: p.name,
          description: p.description,
          salesDescription: p.description,
          categoryId: refs.engineeredSpc.id,
          // Product.factoryId is NOT NULL. Use HanHua as the originating
          // factory record; per-origin pricing lives on ProductPrice
          // rows (Phase 4.9.2b). The Malaysia-origin price wins the
          // baseFobPrice cache because it is saved second (see below).
          factoryId: refs.hanhua.id,
          unit: 'sqm',
          productType: 'spc',
          currency: 'USD',
          moqUnit: 'sqm',
          minOrderQty: p.m2PerContainer, // 1 full container as the practical floor
          originCountry: null, // truly multi-origin; per-row origin lives on ProductPrice
          certifications: [],
          images: [],
          specifications: {
            ...COMMON_SPECS,
            plankWidthInches: p.dims.w,
            plankLengthInches: p.dims.l,
            totalThicknessMm: p.dims.t,
            wearLayerMil: p.wearLayerMil,
            piecesPerBox: p.piecesPerBox,
            boxesPerPallet: p.boxesPerPallet,
            palletsPerContainer: p.palletsPerContainer,
            m2PerBox: p.m2PerBox,
            m2PerPallet: p.m2PerPallet,
            m2PerContainer: p.m2PerContainer,
          },
          isActive: true,
        },
        { transaction: t }
      );

      // China FIRST — the afterSave hook updates Product.baseFobPrice.
      const cnRow = await db.ProductPrice.create(
        {
          productId: product.id,
          factoryId: refs.hanhua.id,
          origin: 'China',
          costPriceUsdPerM2: p.costCn,
          markupPercent: MARKUP,
          sellingPriceUsdPerM2: null,
          currency: 'USD',
          tariffRate: CN_TARIFF,
          tariffDestination: TARIFF_DEST,
          validFrom: VALID_FROM,
          validTo: VALID_TO,
          sourceNote:
            'Per Anhui HanHua factory quotation dated May 14 2026. China-origin reciprocal ' +
            'tariff rate per HanHua note; recheck with customs broker before re-quoting on ' +
            'or after May 16 2026.',
        },
        { transaction: t }
      );

      // Malaysia SECOND — overwrites baseFobPrice cache so the default
      // origin reflects the primary outreach pitch (per spec Part C).
      const myRow = await db.ProductPrice.create(
        {
          productId: product.id,
          factoryId: refs.florway.id,
          origin: 'Malaysia',
          costPriceUsdPerM2: p.costMy,
          markupPercent: MARKUP,
          sellingPriceUsdPerM2: null,
          currency: 'USD',
          tariffRate: MY_TARIFF,
          tariffDestination: TARIFF_DEST,
          validFrom: VALID_FROM,
          validTo: VALID_TO,
          sourceNote:
            'Per FlorWay/HanHua factory quotation dated May 14 2026. Malaysia-origin tariff ' +
            'rate per HanHua note. Note that broader US tariff regime is in legal flux as of ' +
            'May 2026 (Section 122 CIT injunction May 7); recheck with customs broker before ' +
            're-quoting on or after May 16 2026.',
        },
        { transaction: t }
      );

      productSummaries.push({
        id: product.id,
        sku: product.sku,
        name: product.name,
        w: p.dims.w,
        l: p.dims.l,
        thickness: p.dims.t,
      });
      priceSummaries.push({ id: cnRow.id, sku: product.sku, origin: 'China', factory: HANHUA_NAME });
      priceSummaries.push({ id: myRow.id, sku: product.sku, origin: 'Malaysia', factory: FLORWAY_NAME });
    }

    await t.commit();
  } catch (e) {
    try {
      await t.rollback();
    } catch (_) {
      /* ignore rollback error */
    }
    console.error('[seed-ironlite-core] FATAL: transaction rolled back —', e.message);
    if (process.env.DEBUG) console.error(e.stack);
    process.exit(2);
  }

  // ── baseFobPrice reconciliation ──────────────────────────────────────────
  // Sanity check: the afterSave hook should have left baseFobPrice at the
  // Malaysia-origin selling price (cost * 1.07). If a hook firing order
  // edge case put China there instead, fix manually.
  let manualFixes = 0;
  const fixedSkus = [];
  for (const ps of productSummaries) {
    const product = await db.Product.findByPk(ps.id);
    const myPrice = await db.ProductPrice.findOne({
      where: { productId: ps.id, origin: 'Malaysia' },
    });
    if (!myPrice) continue;
    const expected = Math.round(Number(myPrice.costPriceUsdPerM2) * (1 + MARKUP) * 100) / 100;
    const actual = product.baseFobPrice == null ? null : Math.round(Number(product.baseFobPrice) * 100) / 100;
    if (actual !== expected) {
      await product.update({ baseFobPrice: expected });
      manualFixes++;
      fixedSkus.push(ps.sku);
    }
  }

  // ── Output ───────────────────────────────────────────────────────────────
  const family = await db.Product.findAll({
    where: { sku: { [db.Sequelize.Op.like]: 'IL-%' } },
    attributes: ['id', 'sku', 'name', 'baseFobPrice', 'categoryId', 'brandCode'],
    order: [['sku', 'ASC']],
  });
  const familyPriceRows = await db.ProductPrice.findAll({
    where: { productId: family.map(p => p.id) },
    attributes: ['id', 'productId', 'origin', 'factoryId', 'costPriceUsdPerM2', 'tariffRate', 'markupPercent'],
  });

  // Compute landed RANGE only — never per SKU.
  const allLanded = familyPriceRows.map(r => {
    const cost = Number(r.costPriceUsdPerM2);
    const tariff = Number(r.tariffRate || 0);
    const markup = Number(r.markupPercent || 0);
    return cost * (1 + markup) * (1 + tariff);
  });
  const cnLandedFinal = familyPriceRows
    .filter(r => r.origin === 'China')
    .map(r => Number(r.costPriceUsdPerM2) * (1 + Number(r.markupPercent || 0)) * (1 + Number(r.tariffRate || 0)));
  const myLandedFinal = familyPriceRows
    .filter(r => r.origin === 'Malaysia')
    .map(r => Number(r.costPriceUsdPerM2) * (1 + Number(r.markupPercent || 0)) * (1 + Number(r.tariffRate || 0)));

  console.log('');
  console.log('=== seed-ironlite-core RESULT ===');
  console.log(`Products created:           ${productSummaries.length}`);
  console.log(`ProductPrice rows created:  ${priceSummaries.length}`);
  console.log(`baseFobPrice manual fixes:  ${manualFixes}${fixedSkus.length ? ' (' + fixedSkus.join(', ') + ')' : ''}`);
  console.log(`Landed USD/m² range (all):       ${fmtRange(allLanded)}`);
  console.log(`Landed USD/m² range (China):     ${fmtRange(cnLandedFinal)}`);
  console.log(`Landed USD/m² range (Malaysia):  ${fmtRange(myLandedFinal)}`);
  console.log('');
  console.log('Products (id, sku, plank, thickness):');
  for (const ps of productSummaries) {
    console.log(`  ${ps.sku}   ${ps.w}" x ${ps.l}"   ${ps.thickness}mm   ${ps.id}`);
  }
  console.log('');
  console.log('ProductPrice rows (id, sku, origin, factory):');
  for (const pr of priceSummaries) {
    console.log(`  ${pr.id}  ${pr.sku.padEnd(16)}  ${pr.origin.padEnd(8)}  ${pr.factory}`);
  }

  // Wear-layer mil flag
  const missingWear = productSummaries.length; // all are null by design
  console.log('');
  console.log(`NOTE: wearLayerMil was not present in column A on the source sheet; all ${missingWear} ` +
    `Products were written with specifications.wearLayerMil=null. Update each via the admin ` +
    `Product Catalog page once the wear-layer column is locked.`);

  process.exit(0);
}

main().catch(e => {
  console.error('[seed-ironlite-core] FATAL:', e.message);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});
