// Banana Clean EN Landing — интерактив

const FALLBACK_ANALYTICS_ORIGIN = 'https://banana-clean.app';
const LANDING_API_ORIGIN = resolveLandingApiOrigin();
const LANDING_ANALYTICS_URL = LANDING_API_ORIGIN ? LANDING_API_ORIGIN + '/collect' : '';
const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/banana-clean-%E2%80%94-remove-gem/kodhinmeeokhkhelmmpnflnhapifgfah';
const SLIDER_MIN_POSITION = 1;
const SLIDER_MAX_POSITION = 99;
const SLIDER_INITIAL_POSITION = 85;
bindFaqAccordion();
bindBeforeAfterSlider();
bindInstallLinks();
bindStickyInstall();
bindBuyStars();
bindRollyPayCheckout();
bindCryptoCheckout();
trackPricingView();

function resolveLandingApiOrigin() {
  if (window.location.protocol === 'file:') return FALLBACK_ANALYTICS_ORIGIN;
  return window.location.origin;
}

function bindInstallLinks() {
  bindInstallLink('hero-install-link', 'hero');
  bindInstallLink('chrome-link', 'cta');
  bindInstallLink('sticky-install-link', 'sticky');
}

function bindInstallLink(id, surface) {
  const link = document.getElementById(id);
  if (!link) return;

  link.href = CHROME_STORE_URL;
  link.addEventListener('click', () => {
    sendLandingAnalytics('install_clicked', {
      surface,
      path: window.location.pathname
    });
  });
}

// --- FAQ аккордеон ---

function bindFaqAccordion() {
  document.querySelectorAll('.faq__item').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      document.querySelectorAll('.faq__item').forEach((other) => {
        if (other !== item && other.open) other.open = false;
      });
    });
  });
}

// --- Before/After слайдер ---

function bindBeforeAfterSlider() {
  const slider = document.getElementById('ba-slider');
  const handle = document.getElementById('ba-handle');
  if (!slider || !handle) return;

  const beforeEl = slider.querySelector('.ba-slider__before');
  const images = slider.querySelectorAll('img');
  let dragging = false;
  if (!beforeEl) return;

  syncSliderAspectRatio(slider, images);
  setSliderPosition(beforeEl, handle, SLIDER_INITIAL_POSITION);

  const updatePosition = (x) => {
    const rect = slider.getBoundingClientRect();
    if (!rect.width) return;
    let pct = ((x - rect.left) / rect.width) * 100;
    pct = Math.max(SLIDER_MIN_POSITION, Math.min(SLIDER_MAX_POSITION, pct));
    setSliderPosition(beforeEl, handle, pct);
  };

  slider.addEventListener('pointerdown', (event) => {
    dragging = true;
    slider.setPointerCapture(event.pointerId);
    updatePosition(event.clientX);
  });

  slider.addEventListener('pointermove', (event) => {
    if (dragging) updatePosition(event.clientX);
  });

  slider.addEventListener('pointerup', () => {
    dragging = false;
  });

  slider.addEventListener('pointercancel', () => {
    dragging = false;
  });
}

// --- Sticky install кнопка ---

function bindStickyInstall() {
  const sticky = document.getElementById('stickyInstall');
  const hero = document.getElementById('hero');
  const install = document.getElementById('install');
  if (!sticky || !hero || !install) return;

  let heroVisible = true;
  let installVisible = false;

  const sync = () => {
    sticky.hidden = heroVisible || installVisible;
    sticky.dataset.visible = heroVisible || installVisible ? 'false' : 'true';
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target === hero) heroVisible = entry.isIntersecting;
      if (entry.target === install) installVisible = entry.isIntersecting;
    });
    sync();
  }, { threshold: 0.1 });

  observer.observe(hero);
  observer.observe(install);
  sync();
}

// --- Покупка PRO (pricing page) ---

function bindBuyStars() {
  const buttons = Array.from(document.querySelectorAll('[data-stars-plan]'));
  if (!buttons.length) return;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      sendLandingAnalytics('buy_stars_clicked', {
        surface: 'pricing',
        plan: button.dataset.starsPlan || ''
      });
    });
  });
}

function bindRollyPayCheckout() {
  const buttons = Array.from(document.querySelectorAll('[data-rollypay-plan]'));
  if (!buttons.length) return;

  const emailInputs = Array.from(document.querySelectorAll('[data-rollypay-email]')).reduce((acc, input) => {
    acc[input.dataset.rollypayEmail] = input;
    return acc;
  }, {});
  const statuses = Array.from(document.querySelectorAll('[data-rollypay-status]')).reduce((acc, status) => {
    acc[status.dataset.rollypayStatus] = status;
    return acc;
  }, {});
  const params = new URLSearchParams(window.location.search || '');
  const returnOrder = params.get('order') || '';
  const returnState = params.get('rollypay') || '';
  let cardPlans = {
    crypto_30d: { plan: 'crypto_30d', price: '2.99', currency: 'EUR', label: 'Image PRO 30 days' },
    crypto_yearly: { plan: 'crypto_yearly', price: '24.99', currency: 'EUR', label: 'Image PRO yearly' },
    crypto_video_30d: { plan: 'crypto_video_30d', price: '9.99', currency: 'EUR', label: 'OMNI Video 30 days' }
  };

  const getCardPlan = (planId) => cardPlans[planId] || cardPlans.crypto_30d;
  const setPlanStatus = (planId, message, tone) => {
    const status = statuses[planId];
    if (!status) return;
    status.dataset.tone = tone || '';
    status.textContent = message;
  };
  const setAllStatuses = (message, tone) => {
    Object.keys(statuses).forEach((planId) => setPlanStatus(planId, message, tone));
  };
  const setButtonsEnabled = (enabled, disabledLabel) => {
    buttons.forEach((button) => {
      button.disabled = !enabled;
      button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      button.textContent = enabled ? 'Pay by card' : (disabledLabel || 'Loading card checkout...');
    });
    Object.keys(emailInputs).forEach((planId) => {
      emailInputs[planId].disabled = !enabled;
    });
  };

  setButtonsEnabled(false);

  fetch(LANDING_API_ORIGIN + '/api/rollypay/config')
    .then((response) => response.json().then((data) => {
      if (!response.ok) throw new Error(data.error || 'config_error');
      return data;
    }))
    .then((data) => {
      cardPlans = (data.plans || []).reduce((acc, plan) => {
        if (plan.plan && plan.price) acc[plan.plan] = plan;
        return acc;
      }, cardPlans);
      setButtonsEnabled(true);
      buttons.forEach((button) => {
        const plan = getCardPlan(button.dataset.rollypayPlan);
        setPlanStatus(plan.plan, 'Visa / Mastercard via RollyPay hosted checkout.', '');
      });
      checkRollyPayReturn();
    })
    .catch((error) => {
      setButtonsEnabled(false, 'Card unavailable');
      const fallback = error.message === 'rollypay_not_configured'
        ? 'Visa / Mastercard checkout is ready in the UI and will enable after RollyPay keys are added.'
        : 'Could not load card checkout. Use Telegram Stars or Plisio checkout below.';
      setAllStatuses(fallback, error.message === 'rollypay_not_configured' ? '' : 'error');
      sendLandingAnalytics('card_config_failed', { provider: 'rollypay', reason: error.message || 'unknown' });
    });

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const plan = getCardPlan(button.dataset.rollypayPlan);
      const input = emailInputs[plan.plan];
      const email = input ? input.value.trim() : '';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setPlanStatus(plan.plan, 'Enter a valid email to receive your access key.', 'error');
        if (input) input.focus();
        return;
      }

      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.textContent = 'Opening checkout...';
      setPlanStatus(plan.plan, 'Creating RollyPay card checkout...', '');
      sendLandingAnalytics('buy_card_clicked', { surface: 'pricing', provider: 'rollypay', plan: plan.plan });

      fetch(LANDING_API_ORIGIN + '/api/rollypay/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan: plan.plan, source: 'pricing_card' })
      })
        .then((response) => response.json().then((data) => {
          if (!response.ok) throw new Error(data.error || 'create_payment_error');
          return data;
        }))
        .then((data) => {
          if (!data.payUrl) throw new Error('missing_pay_url');
          window.location.href = data.payUrl;
        })
        .catch((error) => {
          button.disabled = false;
          button.setAttribute('aria-disabled', 'false');
          button.textContent = 'Pay by card';
          setPlanStatus(
            plan.plan,
            error.message === 'rollypay_not_configured'
              ? 'Card checkout is not configured yet. Use Telegram Stars or Plisio checkout below.'
              : 'Could not create card checkout. Try again or use Telegram Stars.',
            'error'
          );
          sendLandingAnalytics('card_payment_failed', { provider: 'rollypay', reason: error.message || 'unknown' });
        });
    });
  });

  function checkRollyPayReturn() {
    if (!returnState) return;
    if (returnState === 'failed') {
      setAllStatuses('The RollyPay payment was not completed. You can try card checkout again or use Telegram Stars.', 'error');
      return;
    }
    if (returnState !== 'success' || !returnOrder) return;

    setAllStatuses('Checking RollyPay payment status...', '');
    fetch(LANDING_API_ORIGIN + '/api/rollypay/status?order=' + encodeURIComponent(returnOrder))
      .then((response) => response.json().then((data) => {
        if (!response.ok) throw new Error(data.error || 'status_error');
        return data;
      }))
      .then((data) => {
        if (!data.success || !data.key) {
          setAllStatuses('Payment is being confirmed. The license key will appear here after the webhook and will be sent by email.', '');
          sendLandingAnalytics('card_pending_after_return', { provider: 'rollypay', status: data.status || '' });
          return;
        }
        sendLandingAnalytics('card_license_ready', { provider: 'rollypay', plan: data.plan || '' });
        const cards = document.querySelector('.pricing-cards');
        const starsAlt = document.querySelector('.pricing-stars-alt--primary');
        const cryptoAlt = document.getElementById('crypto-checkout');
        const early = document.querySelector('.pricing-early');
        if (starsAlt) starsAlt.style.display = 'none';
        if (cryptoAlt) cryptoAlt.style.display = 'none';
        if (early) early.style.display = 'none';
        renderCryptoReady(cards, data);
      })
      .catch((error) => {
        setAllStatuses('Could not check RollyPay payment status. The key will still be sent by email after payment confirmation.', 'error');
        sendLandingAnalytics('card_status_failed', { provider: 'rollypay', reason: error.message || 'unknown' });
      });
  }
}

function bindCryptoCheckout() {
  const form = document.getElementById('crypto-checkout-form');
  const emailInput = document.getElementById('crypto-email');
  const button = document.getElementById('crypto-pay-button');
  const status = document.getElementById('crypto-status');
  const amount = document.getElementById('crypto-amount');
  const planButtons = Array.from(document.querySelectorAll('[data-crypto-plan]'));
  if (!form || !emailInput || !button || !status || !amount) return;

  const params = new URLSearchParams(window.location.search || '');
  const requestedPlan = params.get('plan') || '';
  const returnOrder = params.get('order') || '';
  const returnState = params.get('plisio') || '';
  let selectedPlan = requestedPlan || 'crypto_30d';
  let cryptoPlans = {
    crypto_30d: { plan: 'crypto_30d', price: '2.99', days: 30, label: '30 days' },
    crypto_yearly: { plan: 'crypto_yearly', price: '24.99', days: 365, label: 'Yearly' },
    crypto_video_30d: { plan: 'crypto_video_30d', price: '9.99', days: 30, label: 'OMNI Video 30 days' }
  };

  const getSelectedPlan = () => cryptoPlans[selectedPlan] || cryptoPlans.crypto_30d;
  const syncSelectedPlan = () => {
    const plan = getSelectedPlan();
    amount.textContent = plan.label + ' · $' + plan.price;
    planButtons.forEach((planButton) => {
      const active = planButton.dataset.cryptoPlan === plan.plan;
      planButton.classList.toggle('crypto-plan-option--active', active);
      planButton.setAttribute('aria-pressed', active ? 'true' : 'false');
      const price = planButton.querySelector('strong');
      if (price && cryptoPlans[planButton.dataset.cryptoPlan]) {
        price.textContent = '$' + cryptoPlans[planButton.dataset.cryptoPlan].price;
      }
    });
    status.dataset.tone = '';
    status.textContent = 'Enter your email to open Plisio checkout for ' + plan.label + '.';
  };

  planButtons.forEach((planButton) => {
    planButton.addEventListener('click', () => {
      if (!cryptoPlans[planButton.dataset.cryptoPlan]) return;
      selectedPlan = planButton.dataset.cryptoPlan;
      syncSelectedPlan();
    });
  });

  syncSelectedPlan();

  fetch(LANDING_API_ORIGIN + '/api/plisio/config')
    .then((response) => response.json().then((data) => {
      if (!response.ok) throw new Error(data.error || 'config_error');
      return data;
    }))
    .then((data) => {
      cryptoPlans = (data.plans || []).reduce((acc, plan) => {
        if (plan.plan && plan.price) acc[plan.plan] = plan;
        return acc;
      }, cryptoPlans);
      selectedPlan = cryptoPlans[requestedPlan] ? requestedPlan : (cryptoPlans[data.defaultPlan] ? data.defaultPlan : 'crypto_30d');
      button.disabled = false;
      syncSelectedPlan();
      checkPlisioReturn();
    })
    .catch((error) => {
      button.disabled = true;
      status.dataset.tone = 'error';
      amount.textContent = 'Unavailable';
      status.textContent = error.message === 'plisio_not_configured'
        ? 'Crypto checkout is being configured. Please use Telegram Stars for now.'
        : 'Could not load crypto checkout. Please use Telegram Stars or try again later.';
      sendLandingAnalytics('crypto_config_failed', { reason: error.message || 'unknown' });
    });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const plan = getSelectedPlan();
    if (!email) return;

    button.disabled = true;
    status.dataset.tone = '';
    status.textContent = 'Creating Plisio checkout...';
    sendLandingAnalytics('buy_crypto_clicked', { surface: 'pricing', provider: 'plisio', plan: plan.plan });

    fetch(LANDING_API_ORIGIN + '/api/plisio/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, plan: plan.plan, source: 'pricing_plisio' })
    })
      .then((response) => response.json().then((data) => {
        if (!response.ok) throw new Error(data.error || 'create_invoice_error');
        return data;
      }))
      .then((data) => {
        if (!data.invoiceUrl) throw new Error('missing_invoice_url');
        window.location.href = data.invoiceUrl;
      })
      .catch((error) => {
        button.disabled = false;
        status.dataset.tone = 'error';
        status.textContent = error.message === 'plisio_not_configured'
          ? 'Crypto checkout is not configured yet. Please use Telegram Stars.'
          : error.message === 'invalid_plan'
            ? 'Choose a crypto plan and try again.'
            : 'Could not create Plisio checkout. Please try again or use Telegram Stars.';
        sendLandingAnalytics('crypto_verification_failed', { reason: error.message || 'unknown' });
      });
  });

  function checkPlisioReturn() {
    if (!returnState) return;
    if (returnState === 'failed') {
      status.dataset.tone = 'error';
      status.textContent = 'The Plisio invoice was not completed. You can create a new checkout or use Telegram Stars.';
      return;
    }
    if (returnState !== 'success' || !returnOrder) return;

    status.dataset.tone = '';
    status.textContent = 'Checking Plisio payment status...';
    fetch(LANDING_API_ORIGIN + '/api/plisio/status?order=' + encodeURIComponent(returnOrder))
      .then((response) => response.json().then((data) => {
        if (!response.ok) throw new Error(data.error || 'status_error');
        return data;
      }))
      .then((data) => {
        if (!data.success || !data.key) {
          status.textContent = 'Payment is being confirmed. The license key will appear here after the webhook and will be sent by email.';
          sendLandingAnalytics('crypto_pending_after_return', { provider: 'plisio', status: data.status || '' });
          return;
        }
        sendLandingAnalytics('crypto_license_ready', { provider: 'plisio', plan: data.plan || '' });
        const cards = document.querySelector('.pricing-cards');
        const starsAlt = document.querySelector('.pricing-stars-alt--primary');
        const cryptoAlt = document.getElementById('crypto-checkout');
        const early = document.querySelector('.pricing-early');
        if (starsAlt) starsAlt.style.display = 'none';
        if (cryptoAlt) cryptoAlt.style.display = 'none';
        if (early) early.style.display = 'none';
        renderCryptoReady(cards, data);
      })
      .catch((error) => {
        status.dataset.tone = 'error';
        status.textContent = 'Could not check Plisio payment status. The key will still be sent by email after payment confirmation.';
        sendLandingAnalytics('crypto_status_failed', { reason: error.message || 'unknown' });
      });
  }
}

function trackPricingView() {
  var path = window.location.pathname || '';
  if (path !== '/pricing' && path !== '/pricing.html') return;
  var params = new URLSearchParams(window.location.search || '');
  sendLandingAnalytics('pricing_view', {
    from: params.get('from') || '',
    plan: params.get('plan') || '',
    path: path
  });
}

function renderCryptoReady(cards, data) {
  if (!cards) return;
  const expires = data.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const planLabel = data.plan === 'crypto_yearly'
    ? 'Image PRO yearly'
    : data.plan === 'crypto_video_30d'
      ? 'OMNI Video 30 days'
      : 'Image PRO 30 days';
  const expiryText = expires
    ? '<p style="color:#B0B0B0;margin-bottom:12px">Plan: <strong style="color:#FFD700">' + planLabel + '</strong> · Expires: ' + expires + '</p>'
    : '';
  cards.innerHTML =
    '<div class="pricing-card" style="max-width:560px;margin:0 auto">' +
    '<h2 style="color:#FFD700;margin-bottom:16px">Your PRO access is active</h2>' +
    expiryText +
    '<p style="color:#B0B0B0;margin-bottom:16px">We also sent this license key to your email.</p>' +
    '<p style="color:#B0B0B0;margin-bottom:12px">Your license key:</p>' +
    '<div id="licenseKeyBox" style="font-family:monospace;font-size:18px;color:#FFD700;background:#1a1a2e;padding:16px;user-select:all;word-break:break-all;border-radius:8px;margin-bottom:12px;cursor:pointer" onclick="navigator.clipboard.writeText(this.textContent);document.getElementById(\'copyBtn\').textContent=\'Copied!\'">' + data.key + '</div>' +
    '<button id="copyBtn" onclick="navigator.clipboard.writeText(document.getElementById(\'licenseKeyBox\').textContent);this.textContent=\'Copied!\'" style="background:#FFD700;color:#000;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:20px">Copy Key</button>' +
    '</div>';
}

function setSliderPosition(beforeEl, handle, pct) {
  beforeEl.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  handle.style.left = pct + '%';
}

function syncSliderAspectRatio(slider, images) {
  const applyAspectRatio = () => {
    for (const image of images) {
      if (!image.naturalWidth || !image.naturalHeight) continue;
      slider.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
      return;
    }
  };

  applyAspectRatio();
  images.forEach((image) => {
    image.addEventListener('load', applyAspectRatio, { once: true });
  });
}

// --- Аналитика ---

function sendLandingAnalytics(eventType, properties) {
  if (!LANDING_ANALYTICS_URL) return;

  const payload = JSON.stringify({
    uid: 'landing-en',
    event: eventType,
    source: 'landing-en',
    ts: Date.now(),
    properties: properties || {}
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      LANDING_ANALYTICS_URL,
      new Blob([payload], { type: 'application/json' })
    );
    return;
  }

  fetch(LANDING_ANALYTICS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true
  }).catch(() => {});
}
