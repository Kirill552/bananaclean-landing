// Banana Clean EN Landing — интерактив

const FALLBACK_ANALYTICS_ORIGIN = 'https://banana-clean.app';
const LANDING_API_ORIGIN = resolveLandingApiOrigin();
const LANDING_ANALYTICS_URL = LANDING_API_ORIGIN ? LANDING_API_ORIGIN + '/collect' : '';
bindFaqAccordion();
bindStickyInstall();
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
