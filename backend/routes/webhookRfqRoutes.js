/**
 * Public Webhook — Website RFQ Intake
 * POST /api/webhook/rfq
 *
 * Called by the Sovern House website when a visitor submits the Request-a-Quote form.
 * No user auth required — authenticated by a shared API key in the x-api-key header.
 *
 * On success, creates a Lead record in the CRM with source='website' and status='new'.
 * The sales team then processes it inside the ERP.
 */

const express = require('express');
const router = express.Router();
const db = require('../models');

/**
 * Validate the shared API key from the x-api-key header.
 * Set WEBHOOK_API_KEY in .env. If not set, the endpoint is disabled.
 */
function validateApiKey(req, res, next) {
  const expectedKey = process.env.WEBHOOK_API_KEY;
  if (!expectedKey) {
    return res.status(503).json({ error: 'Webhook endpoint not configured on server.' });
  }
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized — invalid or missing API key.' });
  }
  next();
}

/**
 * POST /api/webhook/rfq
 * Accepts website RFQ form payload and creates a Lead in the CRM.
 *
 * Body (all strings):
 *   name        — contact full name (required)
 *   company     — company name (required)
 *   email       — contact email (required)
 *   country     — buyer country (optional)
 *   description — what they need / product inquiry (required)
 *   quantity    — estimated quantity (optional)
 *   timeline    — desired delivery timeline (optional)
 *   source      — form source identifier (optional, defaults to 'website')
 */
router.post('/rfq', validateApiKey, async (req, res) => {
  try {
    const { name, company, email, country, description, quantity, timeline } = req.body;

    // Basic validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!company || typeof company !== 'string' || !company.trim()) {
      return res.status(400).json({ error: 'company is required' });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'valid email is required' });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'description is required' });
    }

    // Build the description field — include quantity + timeline if provided
    let fullDescription = description.trim();
    if (quantity && quantity.trim()) {
      fullDescription += `\n\nEstimated Quantity: ${quantity.trim()}`;
    }
    if (timeline && timeline.trim()) {
      fullDescription += `\nDesired Timeline: ${timeline.trim()}`;
    }

    const lead = await db.Lead.create({
      companyName: company.trim(),
      contactName: name.trim(),
      email: email.trim().toLowerCase(),
      source: 'website',
      status: 'new',
      country: country ? country.trim() : null,
      description: fullDescription,
      tags: ['rfq', 'website-intake'],
    });

    console.log(`[webhook/rfq] Lead created: ${lead.id} — ${company} <${email}>`);

    return res.status(201).json({
      success: true,
      leadId: lead.id,
      message: 'Lead created successfully.',
    });
  } catch (err) {
    console.error('[webhook/rfq] Error creating lead:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
