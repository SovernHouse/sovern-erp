// Phase 4.15c-2 — Quality / inspection service tests.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

const svc = require('../../services/aiWriteServices/inspectionWriteService');

describe('Phase 4.15c-2 — inspectionWriteService', () => {
  let db, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  // ── scheduleInspection ─────────────────────────────────────────────

  describe('scheduleInspection', () => {
    it('happy path creates a scheduled inspection with auto-generated number', async () => {
      const r = await svc.scheduleInspection({
        type: 'pre_shipment',
        factoryId: testData.factory.id,
        inspectorId: testData.admin.id,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.inspection.status).toBe('scheduled');
      expect(r.inspection.type).toBe('pre_shipment');
      expect(r.inspection.inspectionNumber).toMatch(/^INS-\d+-[A-Z0-9]+$/);
    });

    it('rejects unknown type', async () => {
      const r = await svc.scheduleInspection({
        type: 'random_audit',
        factoryId: testData.factory.id,
        inspectorId: testData.admin.id,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/type/);
    });

    it('404s on unknown factoryId', async () => {
      const r = await svc.scheduleInspection({
        type: 'pre_shipment',
        factoryId: uuidv4(),
        inspectorId: testData.admin.id,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
      expect(r.message).toMatch(/Factory/);
    });

    it('404s on unknown inspectorId', async () => {
      const r = await svc.scheduleInspection({
        type: 'pre_shipment',
        factoryId: testData.factory.id,
        inspectorId: uuidv4(),
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
      expect(r.message).toMatch(/Inspector/);
    });

    it('409s on duplicate inspectionNumber', async () => {
      const number = `INS-DUP-${uuidv4().slice(0, 6)}`;
      await svc.scheduleInspection({
        type: 'pre_shipment',
        factoryId: testData.factory.id,
        inspectorId: testData.admin.id,
        inspectionNumber: number,
      }, { userId: testData.admin.id });
      const second = await svc.scheduleInspection({
        type: 'loading',
        factoryId: testData.factory.id,
        inspectorId: testData.admin.id,
        inspectionNumber: number,
      }, { userId: testData.admin.id });
      expect(second.ok).toBe(false);
      expect(second.httpStatus).toBe(409);
    });
  });

  // ── state machine: start → complete ────────────────────────────────

  describe('start + complete + state machine', () => {
    let insId;

    beforeAll(async () => {
      const r = await svc.scheduleInspection({
        type: 'during_production',
        factoryId: testData.factory.id,
        inspectorId: testData.admin.id,
      }, { userId: testData.admin.id });
      insId = r.inspection.id;
    });

    it('start: scheduled → in_progress', async () => {
      const r = await svc.startInspection(insId, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.after.status).toBe('in_progress');
      expect(r.before.status).toBe('scheduled');
    });

    it('start rejects when already in_progress', async () => {
      const r = await svc.startInspection(insId, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/scheduled/);
    });

    it('complete: in_progress → passed when overall_result=pass', async () => {
      const r = await svc.completeInspection(insId, {
        overallResult: 'pass',
        notes: 'All checks cleared.',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.after.status).toBe('passed');
      expect(r.after.overallResult).toBe('pass');
      expect(r.after.completedDate).toBeTruthy();
    });

    it('complete rejects when already finalized', async () => {
      const r = await svc.completeInspection(insId, {
        overallResult: 'fail',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/startInspection|in_progress|passed/);
    });

    it('complete rejects unknown overall_result', async () => {
      const fresh = await svc.scheduleInspection({
        type: 'loading',
        factoryId: testData.factory.id,
        inspectorId: testData.admin.id,
      }, { userId: testData.admin.id });
      await svc.startInspection(fresh.inspection.id, { userId: testData.admin.id });
      const r = await svc.completeInspection(fresh.inspection.id, {
        overallResult: 'maybe',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/overallResult/);
    });

    it('complete maps conditional → conditional status', async () => {
      const fresh = await svc.scheduleInspection({
        type: 'loading',
        factoryId: testData.factory.id,
        inspectorId: testData.admin.id,
      }, { userId: testData.admin.id });
      await svc.startInspection(fresh.inspection.id, { userId: testData.admin.id });
      const r = await svc.completeInspection(fresh.inspection.id, {
        overallResult: 'conditional',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.after.status).toBe('conditional');
    });
  });

  // ── inspection items ───────────────────────────────────────────────

  describe('inspection items', () => {
    let insId;

    beforeAll(async () => {
      const r = await svc.scheduleInspection({
        type: 'pre_shipment',
        factoryId: testData.factory.id,
        inspectorId: testData.admin.id,
      }, { userId: testData.admin.id });
      insId = r.inspection.id;
      await svc.startInspection(insId, { userId: testData.admin.id });
    });

    it('addInspectionItem creates a line', async () => {
      const r = await svc.addInspectionItem({
        inspectionId: insId,
        productId: testData.product.id,
        checkPoint: 'Dimensions',
        criteria: 'Width 600mm ± 2mm',
        result: 'pass',
        value: '599.5mm',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.item.checkPoint).toBe('Dimensions');
      expect(r.item.result).toBe('pass');
    });

    it('rejects unknown result enum', async () => {
      const r = await svc.addInspectionItem({
        inspectionId: insId,
        productId: testData.product.id,
        checkPoint: 'X',
        criteria: 'Y',
        result: 'maybe_passes',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/result/);
    });

    it('updateInspectionItem patches result + notes; returns before/after', async () => {
      const created = await svc.addInspectionItem({
        inspectionId: insId,
        productId: testData.product.id,
        checkPoint: 'Color',
        criteria: 'Matches sample CB-12',
        result: 'pass',
      }, { userId: testData.admin.id });
      const r = await svc.updateInspectionItem(created.item.id, {
        result: 'fail',
        notes: 'Color shift detected on batch 3.',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.before.result).toBe('pass');
      expect(r.after.result).toBe('fail');
      expect(r.after.notes).toMatch(/Color shift/);
    });

    it('refuses adding items to a finalized inspection', async () => {
      const fresh = await svc.scheduleInspection({
        type: 'loading',
        factoryId: testData.factory.id,
        inspectorId: testData.admin.id,
      }, { userId: testData.admin.id });
      await svc.startInspection(fresh.inspection.id, { userId: testData.admin.id });
      await svc.completeInspection(fresh.inspection.id, {
        overallResult: 'pass',
      }, { userId: testData.admin.id });
      const r = await svc.addInspectionItem({
        inspectionId: fresh.inspection.id,
        productId: testData.product.id,
        checkPoint: 'Late',
        criteria: 'Y',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/finalized/);
    });
  });

  // ── list + get ─────────────────────────────────────────────────────

  describe('list + get', () => {
    it('listInspections filters by status', async () => {
      const r = await svc.listInspections({ status: 'scheduled' });
      expect(r.ok).toBe(true);
      expect(r.inspections.every(i => i.status === 'scheduled')).toBe(true);
    });

    it('listInspections filters by factoryId', async () => {
      const r = await svc.listInspections({ factoryId: testData.factory.id });
      expect(r.ok).toBe(true);
      expect(r.inspections.length).toBeGreaterThan(0);
    });

    it('getInspection 404s on unknown id', async () => {
      const r = await svc.getInspection(uuidv4());
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });
  });

  // ── reports ────────────────────────────────────────────────────────

  describe('generateInspectionReport + getInspectionReport', () => {
    let insId;

    beforeAll(async () => {
      const r = await svc.scheduleInspection({
        type: 'pre_shipment',
        factoryId: testData.factory.id,
        inspectorId: testData.admin.id,
      }, { userId: testData.admin.id });
      insId = r.inspection.id;
      await svc.startInspection(insId, { userId: testData.admin.id });
      await svc.addInspectionItem({
        inspectionId: insId, productId: testData.product.id,
        checkPoint: 'A', criteria: 'a', result: 'pass',
      }, { userId: testData.admin.id });
      await svc.addInspectionItem({
        inspectionId: insId, productId: testData.product.id,
        checkPoint: 'B', criteria: 'b', result: 'fail',
      }, { userId: testData.admin.id });
      await svc.completeInspection(insId, { overallResult: 'fail' }, { userId: testData.admin.id });
    });

    it('generateInspectionReport returns auto-derived counts', async () => {
      const r = await svc.generateInspectionReport({ inspectionId: insId },
        { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.report.reportNumber).toMatch(/^IR-\d+-[A-Z0-9]+$/);
      const counts = r.report.findings.find(f => f.kind === 'counts');
      expect(counts).toBeDefined();
      expect(counts.total).toBe(2);
      expect(counts.pass).toBe(1);
      expect(counts.fail).toBe(1);
    });

    it('refuses second report on the same inspection (409)', async () => {
      const r = await svc.generateInspectionReport({ inspectionId: insId },
        { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.httpStatus).toBe(409);
    });

    it('getInspectionReport by inspectionId works', async () => {
      const r = await svc.getInspectionReport({ inspectionId: insId });
      expect(r.ok).toBe(true);
      expect(r.report.inspectionId).toBe(insId);
    });

    it('getInspectionReport 404s on unknown', async () => {
      const r = await svc.getInspectionReport({ inspectionId: uuidv4() });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });

    it('getInspectionReport without any identifier returns validation error', async () => {
      const r = await svc.getInspectionReport({});
      expect(r.ok).toBe(false);
      expect(r.code).toBe('validation');
    });
  });
});
