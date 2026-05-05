'use strict';
var crypto = require('crypto');
var square = require('./_square');

function isConfigured(plan) {
  var planConfig = square.getPlanConfigByPlan(plan);
  return !!(process.env.SQUARE_ACCESS_TOKEN &&
    process.env.SQUARE_LOCATION_ID &&
    planConfig.variationId &&
    process.env.SQUARE_INTERNAL_SECRET);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { square.json(res, 200, {}); return; }
  if (req.method !== 'POST') { square.json(res, 405, { error: 'Method not allowed' }); return; }

  try {
    var body = JSON.parse(await square.readBody(req) || '{}');
    if (body.product && body.product !== 'banana-clean') {
      square.json(res, 400, { error: 'Unsupported product' });
      return;
    }

    var plan = body.plan === 'yearly' ? 'yearly' : 'monthly';
    if (!isConfigured(plan)) { square.json(res, 503, { error: 'Square not configured' }); return; }

    var ref = crypto.randomUUID();
    var planConfig = square.getPlanConfigByPlan(plan);
    var data = await square.squareRequest('/online-checkout/payment-links', {
      method: 'POST',
      body: square.buildPaymentLinkRequest(ref, plan)
    });
    var link = data.payment_link || {};
    if (!link.url) { square.json(res, 500, { error: 'Square payment link missing URL' }); return; }

    await square.backendRequest('/api/internal/square-checkout-created', {
      method: 'POST',
      body: {
        ref: ref,
        plan: plan,
        paymentLinkId: link.id || null,
        orderId: link.order_id || null,
        amount: planConfig.price,
        currency: 'usd'
      }
    });

    square.json(res, 200, { url: link.url, ref: ref });
  } catch (err) {
    console.error('Vercel Square checkout error:', err.message);
    square.json(res, 500, { error: 'Failed to create Square checkout' });
  }
};
