const helpers = require('../../utils/helpers');

describe('Helpers Utility Functions', () => {
  describe('getPagination', () => {
    it('should calculate correct offset and limit', () => {
      const result = helpers.getPagination(1, 10);
      expect(result).toEqual({ offset: 0, limit: 10 });
    });

    it('should calculate offset for second page', () => {
      const result = helpers.getPagination(2, 10);
      expect(result).toEqual({ offset: 10, limit: 10 });
    });

    it('should use default values', () => {
      const result = helpers.getPagination();
      expect(result).toEqual({ offset: 0, limit: 10 });
    });

    it('should handle custom page and limit', () => {
      const result = helpers.getPagination(5, 25);
      expect(result).toEqual({ offset: 100, limit: 25 });
    });
  });

  describe('getPaginatedResponse', () => {
    it('should return correctly formatted paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = helpers.getPaginatedResponse(data, 50, 1, 10);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data', data);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 5,
        totalCount: 50,
        pageSize: 10,
        hasNextPage: true,
        hasPreviousPage: false
      });
    });

    it('should indicate no next page on last page', () => {
      const result = helpers.getPaginatedResponse([], 30, 3, 10);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('should handle single page result', () => {
      const result = helpers.getPaginatedResponse([], 5, 1, 10);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
    });
  });

  describe('getSuccessResponse', () => {
    it('should return success response with data and message', () => {
      const result = helpers.getSuccessResponse({ id: 1 }, 'Success');
      expect(result).toEqual({
        success: true,
        message: 'Success',
        data: { id: 1 }
      });
    });

    it('should use default message', () => {
      const result = helpers.getSuccessResponse({ id: 1 });
      expect(result.message).toBe('Success');
    });

    it('should handle null data', () => {
      const result = helpers.getSuccessResponse(null, 'Operation completed');
      expect(result.data).toBeNull();
      expect(result.success).toBe(true);
    });
  });

  describe('calculateTotals', () => {
    it('should sum all item totals', () => {
      const items = [
        { total: 100 },
        { total: 200 },
        { total: 300 }
      ];
      const result = helpers.calculateTotals(items);
      expect(result).toEqual({ subtotal: 600 });
    });

    it('should handle empty items array', () => {
      const result = helpers.calculateTotals([]);
      expect(result).toEqual({ subtotal: 0 });
    });

    it('should handle string totals', () => {
      const items = [
        { total: '100' },
        { total: '200' }
      ];
      const result = helpers.calculateTotals(items);
      expect(result).toEqual({ subtotal: 300 });
    });

    it('should handle missing total field', () => {
      const items = [
        { total: 100 },
        { other: 200 }
      ];
      const result = helpers.calculateTotals(items);
      expect(result).toEqual({ subtotal: 100 });
    });
  });

  describe('calculateDiscountedTotal', () => {
    it('should calculate fixed discount', () => {
      const result = helpers.calculateDiscountedTotal(1000, 100, 'fixed');
      expect(result).toEqual({
        discountAmount: 100,
        afterDiscount: 900
      });
    });

    it('should calculate percentage discount', () => {
      const result = helpers.calculateDiscountedTotal(1000, 10, 'percentage');
      expect(result).toEqual({
        discountAmount: 100,
        afterDiscount: 900
      });
    });

    it('should use fixed discount by default', () => {
      const result = helpers.calculateDiscountedTotal(500, 50);
      expect(result.discountAmount).toBe(50);
    });

    it('should not go below zero', () => {
      const result = helpers.calculateDiscountedTotal(100, 200, 'fixed');
      expect(result.afterDiscount).toBe(0);
    });
  });

  describe('calculateTax', () => {
    it('should calculate tax correctly', () => {
      const result = helpers.calculateTax(1000, 10);
      expect(result).toEqual({
        tax: 100,
        total: 1100
      });
    });

    it('should handle zero tax rate', () => {
      const result = helpers.calculateTax(1000, 0);
      expect(result).toEqual({
        tax: 0,
        total: 1000
      });
    });

    it('should use default tax rate of 0', () => {
      const result = helpers.calculateTax(1000);
      expect(result.tax).toBe(0);
    });
  });

  describe('generateDocumentNumber', () => {
    it('should generate document number with correct prefix', () => {
      const result = helpers.generateDocumentNumber('SO');
      // Random suffix is alphanumeric uppercase (0-9, A-Z), 3 chars
      expect(result).toMatch(/^SO-\d{8}-[A-Z0-9]{3}$/);
    });

    it('should generate different numbers', () => {
      const num1 = helpers.generateDocumentNumber('INV');
      const num2 = helpers.generateDocumentNumber('INV');
      expect(num1).not.toBe(num2);
    });

    it('should use provided date', () => {
      const date = new Date('2024-03-15');
      const result = helpers.generateDocumentNumber('PO', date);
      expect(result).toMatch(/^PO-20240315-/);
    });
  });

  describe('formatCurrency', () => {
    it('should format USD currency', () => {
      const result = helpers.formatCurrency(1000, 'USD');
      expect(result).toContain('1,000');
    });

    it('should use USD as default currency', () => {
      const result = helpers.formatCurrency(999.99);
      expect(result).toContain('999.99');
    });

    it('should handle decimal amounts', () => {
      const result = helpers.formatCurrency(123.45, 'USD');
      expect(result).toContain('123.45');
    });
  });

  describe('calculateDaysFromNow', () => {
    it('should calculate days in future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const result = helpers.calculateDaysFromNow(futureDate);
      expect(result).toBe(5);
    });

    it('should calculate days in past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const result = helpers.calculateDaysFromNow(pastDate);
      expect(result).toBe(-5);
    });
  });

  describe('isDateInPast', () => {
    it('should identify past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(helpers.isDateInPast(pastDate)).toBe(true);
    });

    it('should not identify future dates as past', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(helpers.isDateInPast(futureDate)).toBe(false);
    });
  });

  describe('isDateInFuture', () => {
    it('should identify future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(helpers.isDateInFuture(futureDate)).toBe(true);
    });

    it('should not identify past dates as future', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(helpers.isDateInFuture(pastDate)).toBe(false);
    });
  });

  describe('getDateRange', () => {
    it('should return month range by default', () => {
      const result = helpers.getDateRange();
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('endDate');
      expect(result.startDate).toBeInstanceOf(Date);
    });

    it('should return week range', () => {
      const result = helpers.getDateRange('week');
      const diffDays = Math.floor((result.endDate - result.startDate) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it('should return month range', () => {
      const result = helpers.getDateRange('month');
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('endDate');
    });

    it('should return quarter range', () => {
      const result = helpers.getDateRange('quarter');
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('endDate');
    });

    it('should return year range', () => {
      const result = helpers.getDateRange('year');
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('endDate');
    });
  });

  describe('calculatePercentageChange', () => {
    it('should calculate percentage increase', () => {
      const result = helpers.calculatePercentageChange(150, 100);
      expect(result).toBe(50);
    });

    it('should calculate percentage decrease', () => {
      const result = helpers.calculatePercentageChange(50, 100);
      expect(result).toBe(-50);
    });

    it('should return 0 when previous is 0', () => {
      const result = helpers.calculatePercentageChange(100, 0);
      expect(result).toBe(0);
    });

    it('should handle negative numbers', () => {
      // (-50 - (-100)) / (-100) * 100 = 50 / -100 * 100 = -50
      const result = helpers.calculatePercentageChange(-50, -100);
      expect(result).toBe(-50);
    });
  });

  describe('sanitizeObject', () => {
    it('should only include allowed fields', () => {
      const obj = { id: 1, name: 'Test', email: 'test@example.com', password: 'secret' };
      const result = helpers.sanitizeObject(obj, ['id', 'name', 'email']);
      expect(result).toEqual({ id: 1, name: 'Test', email: 'test@example.com' });
    });

    it('should handle missing fields', () => {
      const obj = { id: 1, name: 'Test' };
      const result = helpers.sanitizeObject(obj, ['id', 'name', 'email']);
      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should return empty object when no allowed fields match', () => {
      const obj = { id: 1, name: 'Test' };
      const result = helpers.sanitizeObject(obj, ['email', 'password']);
      expect(result).toEqual({});
    });
  });

  describe('mergeObjects', () => {
    it('should merge two objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      const result = helpers.mergeObjects(target, source);
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should not modify original objects', () => {
      const target = { a: 1 };
      const source = { b: 2 };
      const result = helpers.mergeObjects(target, source);
      expect(target).toEqual({ a: 1 });
      expect(source).toEqual({ b: 2 });
    });

    it('should handle empty objects', () => {
      const result = helpers.mergeObjects({}, { a: 1 });
      expect(result).toEqual({ a: 1 });
    });
  });
});
