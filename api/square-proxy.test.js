// Тесты helper'ов Vercel Square proxy.
'use strict';

var assert = require('assert');

process.env.SQUARE_PLAN_BC_MONTHLY = 'monthly-var';
process.env.SQUARE_PLAN_BC_YEARLY = 'yearly-var';
process.env.SQUARE_LOCATION_ID = 'loc_123';
process.env.SQUARE_SUPPORT_EMAIL = 'support@example.com';
process.env.SQUARE_SUCCESS_URL = 'https://banana-clean.app/pricing?square=success';

var squareProxy = require('./_square');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS:', name);
    passed++;
  } catch (e) {
    console.log('FAIL:', name, '-', e.message);
    failed++;
  }
}

test('buildPaymentLinkRequest creates production subscription checkout payload', function () {
  var payload = squareProxy.buildPaymentLinkRequest('ref-123', 'monthly');

  assert.strictEqual(payload.idempotency_key, 'ref-123');
  assert.strictEqual(payload.quick_pay.name, 'Banana Clean PRO Monthly - Gemini image cleanup');
  assert.strictEqual(payload.quick_pay.location_id, 'loc_123');
  assert.strictEqual(payload.quick_pay.price_money.amount, 299);
  assert.strictEqual(payload.checkout_options.subscription_plan_id, 'monthly-var');
  assert.strictEqual(payload.checkout_options.redirect_url, 'https://banana-clean.app/pricing?square=success&square_ref=ref-123');
  assert.strictEqual(payload.checkout_options.merchant_support_email, 'support@example.com');
  assert.strictEqual(payload.payment_note, 'Banana Clean PRO Monthly - Gemini image export cleanup subscription');
});

test('getPlanConfig maps Square variation ids to Banana Clean plans', function () {
  assert.strictEqual(squareProxy.getPlanConfig('monthly-var').plan, 'monthly');
  assert.strictEqual(squareProxy.getPlanConfig('yearly-var').plan, 'yearly');
  assert.strictEqual(squareProxy.getPlanConfig('unknown'), null);
});

test('selectSubscriptionForCheckout prefers active newest matching subscription', function () {
  var selected = squareProxy.selectSubscriptionForCheckout([
    { id: 'old', plan_variation_id: 'monthly-var', status: 'ACTIVE', created_at: '2026-05-01T00:00:00Z' },
    { id: 'new', plan_variation_id: 'monthly-var', status: 'ACTIVE', created_at: '2026-05-02T00:00:00Z' },
    { id: 'yearly', plan_variation_id: 'yearly-var', status: 'ACTIVE', created_at: '2026-05-03T00:00:00Z' }
  ], 'monthly');

  assert.strictEqual(selected.id, 'new');
});

test('toBackendSubscriptionPayload normalizes Square subscription for backend', function () {
  var payload = squareProxy.toBackendSubscriptionPayload({
    ref: 'ref-123',
    subscription: {
      id: 'sub_123',
      plan_variation_id: 'monthly-var',
      customer_id: 'customer_123',
      status: 'ACTIVE',
      charged_through_date: '2026-06-05'
    },
    email: 'buyer@example.com'
  });

  assert.deepStrictEqual(payload, {
    ref: 'ref-123',
    subscriptionId: 'sub_123',
    planVariationId: 'monthly-var',
    customerId: 'customer_123',
    email: 'buyer@example.com',
    status: 'ACTIVE',
    chargedThroughDate: '2026-06-05'
  });
});

console.log('');
console.log('Результат: ' + passed + ' прошло, ' + failed + ' упало');
process.exit(failed > 0 ? 1 : 0);
