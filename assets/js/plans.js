/* Drafta — pricing.
   §5b of the build contract. Plain script (no modules, no bundler): it hangs
   formatPrice / formatStorage / formatNotes / loadPlans / renderPlans on
   window.DRAFTA and does nothing until a page calls renderPlans. Safe to load on
   a page that never calls it.

   ONE PLAN, TWO BILLING CARDS, ONE SHARED LIST. The product is a single plan
   with a monthly and a yearly billing option — two cards ARE the choice, so
   there is no period switch and no badge. The renderer keeps only the entries
   whose `billing` is "monthly" or "yearly"; a "one_time" licence tier or any
   future tier is filtered out and never reaches the DOM.

   Inside the container it renders, in order: the two sibling `.plan` cards (the
   yearly one first and featured, because it is the one to sell), then ONE
   `.plan__list` BELOW both cards — not inside either of them — and finally a
   muted trial sentence. Storage and notes are read from the plan object, never
   from a literal, so the moment the service sends new numbers the page follows. */

(function () {
  'use strict';

  var DRAFTA = window.DRAFTA = window.DRAFTA || {};

  var PERIODS = ['monthly', 'yearly'];
  /* Card order per §5b: the yearly card first, the monthly card second. */
  var ORDER = ['yearly', 'monthly'];
  var GIB = 1073741824;

  var COPY = {
    en: {
      periodLabel: { monthly: 'Monthly billing', yearly: 'Annual billing' },
      periodShort: { monthly: 'month', yearly: 'year' },
      billedAnnually: '{value} billed annually',
      cloudSync: 'Cloud sync',
      noFees: 'No setup or hidden fees',
      unlimitedStorage: 'Unlimited storage',
      unlimitedNotes: 'Unlimited notes',
      gb: 'GB',
      storage: 'storage',
      note: function (n) { return n === 1 ? 'note' : 'notes'; },
      trial: 'Both billing options start with a 30-day trial — no card required, and you can change your mind later.',
      choose: { monthly: 'Choose monthly', yearly: 'Choose annual' }
    },
    ru: {
      periodLabel: { monthly: 'Оплата за месяц', yearly: 'Оплата за год' },
      periodShort: { monthly: 'мес.', yearly: 'год' },
      billedAnnually: '{value} при оплате за год',
      cloudSync: 'Облачная синхронизация',
      noFees: 'Без платы за подключение и скрытых сборов',
      unlimitedStorage: 'Хранилище без ограничений',
      unlimitedNotes: 'Заметки без ограничений',
      gb: 'ГБ',
      /* After a quantity the noun stays in the genitive singular ("30 ГБ
         хранилища", "1 ГБ хранилища"), so no plural rule is needed here. */
      storage: 'хранилища',
      note: function (n) {
        var mod10 = n % 10, mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return 'заметка';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заметки';
        return 'заметок';
      },
      trial: 'Оба варианта начинаются с 30-дневного триала — карта не нужна, передумать можно в любой момент.',
      choose: { monthly: 'Оформить на месяц', yearly: 'Оформить на год' }
    }
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

  function fill(template, value) {
    return String(template).split('{value}').join(String(value));
  }

  function group(number, lang) {
    var sep = lang === 'ru' ? '\u00a0' : ',';
    return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }

  function pageLang(lang) { return lang === 'ru' ? 'ru' : 'en'; }

  /* 9588 -> "$95.88"; 0 -> "—". Prices are billed in US cents for both languages. */
  DRAFTA.formatPrice = function (cents, lang) {
    void lang;
    var value = Number(cents);
    if (!isFinite(value) || value <= 0) return '—';
    return '$' + (value / 100).toFixed(2);
  };

  /* 32212254720 -> "30 GB storage"; <= 0 or absent -> "Unlimited storage"
     (§5b, §7). Binary units (GiB), the unit the service itself reports. The noun
     belongs to the phrase, so a caller renders this whole line and never
     appends a noun of its own. */
  DRAFTA.formatStorage = function (bytes, lang) {
    var c = copy(lang);
    var value = Number(bytes);
    if (!isFinite(value) || value <= 0) return c.unlimitedStorage;
    var rounded = Math.round((value / GIB) * 10) / 10;
    var text = Math.abs(rounded - Math.round(rounded)) < 0.05
      ? String(Math.round(rounded))
      : rounded.toFixed(1);
    return text + ' ' + c.gb + ' ' + c.storage;
  };

  /* The grouped count plus its noun; <= 0 or absent -> "Unlimited notes" (§5b, §7). */
  DRAFTA.formatNotes = function (count, lang) {
    var c = copy(lang);
    var value = Number(count);
    if (!isFinite(value) || value <= 0) return c.unlimitedNotes;
    var whole = Math.round(value);
    return group(whole, pageLang(lang)) + ' ' + c.note(whole);
  };

  /* §5b, mode "link": the frozen EN shape is /checkout/?plan=<code>. On a Russian
     page the twin of that page is /ru/checkout/ (§6, all internal links on /ru/
     pages carry the /ru prefix), so the language decides the prefix. */
  function checkoutHref(code, lang) {
    return (lang === 'ru' ? '/ru' : '') + '/checkout/?plan=' + encodeURIComponent(code);
  }

  /* The code a ?plan= on the current URL refers to, so the matching card can be
     marked as selected. Selection is styling only — nothing is posted (§5b). */
  function requestedCode() {
    try {
      var search = window.location && window.location.search
        ? String(window.location.search)
        : '';
      var match = /[?&]plan=([^&#]*)/.exec(search);
      return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
    } catch (error) {
      return '';
    }
  }

  /* One card. The yearly card's price line is its monthly equivalent — that is
     the figure a reader compares — and it carries the annual total as a muted
     note beneath it. The monthly card is the quiet alternative. */
  function cardHtml(plan, lang, mode, isFeatured, selected) {
    var c = copy(lang);
    var equivalent = plan.billing === 'yearly' && Number(plan.monthlyCents) > 0;
    var headline = equivalent ? Number(plan.monthlyCents) : Number(plan.priceCents);
    var unit = c.periodShort[equivalent ? 'monthly' : plan.billing] || '';
    var priceClass = 'plan__price' + (equivalent ? ' plan__equiv' : '');
    var ctaClass = 'plan__cta btn ' + (isFeatured ? 'btn--primary plan__cta--featured' : 'btn--ghost');
    var label = c.choose[plan.billing] || c.choose.yearly;
    var cta = mode === 'buy'
      ? '<button type="button" class="' + ctaClass + '" data-plan="' + esc(plan.code) + '">' + esc(label) + '</button>'
      : '<a class="' + ctaClass + '" href="' + esc(checkoutHref(String(plan.code || ''), lang)) + '">' + esc(label) + '</a>';

    return '<article class="plan' + (isFeatured ? ' plan--featured' : '')
      + (selected ? ' plan--selected' : '') + '" data-period="' + esc(plan.billing) + '">'
      + '<h3 class="plan__name">' + esc(c.periodLabel[plan.billing] || '') + '</h3>'
      + '<div class="' + priceClass + '">' + esc(DRAFTA.formatPrice(headline, lang))
      + '<span class="plan__period"> / ' + esc(unit) + '</span></div>'
      + (equivalent
        ? '<div class="plan__note">' + esc(fill(c.billedAnnually, DRAFTA.formatPrice(plan.priceCents, lang))) + '</div>'
        : '')
      + cta
      + '</article>';
  }

  /* The shared checklist: one `.plan__list` below both cards, so the two pages
     cannot drift. Storage and notes come from the plan object, never a literal. */
  function listHtml(plan, lang) {
    var c = copy(lang);
    var items = [
      c.cloudSync,
      DRAFTA.formatNotes(plan.quotaNotes, lang),
      DRAFTA.formatStorage(plan.quotaBytes, lang),
      c.noFees
    ];
    return '<ul class="plan__list">'
      + items.map(function (item) {
        return '<li class="plan__item"><span class="plan__tick" aria-hidden="true"></span>' + esc(item) + '</li>';
      }).join('')
      + '</ul>';
  }

  /* Builds the two cards, the shared list and the trial line. Returns false when
     the data carries no sellable period, in which case nothing is rendered. */
  function renderPricing(el, plans, lang, mode, options, selectedCode) {
    var c = copy(lang);
    var byPeriod = {};
    var i;
    for (i = 0; i < plans.length; i++) {
      var plan = plans[i];
      if (plan && PERIODS.indexOf(plan.billing) !== -1 && !byPeriod[plan.billing]) {
        byPeriod[plan.billing] = plan;
      }
    }
    var periods = ORDER.filter(function (key) { return !!byPeriod[key]; });
    if (!periods.length) { el.innerHTML = ''; return false; }

    var cards = periods.map(function (key) {
      var card = byPeriod[key];
      /* A ?plan= on the URL marks its card in both modes: the landing's link
         cards point at a period, and the checkout page (buy mode) must show the
         buyer which card the link referred to (§5b, §11). Styling only — it
         never posts anything. */
      var selected = !!selectedCode && String(card.code) === String(selectedCode);
      return cardHtml(card, lang, mode, key === 'yearly', selected);
    }).join('');

    /* The list is shared by both cards, so it is filled from the first sellable
       plan — today both periods carry the same quota. */
    el.classList.add('plans');
    el.innerHTML = cards
      + listHtml(byPeriod[periods[0]], lang)
      + '<p class="plan__trial">' + esc(c.trial) + '</p>';

    /* A container that cannot be queried (a test stub, an XML document) must not
       take the caller's initialisation down: the markup is in place, the buttons
       simply cannot be wired. */
    if (typeof el.querySelector !== 'function') return true;

    if (mode === 'buy' && typeof options.onSelect === 'function') {
      var cards2 = el.querySelectorAll('.plan');
      Array.prototype.forEach.call(cards2, function (card) {
        var button = card.querySelector('.plan__cta[data-plan]');
        var owner = byPeriod[card.getAttribute('data-period')];
        if (!button || !owner) return;
        button.addEventListener('click', function () { options.onSelect(owner); });
      });
    }

    return true;
  }

  function fallback() {
    var list = DRAFTA.planFallback;
    return Array.isArray(list) ? list.slice() : [];
  }

  /* One request per page load: the checkout renders cards, a quota line and a
     deep-link hint from the same list, and each caller shares this promise. */
  var pending = null;

  /* Promise<plan[]> — API first, planFallback on any failure or bad shape. The
     array is returned as the service sent it; keeping only the sellable periods
     is the renderer's job (§5b). */
  DRAFTA.loadPlans = function () {
    if (!pending) pending = fetchPlans();
    return pending.then(function (plans) { return plans.slice(); });
  };

  function fetchPlans() {
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
  }

  /* Fills el with the .plans markup: two billing cards, the shared list below
     them and the trial line. Returns Promise<void>. */
  DRAFTA.renderPlans = function (el, opts) {
    if (!el || typeof el.innerHTML !== 'string') return Promise.resolve();
    var options = opts || {};
    var lang = options.lang === 'ru' ? 'ru' : 'en';
    var mode = options.mode === 'buy' ? 'buy' : 'link';

    return DRAFTA.loadPlans().then(function (plans) {
      var kept = (plans || []).filter(function (plan) {
        return plan && PERIODS.indexOf(plan.billing) !== -1;
      });
      renderPricing(el, kept, lang, mode, options, requestedCode());
    });
  };
})();
