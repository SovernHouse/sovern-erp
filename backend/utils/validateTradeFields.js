const { z } = require('zod');

const VALID_INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'];
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'CNY', 'AED', 'TWD', 'JPY', 'SGD', 'AUD', 'HKD'];
const VALID_SHIPPING_METHODS = ['Sea', 'Air', 'Land', 'Rail', 'Sea-Air', 'Combined', 'Express'];
const VALID_PAYMENT_TERMS = [
  'Advance Payment', 'T/T 30% Deposit', 'T/T 50% Deposit', 'T/T 70% Deposit',
  'Net 30', 'Net 60', 'Net 90', 'L/C at Sight', 'D/P', 'D/A', 'Cash on Delivery', 'Open Account'
];

const TradeFieldsSchema = z.object({
  incoterms:      z.enum(VALID_INCOTERMS, { errorMap: () => ({ message: `Incoterms must be one of: ${VALID_INCOTERMS.join(', ')}` }) }).optional(),
  currency:       z.enum(VALID_CURRENCIES, { errorMap: () => ({ message: `Currency must be one of: ${VALID_CURRENCIES.join(', ')}` }) }).optional(),
  shippingMethod: z.enum(VALID_SHIPPING_METHODS, { errorMap: () => ({ message: `Shipping method must be one of: ${VALID_SHIPPING_METHODS.join(', ')}` }) }).optional(),
  paymentTerms:   z.string().min(1).max(100).optional(),
});

function validateTradeFields(data) {
  const subset = {};
  if (data.incoterms !== undefined)      subset.incoterms      = data.incoterms;
  if (data.currency !== undefined)       subset.currency       = data.currency;
  if (data.shippingMethod !== undefined) subset.shippingMethod = data.shippingMethod;
  if (data.paymentTerms !== undefined)   subset.paymentTerms   = data.paymentTerms;

  const result = TradeFieldsSchema.safeParse(subset);
  if (!result.success) {
    const err = new Error(result.error.errors.map(e => e.message).join('; '));
    err.statusCode = 400;
    throw err;
  }
  return result.data;
}

module.exports = { validateTradeFields, VALID_INCOTERMS, VALID_CURRENCIES, VALID_SHIPPING_METHODS, VALID_PAYMENT_TERMS };
