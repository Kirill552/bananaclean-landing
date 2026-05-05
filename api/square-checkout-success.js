'use strict';
var square = require('./_square');

async function confirmSubscription(ref, subscription) {
  var email = null;
  try { email = await square.getCustomerEmail(subscription.customer_id); } catch (e) {}
  return square.backendRequest('/api/internal/square-license-confirm', {
    method: 'POST',
    body: square.toBackendSubscriptionPayload({
      ref: ref,
      subscription: subscription,
      email: email
    })
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { square.json(res, 200, {}); return; }
  if (req.method !== 'GET') { square.json(res, 405, { error: 'Method not allowed' }); return; }

  var url = new URL(req.url, 'https://banana-clean.app');
  var ref = url.searchParams.get('square_ref');
  if (!ref) { square.json(res, 400, { error: 'Missing square_ref' }); return; }

  try {
    var result = await square.backendRequest('/api/internal/square-checkout-result?ref=' + encodeURIComponent(ref));
    if (result.success && result.key) { square.json(res, 200, result); return; }
    if (!result.orderId) { square.json(res, 200, { status: 'processing' }); return; }

    var customerId = result.customerId || await square.getCustomerIdFromOrder(result.orderId);
    if (!customerId) { square.json(res, 200, { status: 'processing' }); return; }
    var subscription = await square.searchSubscription(customerId, result.plan);
    if (!subscription || !square.isLicensableSubscription(subscription)) {
      square.json(res, 200, { status: 'processing' });
      return;
    }

    square.json(res, 200, await confirmSubscription(ref, subscription));
  } catch (err) {
    console.error('Vercel Square success error:', err.message);
    square.json(res, 500, { error: 'Server error' });
  }
};
