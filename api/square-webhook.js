'use strict';
var square = require('./_square');

function extractWebhookObject(event, name) {
  return event && event.data && event.data.object ? event.data.object[name] : null;
}

function extractInvoiceSubscriptionId(invoice) {
  if (!invoice) return null;
  if (invoice.subscription_id) return invoice.subscription_id;
  if (invoice.subscription && invoice.subscription.id) return invoice.subscription.id;
  return null;
}

async function sendSubscription(subscription) {
  if (!subscription || !subscription.id) return;
  var email = null;
  try { email = await square.getCustomerEmail(subscription.customer_id); } catch (e) {}
  await square.backendRequest('/api/internal/square-license-confirm', {
    method: 'POST',
    body: square.toBackendSubscriptionPayload({
      subscription: subscription,
      email: email
    })
  });
}

async function handlePaymentUpdated(payment) {
  if (!payment || String(payment.status || '').toUpperCase() !== 'COMPLETED') return;
  await square.backendRequest('/api/internal/square-payment-confirm', {
    method: 'POST',
    body: {
      orderId: payment.order_id,
      customerId: payment.customer_id || null
    }
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { square.json(res, 200, {}); return; }
  if (req.method !== 'POST') { square.json(res, 405, { error: 'Method not allowed' }); return; }

  var body = await square.readBody(req);
  var signature = req.headers['x-square-hmacsha256-signature'] || '';
  var webhookUrl = process.env.SQUARE_WEBHOOK_URL || 'https://banana-clean.app/api/square-webhook';
  if (!square.verifyWebhookSignature(signature, body, process.env.SQUARE_WEBHOOK_SIGNATURE_KEY, webhookUrl)) {
    square.json(res, 403, { error: 'Invalid signature' });
    return;
  }

  try {
    var event = JSON.parse(body || '{}');
    if (event.type === 'payment.updated') {
      await handlePaymentUpdated(extractWebhookObject(event, 'payment'));
    }
    if (event.type === 'subscription.created' || event.type === 'subscription.updated') {
      await sendSubscription(extractWebhookObject(event, 'subscription'));
    }
    if (event.type === 'invoice.payment_made') {
      var invoice = extractWebhookObject(event, 'invoice');
      var subscriptionId = extractInvoiceSubscriptionId(invoice);
      if (subscriptionId) {
        var data = await square.squareRequest('/subscriptions/' + encodeURIComponent(subscriptionId));
        await sendSubscription(data.subscription);
      }
    }
  } catch (err) {
    console.error('Vercel Square webhook error:', err.message);
  }

  square.json(res, 200, { ok: true });
};
