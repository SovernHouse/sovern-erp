/**
 * Expense Exporters — Item 4d
 *
 * Two XLSX builders matching Alex's existing report templates:
 *
 *   expense_to_alex_v2   — single sheet, multi-currency columns, paid-batch
 *                          markers, per-currency totals at the bottom.
 *                          Mirrors "Expense To Alex YYYY.xlsx".
 *   inspector_travel_v2  — one sheet per inspector, columns matching the
 *                          existing "Travel expense application form -
 *                          旅行费用申请表" sheet, monthly subtotal rows,
 *                          single-currency CNY assumption.
 *                          Mirrors "Details of the inspector's travel
 *                          expenses YYYY.xlsx".
 *
 * Each builder returns an in-memory Buffer (XLSX bytes). The controller is
 * responsible for streaming that to Drive at
 *   "Sovern ERP / Expense reports / <office.code> / YYYY-MM/".
 */

const ExcelJS = require('exceljs');

const TEMPLATE_REGISTRY = {
  expense_to_alex_v2:   buildExpenseToAlexV2,
  inspector_travel_v2:  buildInspectorTravelV2,
  custom_csv:           buildCustomCsv,
};

/**
 * Pick the right builder by office.exportTemplateKey, then run it.
 * @param {object} args
 * @param {object} args.office   — ReimbursementOffice row
 * @param {object[]} args.expenses — array of Expense rows (Sequelize instances or plain objs)
 * @param {object[]} [args.trips]    — Trip rows for grouping/labelling
 * @param {object[]} [args.users]    — User rows (inspectors), keyed by id externally
 * @param {object} [args.submission] — ExpenseSubmission row for header info
 * @returns {Promise<{ buffer: Buffer, filename: string, contentType: string, templateKey: string }>}
 */
async function generateReport({ office, expenses, trips = [], users = [], submission }) {
  const key = office?.exportTemplateKey || null;
  const builder = key && TEMPLATE_REGISTRY[key];
  if (!builder) {
    throw Object.assign(new Error(
      key
        ? `Unknown export template "${key}" on office ${office.code}. Update office.exportTemplateKey to one of: ${Object.keys(TEMPLATE_REGISTRY).join(', ')}.`
        : `Office ${office?.code || '?'} has no exportTemplateKey set. Pick one of: ${Object.keys(TEMPLATE_REGISTRY).join(', ')} via PATCH /api/expense-offices/${office?.id}.`
    ), { statusCode: 412 });
  }
  return builder({ office, expenses: normaliseRows(expenses), trips: normaliseRows(trips), users: normaliseRows(users), submission });
}

function normaliseRows(rows) {
  return (rows || []).map(r => (r && typeof r.toJSON === 'function' ? r.toJSON() : r));
}

// ── Template 1: Expense To Alex V2 ───────────────────────────────────────────

async function buildExpenseToAlexV2({ office, expenses, submission }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sovern ERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('Unpaid Expense to Alex');

  // Title row
  const year = submission?.periodStart
    ? new Date(submission.periodStart).getFullYear()
    : new Date().getFullYear();
  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = `Unpaid Expense to Alex ${year}`;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'left' };
  ws.addRow([]);

  // Detect currencies present so columns match the source sheet shape
  const currencies = new Set(['USD']);
  for (const e of expenses) {
    if (e.originalCurrency) currencies.add(String(e.originalCurrency).toUpperCase());
  }
  // Stable order: common-first, then alphabetical
  const orderHint = ['RMB', 'CNY', 'THB', 'VND', 'TWD', 'USD'];
  const currencyCols = [
    ...orderHint.filter(c => currencies.has(c)),
    ...Array.from(currencies).filter(c => !orderHint.includes(c)).sort(),
  ];

  // Header
  const header = ['Date', 'Item', 'Description', ...currencyCols.map(c => `${c} Amount`)];
  const headerRow = ws.addRow(header);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };

  // Body — split into paid vs unpaid sections so the "above paid on..."
  // marker rows fall in the right place (matches the existing template).
  const sortedExpenses = [...expenses].sort((a, b) =>
    String(a.entryDate).localeCompare(String(b.entryDate)));

  // Group consecutive paid expenses with the same paidAt to insert one
  // marker row per paid batch (the existing template does this manually).
  let lastPaidAt = null;
  for (const e of sortedExpenses) {
    if (e.paidAt && e.paidAt !== lastPaidAt && lastPaidAt !== null) {
      addPaidMarker(ws, lastPaidAt, header.length);
    }
    lastPaidAt = e.paidAt || null;

    const row = [
      e.entryDate || null,
      e.category || '',
      e.description || '',
      ...currencyCols.map(c => {
        const ccy = (e.originalCurrency || '').toUpperCase();
        if (c === 'USD') return e.usdAmount != null ? Number(e.usdAmount) : null;
        return ccy === c ? Number(e.originalAmount) : null;
      }),
    ];
    ws.addRow(row);
  }
  // Trailing marker for the last paid batch
  if (lastPaidAt) addPaidMarker(ws, lastPaidAt, header.length);

  ws.addRow([]);

  // Total row — sum unpaid amounts per currency (paid rows already settled)
  const totalCells = ['Total Unpaid Amount', '', ''];
  for (const c of currencyCols) {
    let total = 0;
    for (const e of sortedExpenses) {
      if (e.paidAt) continue; // unpaid only for the total
      const ccy = (e.originalCurrency || '').toUpperCase();
      if (c === 'USD' && e.usdAmount != null) total += Number(e.usdAmount);
      else if (ccy === c) total += Number(e.originalAmount);
    }
    totalCells.push(Math.round(total * 100) / 100);
  }
  const totalRow = ws.addRow(totalCells);
  totalRow.font = { bold: true };

  // Column widths
  ws.getColumn(1).width = 12;  // Date
  ws.getColumn(2).width = 14;  // Item
  ws.getColumn(3).width = 50;  // Description
  for (let i = 4; i <= header.length; i++) ws.getColumn(i).width = 14;

  return {
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    filename: `Expense To Alex - ${office.code} - ${new Date().toISOString().slice(0, 10)}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    templateKey: 'expense_to_alex_v2',
  };
}

function addPaidMarker(ws, paidAt, colCount) {
  const row = ws.addRow([`The above expense has been paid on ${formatDate(paidAt)}`]);
  ws.mergeCells(row.number, 1, row.number, colCount);
  row.font = { italic: true, color: { argb: 'FF666666' } };
}

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return String(d);
  }
}

// ── Template 2: Inspector Travel V2 ──────────────────────────────────────────

async function buildInspectorTravelV2({ office, expenses, users }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sovern ERP';
  wb.created = new Date();

  // Group expenses by inspector. Rows without an inspectorId go into "Unassigned".
  const byInspector = new Map(); // inspectorId → []
  for (const e of expenses) {
    const key = e.inspectorId || '_unassigned';
    if (!byInspector.has(key)) byInspector.set(key, []);
    byInspector.get(key).push(e);
  }

  if (byInspector.size === 0) {
    // Empty workbook with a placeholder sheet so the file isn't malformed.
    const ws = wb.addWorksheet('summarizing');
    ws.addRow(['No inspector expenses in this submission.']);
  }

  const userById = new Map(users.map(u => [u.id, u]));

  for (const [inspectorId, rows] of byInspector.entries()) {
    const inspector = inspectorId === '_unassigned' ? null : userById.get(inspectorId);
    const sheetName = (inspector?.name || inspector?.email || 'Unassigned').slice(0, 31);
    const ws = wb.addWorksheet(sheetName);

    ws.mergeCells('A1:P1');
    ws.getCell('A1').value = 'Travel expense application form - 旅行费用申请表';
    ws.getCell('A1').font = { bold: true, size: 12 };
    ws.addRow([]);

    const header = [
      'Date 日期', 'Days 天数', 'Customer name 客户名称',
      'Factory 工厂名称', 'Factory location 工厂地点', 'Mode of transport 交通方式',
      'Customer order # 客户订单号', 'Factory contract # 合同编号',
      'Reason for travel 差旅事项', 'Product 产品', 'Container 集装箱',
      'Meal allowance 餐补', 'Travel fee 交通费', 'Hotel fee 住宿费',
      'PM 项目经理', 'Labour cost 人工费',
    ];
    const headerRow = ws.addRow(header);
    headerRow.font = { bold: true };
    headerRow.alignment = { wrapText: true, vertical: 'top' };

    // Sort by date, then group by month for subtotal rows
    rows.sort((a, b) => String(a.entryDate).localeCompare(String(b.entryDate)));
    let currentMonth = null;
    let monthlySubtotal = 0;
    let monthlyContainerCount = 0;

    for (const e of rows) {
      const month = String(e.entryDate).slice(0, 7); // YYYY-MM
      if (currentMonth && month !== currentMonth) {
        addMonthlySubtotalRow(ws, currentMonth, monthlySubtotal, monthlyContainerCount);
        monthlySubtotal = 0;
        monthlyContainerCount = 0;
      }
      currentMonth = month;

      // The expense entity doesn't carry every field of the legacy template;
      // we map what's available and leave the rest blank so the row shape
      // still matches.
      ws.addRow([
        e.entryDate || null,
        1,                                          // Days — not modelled; default 1
        '',                                         // Customer name (resolved by FK; placeholder if unloaded)
        '',                                         // Factory
        '',                                         // Factory location
        '',                                         // Mode of transport
        '',                                         // Customer order #
        '',                                         // Factory contract #
        e.description || 'Inspection',              // Reason
        '',                                         // Product
        '',                                         // Container — would need a separate model
        '',                                         // Meal allowance — could derive from category
        e.category === 'Travel' ? Number(e.originalAmount) : '',
        e.category === 'Hotel' ? Number(e.originalAmount) : '',
        '',                                         // PM
        Number(e.originalAmount) || '',             // Labour cost — full amount as a fallback
      ]);
      monthlySubtotal += Number(e.originalAmount) || 0;
    }
    if (currentMonth) addMonthlySubtotalRow(ws, currentMonth, monthlySubtotal, monthlyContainerCount);

    // Column widths
    ws.getColumn(1).width = 12;
    ws.getColumn(2).width = 6;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 16;
    ws.getColumn(5).width = 16;
    ws.getColumn(9).width = 30;
    for (let i = 12; i <= 16; i++) ws.getColumn(i).width = 12;
  }

  return {
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    filename: `Inspector travel expenses - ${office.code} - ${new Date().toISOString().slice(0, 10)}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    templateKey: 'inspector_travel_v2',
  };
}

function addMonthlySubtotalRow(ws, monthYYYYMM, total, containerCount) {
  const row = ws.addRow([
    monthYYYYMM + ' Total', '', '', '', '', '', '', '', '', '', containerCount, '', '', '', '', Math.round(total * 100) / 100,
  ]);
  row.font = { bold: true };
}

// ── Template 3: Custom CSV (catch-all) ───────────────────────────────────────

async function buildCustomCsv({ office, expenses }) {
  const lines = [
    'date,category,description,originalCurrency,originalAmount,usdAmount,paidAt,customerId,factoryId,inspectorId',
  ];
  for (const e of expenses) {
    const fields = [
      e.entryDate || '',
      csvEscape(e.category || ''),
      csvEscape(e.description || ''),
      e.originalCurrency || '',
      e.originalAmount ?? '',
      e.usdAmount ?? '',
      e.paidAt || '',
      e.customerId || '',
      e.factoryId || '',
      e.inspectorId || '',
    ];
    lines.push(fields.join(','));
  }
  return {
    buffer: Buffer.from(lines.join('\n'), 'utf8'),
    filename: `Expenses - ${office.code} - ${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: 'text/csv',
    templateKey: 'custom_csv',
  };
}

function csvEscape(s) {
  const v = String(s ?? '');
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

module.exports = {
  generateReport,
  TEMPLATE_REGISTRY: Object.keys(TEMPLATE_REGISTRY),
};
