const { z } = require('zod');

const FinancialSchema = z.object({
  subtotal:    z.coerce.number().min(0, 'Subtotal must be >= 0').finite().optional(),
  discount:    z.coerce.number().min(0, 'Discount must be >= 0').finite().optional().default(0),
  tax:         z.coerce.number().min(0, 'Tax must be >= 0').finite().optional().default(0),
  total:       z.coerce.number().min(0, 'Total must be >= 0').finite().optional(),
  paidAmount:  z.coerce.number().min(0, 'Paid amount must be >= 0').finite().optional().default(0),
  balance:     z.coerce.number().finite().optional(),
  amount:      z.coerce.number().min(0, 'Amount must be >= 0').finite().optional(),
  unitPrice:   z.coerce.number().min(0, 'Unit price must be >= 0').finite().optional(),
  quantity:    z.coerce.number().min(0, 'Quantity must be >= 0').finite().optional(),
});

function validateFinancials(data) {
  const result = FinancialSchema.safeParse(data);
  if (!result.success) {
    const err = new Error(result.error.errors.map(e => e.message).join('; '));
    err.statusCode = 400;
    throw err;
  }
  return result.data;
}

module.exports = { validateFinancials, FinancialSchema };
