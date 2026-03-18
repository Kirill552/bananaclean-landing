// Banana Clean EN Landing — интерактив

const FALLBACK_ANALYTICS_ORIGIN = 'https://banana-clean.app';
const LANDING_API_ORIGIN = resolveLandingApiOrigin();
const LANDING_ANALYTICS_URL = LANDING_API_ORIGIN ? LANDING_API_ORIGIN + '/collect' : '';
const LANDING_PUBLIC_METRICS_URL = LANDING_API_ORIGIN ? LANDING_API_ORIGIN + '/api/public-metrics' : '';
const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/banana-clean-—-remove-gem/kodhinmeeokhkhelmmpnflnhapifgfah';
const SLIDER_MIN_POSITION = 1;
const SLIDER_MAX_POSITION = 99;
const SLIDER_INITIAL_POSITION = 85;
const PUBLIC_COUNTER_REFRESH_MS = 30000;
const PAYPAL_ACTIVATE_URL = 'https://banana-clean.app/api/activate-subscription';
const PAYPAL_PLANS_URL = 'https://banana-clean.app/api/plans';

bindFaqAccordion();
bindStatsCounter();
bindPublicCleanedCounter();
bindBeforeAfterSlider();
applyInstallLinks();
bindInstallTracking();
bindStickyInstall();
bindPayPalButtons();
bindBuyStars();

function resolveLandingApiOrigin() {
  if (window.location.protocol === 'file:') return FALLBACK_ANALYTICS_ORIGIN;
  return window.location.origin;
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

// --- Анимация счётчиков ---

function bindStatsCounter() {
  const counters = document.querySelectorAll('.stat__value[data-target]');
  if (!counters.length) return;

  const statsSection = document.getElementById('stats');
  if (!statsSection) return;

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      counters.forEach(animateCounter);
      statsObserver.disconnect();
    });
  }, { threshold: 0.3 });

  statsObserver.observe(statsSection);
}

// --- Публичный счётчик очищений ---

function bindPublicCleanedCounter() {
  const counter = document.getElementById('publicCleanedCount');
  if (!counter || !LANDING_PUBLIC_METRICS_URL) return;

  loadPublicCleanedCounter(counter);
  window.setInterval(() => {
    loadPublicCleanedCounter(counter);
  }, PUBLIC_COUNTER_REFRESH_MS);
}

// --- Before/After слайдер ---

function bindBeforeAfterSlider() {
  const slider = document.getElementById('ba-slider');
  const handle = document.getElementById('ba-handle');
  if (!slider || !handle) return;

  const beforeEl = slider.querySelector('.ba-slider__before');
  const images = slider.querySelectorAll('img');
  let dragging = false;

  syncSliderAspectRatio(slider, images);
  setSliderPosition(beforeEl, handle, SLIDER_INITIAL_POSITION);

  const updatePosition = (x) => {
    const rect = slider.getBoundingClientRect();
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

// --- Ссылки на установку ---

function applyInstallLinks() {
  applyInstallLink('hero-install-link', CHROME_STORE_URL);
  applyInstallLink('chrome-link', CHROME_STORE_URL);
  applyInstallLink('sticky-install-link', CHROME_STORE_URL);
}

function applyInstallLink(id, targetUrl) {
  const link = document.getElementById(id);
  if (!link) return;
  link.href = targetUrl || '#install';
}

// --- Трекинг кликов по установке ---

function bindInstallTracking() {
  bindInstallButton('hero-install-link', 'hero');
  bindInstallButton('chrome-link', 'chrome');
  bindInstallButton('sticky-install-link', 'sticky');
}

function bindInstallButton(id, surface) {
  const button = document.getElementById(id);
  if (!button) return;

  button.addEventListener('click', () => {
    sendLandingAnalytics('install_clicked', {
      browser: surface,
      path: window.location.pathname
    });
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
  const button = document.getElementById('buy-stars-button');
  if (!button) return;

  button.addEventListener('click', () => {
    sendLandingAnalytics('buy_stars_clicked', { surface: 'pricing' });
  });
}

function bindPayPalButtons() {
  if (typeof paypal === 'undefined') return;

  var monthlyContainer = document.getElementById('paypal-button-monthly');
  var yearlyContainer = document.getElementById('paypal-button-yearly');
  if (!monthlyContainer && !yearlyContainer) return;

  fetch(PAYPAL_PLANS_URL)
    .then(function (res) { return res.json(); })
    .then(function (plans) {
      var monthlyPlanId = plans.monthly && plans.monthly.planId;
      var yearlyPlanId = plans.yearly && plans.yearly.planId;
      if (monthlyPlanId && monthlyContainer) {
        renderSubscriptionButton(monthlyPlanId, '#paypal-button-monthly', 'paypal-status-monthly', 'monthly');
      }
      if (yearlyPlanId && yearlyContainer) {
        renderSubscriptionButton(yearlyPlanId, '#paypal-button-yearly', 'paypal-status-yearly', 'yearly');
      }
    })
    .catch(function (err) {
      console.error('Failed to load plans:', err);
    });
}

function renderSubscriptionButton(planId, containerSelector, statusId, planName) {
  var status = document.getElementById(statusId);

  paypal.Buttons({
    style: { layout: 'vertical', color: planName === 'yearly' ? 'gold' : 'blue', shape: 'rect', label: 'subscribe', height: 45 },
    createSubscription: function (data, actions) {
      sendLandingAnalytics('buy_paypal_clicked', { surface: 'pricing', plan: planName });
      return actions.subscription.create({ plan_id: planId });
    },
    onApprove: function (data) {
      if (status) status.textContent = 'Activating subscription...';
      return fetch(PAYPAL_ACTIVATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: data.subscriptionID,
          plan: planName,
          source: 'landing-en'
        })
      })
        .then(function (res) { return res.json(); })
        .then(function (result) {
          if (result.success && result.key) {
            sendLandingAnalytics('paypal_subscription_activated', { surface: 'pricing', plan: planName });
            showLicenseKey(result.key, result.plan, result.expiresAt);
          } else {
            if (status) status.textContent = 'Activation issue. Contact support via Telegram.';
          }
        });
    },
    onError: function (err) {
      console.error('PayPal error:', err);
      if (status) status.textContent = 'Something went wrong. Please try again.';
    },
    onCancel: function () {
      if (status) status.textContent = '';
    }
  }).render(containerSelector);
}

function showLicenseKey(key, plan, expiresAt) {
  var heroSection = document.querySelector('.pricing-cards');
  if (!heroSection) return;

  var planLabel = plan === 'yearly' ? 'Yearly' : plan === 'monthly' ? 'Monthly' : 'PRO';
  var expiryText = '';
  if (expiresAt) {
    var expiryDate = new Date(expiresAt);
    expiryText = '<p style="color:#B0B0B0;margin-bottom:12px">Plan: <strong style="color:#FFD700">' + planLabel + '</strong> · Renews: ' + expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</p>';
  }

  heroSection.innerHTML =
    '<div class="pricing-card" style="max-width:560px;margin:0 auto">' +
    '<h2 style="color:#FFD700;margin-bottom:16px">Subscription activated!</h2>' +
    expiryText +
    '<p style="color:#B0B0B0;margin-bottom:12px">Your license key:</p>' +
    '<div style="font-family:monospace;font-size:18px;color:#FFD700;background:#1a1a2e;padding:16px;user-select:all;word-break:break-all;border-radius:8px;margin-bottom:16px">' + key + '</div>' +
    '<p style="color:#B0B0B0;line-height:1.6">Copy this key and paste it into the Banana Clean extension popup to activate PRO.</p>' +
    '</div>';

  var starsAlt = document.querySelector('.pricing-stars-alt');
  if (starsAlt) starsAlt.style.display = 'none';
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

// --- Загрузка публичного счётчика ---

function loadPublicCleanedCounter(counter) {
  fetch(LANDING_PUBLIC_METRICS_URL, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('Failed to load public metrics');
      return response.json();
    })
    .then((payload) => {
      const nextValue = Number(payload.totalCleaned || 0);
      counter.textContent = formatCounterValue(nextValue);
      if (payload.lastUpdatedAt) {
        counter.title = 'Updated: ' + new Date(payload.lastUpdatedAt).toLocaleString('en-US');
      }
    })
    .catch(() => {});
}

// --- Утилиты ---

function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const duration = 1200;
  const start = performance.now();

  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = prefix + Math.round(eased * target) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

function formatCounterValue(value) {
  return new Intl.NumberFormat('en-US').format(value);
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
