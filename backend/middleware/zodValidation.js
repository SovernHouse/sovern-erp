const { z } = require('zod');

// Generic validation middleware factory
const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    });
    // Replace with validated/coerced values
    req.body = parsed.body || req.body;
    req.query = parsed.query || req.query;
    req.params = parsed.params || req.params;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }
      });
    }
    next(error);
  }
};

// ── Reusable field schemas ──
const uuid = z.string().uuid('Invalid UUID format');
const email = z.string().email('Invalid email format').transform(v => v.toLowerCase());
const password = z.string().min(6, 'Password must be at least 6 characters');
const nonEmpty = z.string().min(1, 'This field is required');
const optionalString = z.string().optional().nullable();
const positiveNumber = z.number().positive().or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number));
const pagination = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
    search: z.string().optional(),
    status: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['ASC', 'DESC', 'asc', 'desc']).optional()
  }).passthrough()
};

// ── Auth Schemas ──
const authSchemas = {
  login: z.object({
    body: z.object({
      email: email,
      password: z.string().min(1, 'Password is required')
    }),
    query: z.object({}).passthrough().optional(),
    params: z.object({}).passthrough().optional()
  }),
  register: z.object({
    body: z.object({
      email: email,
      password: password,
      firstName: nonEmpty,
      lastName: nonEmpty,
      phone: optionalString,
      role: z.enum(['admin', 'sales', 'operations', 'finance', 'inspector', 'customer', 'factory']).optional()
    }),
    query: z.object({}).passthrough().optional(),
    params: z.object({}).passthrough().optional()
  }),
  changePassword: z.object({
    body: z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: password
    }),
    query: z.object({}).passthrough().optional(),
    params: z.object({}).passthrough().optional()
  }),
  forgotPassword: z.object({
    body: z.object({ email: email }),
    query: z.object({}).passthrough().optional(),
    params: z.object({}).passthrough().optional()
  }),
  resetPassword: z.object({
    body: z.object({
      token: nonEmpty,
      newPassword: password
    }),
    query: z.object({}).passthrough().optional(),
    params: z.object({}).passthrough().optional()
  })
};

// ── Customer Schemas ──
const customerSchemas = {
  create: z.object({
    body: z.object({
      companyName: nonEmpty,
      email: email,
      phone: nonEmpty,
      contactPerson: optionalString,
      address: optionalString,
      city: optionalString,
      country: optionalString,
      currency: z.string().default('USD'),
      paymentTerms: z.string().default('Net 30'),
      creditLimit: z.number().min(0).optional().default(0),
      notes: optionalString
    }),
    query: z.object({}).passthrough().optional(),
    params: z.object({}).passthrough().optional()
  }),
  update: z.object({
    body: z.object({
      companyName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      contactPerson: optionalString,
      address: optionalString,
      city: optionalString,
      country: optionalString,
      currency: z.string().optional(),
      paymentTerms: z.string().optional(),
      creditLimit: z.number().min(0).optional(),
      rating: z.number().min(0).max(5).optional(),
      isActive: z.boolean().optional(),
      notes: optionalString
    }),
    query: z.object({}).passthrough().optional(),
    params: z.object({ id: uuid })
  }),
  getById: z.object({
    body: z.object({}).passthrough().optional(),
    query: z.object({}).passthrough().optional(),
    params: z.object({ id: uuid })
  })
};

// ── Inquiry Schemas ──
const inquirySchemas = {
  create: z.object({
    body: z.object({
      customerId: uuid,
      items: z.array(z.object({
        productId: uuid,
        quantity: z.number().positive(),
        unit: z.string().optional(),
        notes: optionalString
      })).min(1, 'At least one item is required'),
      notes: optionalString,
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional()
    }),
    query: z.object({}).passthrough().optional(),
    params: z.object({}).passthrough().optional()
  }),
  updateStatus: z.object({
    body: z.object({
      status: nonEmpty
    }),
    query: z.object({}).passthrough().optional(),
    params: z.object({ id: uuid })
  })
};

// ── Quotation Schemas ──
const quotationSchemas = {
  create: z.object({
    body: z.object({
      customerId: uuid,
      inquiryId: z.string().uuid().optional(),
      items: z.array(z.object({
        productId: uuid,
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
        unit: z.string().optional(),
        notes: optionalString
      })).min(1, 'At least one item is required'),
      validUntil: z.string().optional(),
      notes: optionalString,
      terms: optionalString,
      discount: z.number().min(0).optional(),
      discountType: z.enum(['fixed', 'percentage']).optional()
    }),
    query: z.object({}).passthrough().optional(),
    params: z.object({}).passthrough().optional()
  })
};

// ── Product Schemas ──
const productSchemas = {
  create: z.object({
    body: z.object({
      name: nonEmpty,
      sku: nonEmpty,
      description: optionalString,
      categoryId: z.string().uuid().optional().nullable(),
      factoryId: z.string().uuid().optional().nullable(),
      unit: z.string().optional(),
      minOrderQty: z.number().positive().optional(),
      basePrice: z.number().min(0).optional(),
      specifications: z.any().optional()
    }),
    query: z.object({}).passthrough().optional(),
    params: z.object({}).passthrough().optional()
  })
};

// ── Factory Schemas ──
const factorySchemas = {
  create: z.object({
    body: z.object({
      companyName: nonEmpty,
      email: email,
      phone: nonEmpty,
      contactPerson: optionalString,
      address: optionalString,
      city: optionalString,
      country: optionalString,
      specialization: optionalString,
      certifications: z.array(z.string()).optional(),
      rating: z.number().min(0).max(5).optional()
    }),
    query: z.object({}).passthrough().optional(),
    params: z.object({}).passthrough().optional()
  })
};

module.exports = {
  validate,
  z,
  authSchemas,
  customerSchemas,
  inquirySchemas,
  quotationSchemas,
  productSchemas,
  factorySchemas,
  pagination
};
