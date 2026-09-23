/* Drafta — pricing.
   §5b of the build contract. Plain script (no modules, no bundler): it hangs
   formatPrice / loadPlans / renderPlans on window.DRAFTA and does nothing until
   a page calls renderPlans. Safe to load on a page that never calls it.

   Prices come from GET {api}{endpoints.plans}; DRAFTA.planFallback is the
   offline path so a failed request never leaves an empty pricing section.
   There is no free plan. */

(function () {
  'use strict';

  var DRAFTA = window.DRAFTA = window.DRAFTA || {};

  var FEATURED_CODE = 'pro_yearly';
  var GIB = 1073741824;

  /* Localised display names. The fallback/API payload keeps its own (English)
     names byte for byte; only the rendered heading is translated. */
  var NAMES = {
    ru: { pro_yearly: 'Pro — годовой', pro_monthly: 'Pro — месячный', lifetime: 'Lifetime' }
  };

  var COPY = {
    en: {
      badge: 'Best value',
      period: { yearly: 'per year', monthly: 'per month', one_time: 'one-time payment' },
      month: 'month',
      gib: 'GiB sync storage',
      notes: 'notes',
      choose: function (name) { return 'Choose ' + name; },
      buy: 'Continue',
      plans: ['Every Drafta feature — no cut-down edition'],
      lifetime: ['One payment, no subscription']
    },
    ru: {
      badge: 'Выгоднее всего',
      period: { yearly: 'в год', monthly: 'в месяц', one_time: 'разовый платёж' },
      month: 'мес.',
      gib: 'ГБ хранилища',
      notes: 'заметок',
      choose: function (name) { return 'Выбрать ' + name; },
      buy: 'Продолжить',
      plans: ['Все возможности Drafta — без урезанной версии'],
      lifetime: ['Один платёж, без подписки']
    }
  };

  /* Product facts only — §8 of the contract, never a promise Drafta does not keep. */
  var SHARED = {
    en: ['Sync between your Macs', 'Notes stay plain Markdown files', 'Native Swift app, not Electron'],
    ru: ['Синхронизация между вашими Mac', 'Заметки остаются обычными Markdown-файлами', 'Нативное Swift-приложение, не Electron']
  };

  function copy(lang) { return COPY[lang === 'ru' ? 'ru' : 'en']; }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function group(number, lang) {
    var sep = lang === 'ru' ? '\u00a0' : ',';
    return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }

  /* 9588 -> "$95.88"; 0 -> "—". Prices are billed in US cents for both languages. */
  DRAFTA.formatPrice = function (cents, lang) {
    void lang;
    var value = Number(cents);
    if (!isFinite(value) || value <= 0) return '—';
    return '$' + (value / 100).toFixed(2);
  };

  function planName(plan, lang) {
    var table = NAMES[lang === 'ru' ? 'ru' : 'en'];
    if (table && table[plan.code]) return table[plan.code];
    return plan.name || plan.code || '';
  }

  function quotaLine(plan, lang) {
    var c = copy(lang);
    var bytes = Number(plan.quotaBytes);
    var giB = isFinite(bytes) && bytes > 0 ? Math.round(bytes / GIB) : 0;
    var size = giB > 0 ? group(giB, lang) + ' ' + c.gib : '—';
    var notes = isFinite(Number(plan.quotaNotes)) && Number(plan.quotaNotes) > 0
      ? group(Number(plan.quotaNotes), lang) + ' ' + c.notes
      : '';
    return notes ? size + ' \u00b7 ' + notes : size;
  }

  function features(plan, lang) {
    var l = lang === 'ru' ? 'ru' : 'en';
    var list = (plan.billing === 'one_time' ? COPY[l].lifetime : COPY[l].plans).concat(SHARED[l]);
    return list;
  }

  /* §5b, mode "link": the frozen EN shape is /checkout/?plan=<code>. On a
     Russian page the twin of that page is /ru/checkout/ (§6, all internal links
     on /ru/ pages carry the /ru prefix), so the language decides the prefix. */
  function checkoutHref(code, lang) {
    return (lang === 'ru' ? '/ru' : '') + '/checkout/?plan=' + encodeURIComponent(code);
  }

  function cardHtml(plan, lang, mode) {
    var c = copy(lang);
    var featured = plan.code === FEATURED_CODE;
    var name = planName(plan, lang);
    var period = c.period[plan.billing] || '';
    var equiv = plan.billing === 'yearly' && Number(plan.monthlyCents) > 0
      ? DRAFTA.formatPrice(plan.monthlyCents, lang) + ' / ' + c.month
      : '';
    var ctaClass = 'plan__cta btn ' + (featured ? 'btn--primary plan__cta--featured' : 'btn--ghost');
    var cta = mode === 'buy'
      ? '<button type="button" class="' + ctaClass + '" data-plan="' + esc(plan.code) + '">' + esc(c.buy) + '</button>'
      : '<a class="' + ctaClass + '" href="' + esc(checkoutHref(plan.code, lang)) + '">' + esc(c.choose(name)) + '</a>';

    return '<article class="plan' + (featured ? ' plan--featured' : '') + '">'
      + (featured ? '<div class="plan__badge">' + esc(c.badge) + '</div>' : '')
      + '<h3 class="plan__name">' + esc(name) + '</h3>'
      + '<div class="plan__price">' + esc(DRAFTA.formatPrice(plan.priceCents, lang)) + '</div>'
      + '<div class="plan__period">' + esc(period) + '</div>'
      + (equiv ? '<div class="plan__equiv">' + esc(equiv) + '</div>' : '')
      + '<div class="plan__note">' + esc(quotaLine(plan, lang)) + '</div>'
      + '<ul class="plan__list">'
      + features(plan, lang).map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('')
      + '</ul>'
      + cta
      + '</article>';
  }

  function fallback() {
    var list = DRAFTA.planFallback;
    return Array.isArray(list) ? list.slice() : [];
  }

  /* Promise<plan[]> — API first, planFallback on any failure or bad shape. */
  DRAFTA.loadPlans = function () {
    var url = String(DRAFTA.api || '') + String((DRAFTA.endpoints || {}).plans || '');
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('plans ' + response.status);
        return response.json();
      })
      .then(function (data) {
        var plans = data && data.plans;
        if (!Array.isArray(plans) || !plans.length) throw new Error('plans payload');
        return plans;
      })
      .catch(function () { return fallback(); });
  };

  /* Fills el with the .plans markup. Returns Promise<void>. */
  DRAFTA.renderPlans = function (el, opts) {
    if (!el || typeof el.innerHTML !== 'string') return Promise.resolve();
    var options = opts || {};
    var lang = options.lang === 'ru' ? 'ru' : 'en';
    var mode = options.mode === 'buy' ? 'buy' : 'link';

    return DRAFTA.loadPlans().then(function (plans) {
      if (el.classList && !el.classList.contains('plans')) el.classList.add('plans');
      el.innerHTML = plans.map(function (plan) { return cardHtml(plan, lang, mode); }).join('');

      if (mode === 'buy' && typeof options.onSelect === 'function') {
        var buttons = el.querySelectorAll('button[data-plan]');
        Array.prototype.forEach.call(buttons, function (button) {
          button.addEventListener('click', function () {
            var code = button.getAttribute('data-plan');
            var plan = plans.filter(function (item) { return item.code === code; })[0];
            if (plan) options.onSelect(plan);
          });
        });
      }
    });
  };
})();
