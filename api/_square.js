'use strict';
var crypto = require('crypto');
var SQUARE_API_VERSION = '2026-01-22';
function getApiBase() {
  return process.env.SQUARE_ENV === 'sandbox'
    ? 'https://connect.squareupsandbox.com/v2'
    : 'https://connect.squareup.com/v2';
}
function getPlanConfig(variationId) {
  if (variationId && variationId === process.env.SQUARE_PLAN_BC_MONTHLY) {
    return { plan: 'monthly', price: '2.99', amount: 299, currency: 'USD' };
  }
  if (variationId && variationId === process.env.SQUARE_PLAN_BC_YEARLY) {
    return { plan: 'yearly', price: '24.99', amount: 2499, currency: 'USD' };
  }
  return null;
}
function getPlanConfigByPlan(plan) {
  if (plan === 'yearly') {
    return {
      plan: 'yearly',
      price: '24.99',
      amount: 2499,
      currency: 'USD',
      variationId: process.env.SQUARE_PLAN_BC_YEARLY || ''
    };
  }
  return {
    plan: 'monthly',
    price: '2.99',
    amount: 299,
    currency: 'USD',
    variationId: process.env.SQUARE_PLAN_BC_MONTHLY || ''
  };
}
function appendQuery(url, key, value) {
  var separator = url.indexOf('?') === -1 ? '?' : '&';
  return url + separator + encodeURIComponent(key) + '=' + encodeURIComponent(value);
}
function buildPaymentLinkRequest(ref, plan) {
  var planConfig = getPlanConfigByPlan(plan);
  var planLabel = planConfig.plan === 'yearly' ? 'Yearly' : 'Monthly';
  return {
    idempotency_key: ref,
    quick_pay: {
      name: 'Banana Clean PRO ' + planLabel + ' - Gemini image cleanup',
      location_id: process.env.SQUARE_LOCATION_ID,
      price_money: {
        amount: planConfig.amount,
        currency: planConfig.currency
      }
    },
    checkout_options: {
      subscription_plan_id: planConfig.variationId,
      redirect_url: appendQuery(process.env.SQUARE_SUCCESS_URL || 'https://banana-clean.app/pricing?square=success', 'square_ref', ref),
      merchant_support_email: process.env.SQUARE_SUPPORT_EMAIL || 'novikn552ta@gmail.com'
    },
    payment_note: 'Banana Clean PRO ' + planLabel + ' - Gemini image export cleanup subscription'
  };
}
function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-square-hmacsha256-signature');
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (chunk) { chunks.push(chunk); });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}
async function squareRequest(apiPath, options) {
  var opts = options || {};
  var response = await fetch(getApiBase() + apiPath, {
    method: opts.method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + process.env.SQUARE_ACCESS_TOKEN,
      'Square-Version': SQUARE_API_VERSION,
      'Content-Type': 'application/json'
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  var text = await response.text();
  var data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error('Square API ' + response.status + ': ' + text.substring(0, 500));
  return data;
}
async function backendRequest(path, options) {
  var opts = options || {};
  var baseUrl = process.env.BACKEND_INTERNAL_BASE_URL || 'https://nanobanana-clean.ru';
  var response = await fetch(baseUrl + path, {
    method: opts.method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + process.env.SQUARE_INTERNAL_SECRET,
      'Content-Type': 'application/json'
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  var text = await response.text();
  var data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error('Backend API ' + response.status + ': ' + text.substring(0, 500));
  return data;
}
function verifyWebhookSignature(signature, body, signatureKey, notificationUrl) {
  if (!signature || !body || !signatureKey || !notificationUrl) return false;
  var expected = crypto.createHmac('sha256', signatureKey).update(notificationUrl + body).digest('base64');
  var left = Buffer.from(signature);
  var right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function isLicensableSubscription(subscription) {
  if (!subscription) return false;
  var status = String(subscription.status || '').toUpperCase();
  if (status === 'CANCELED' || status === 'CANCELLED' || status === 'DEACTIVATED' || status === 'PAUSED') return false;
  return status === 'ACTIVE' || !!subscription.charged_through_date;
}
function selectSubscriptionForCheckout(subscriptions, plan) {
  var planConfig = getPlanConfigByPlan(plan);
  var matches = (subscriptions || []).filter(function (sub) {
    return sub.plan_variation_id === planConfig.variationId;
  }).sort(function (a, b) {
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
  for (var i = 0; i < matches.length; i++) {
    if (String(matches[i].status || '').toUpperCase() === 'ACTIVE') return matches[i];
  }
  for (var j = 0; j < matches.length; j++) {
    if (isLicensableSubscription(matches[j])) return matches[j];
  }
  return null;
}
function extractOrderCustomerId(order) {
  if (!order) return null;
  if (order.customer_id) return order.customer_id;
  var tenders = order.tenders || [];
  for (var i = 0; i < tenders.length; i++) if (tenders[i].customer_id) return tenders[i].customer_id;
  return null;
}
function extractPaymentIdFromOrder(order) {
  var tenders = order && order.tenders ? order.tenders : [];
  for (var i = 0; i < tenders.length; i++) if (tenders[i].id || tenders[i].payment_id) return tenders[i].id || tenders[i].payment_id;
  return null;
}
async function getCustomerIdFromOrder(orderId) {
  if (!orderId) return null;
  var orderData = await squareRequest('/orders/' + encodeURIComponent(orderId));
  var order = orderData.order || {};
  var customerId = extractOrderCustomerId(order);
  if (customerId) return customerId;
  var paymentId = extractPaymentIdFromOrder(order);
  if (!paymentId) return null;
  var paymentData = await squareRequest('/payments/' + encodeURIComponent(paymentId));
  return paymentData.payment && paymentData.payment.customer_id ? paymentData.payment.customer_id : null;
}
async function getCustomerEmail(customerId) {
  if (!customerId) return null;
  var data = await squareRequest('/customers/' + encodeURIComponent(customerId));
  return data.customer && data.customer.email_address ? data.customer.email_address : null;
}
async function searchSubscription(customerId, plan) {
  if (!customerId) return null;
  var data = await squareRequest('/subscriptions/search', {
    method: 'POST',
    body: { query: { filter: { customer_ids: [customerId], location_ids: [process.env.SQUARE_LOCATION_ID] } } }
  });
  return selectSubscriptionForCheckout(data.subscriptions || [], plan);
}
function toBackendSubscriptionPayload(input) {
  var subscription = input.subscription || {};
  return {
    ref: input.ref || undefined,
    subscriptionId: subscription.id,
    planVariationId: subscription.plan_variation_id,
    customerId: subscription.customer_id || null,
    email: input.email || null,
    status: subscription.status || '',
    chargedThroughDate: subscription.charged_through_date || null
  };
}
module.exports = {
  json: json,
  readBody: readBody,
  squareRequest: squareRequest,
  backendRequest: backendRequest,
  getPlanConfig: getPlanConfig,
  getPlanConfigByPlan: getPlanConfigByPlan,
  buildPaymentLinkRequest: buildPaymentLinkRequest,
  verifyWebhookSignature: verifyWebhookSignature,
  isLicensableSubscription: isLicensableSubscription,
  selectSubscriptionForCheckout: selectSubscriptionForCheckout,
  getCustomerIdFromOrder: getCustomerIdFromOrder,
  getCustomerEmail: getCustomerEmail,
  searchSubscription: searchSubscription,
  toBackendSubscriptionPayload: toBackendSubscriptionPayload
};
