/* Drafta — language handling.
   §5b/§6 of the build contract. Loads on every page, exposes no API surface,
   and is safe on a page that never uses it. It never rewrites page text:
   translation is by file, and the switcher is a plain link that works without
   JavaScript. This file only (1) remembers an explicit choice and (2) sends a
   Russian browser from an English page to its /ru/ twin. */

(function () {
  'use strict';

  var KEY = 'drafta_lang';

  function store(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* private mode */ }
  }

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  /* Russian lives under /ru/ (§6), so the path decides first: that keeps the
     redirect below idempotent and cannot loop even if a Russian page forgot
     its lang attribute. The declared lang covers everything else. */
  function isRuPage() {
    if (/^\/ru(\/|$)/.test(location.pathname)) return true;
    var declared = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    return declared.indexOf('ru') === 0;
  }

  /* "/ru" + pathname on an EN page; pathname minus "/ru" on an RU page. */
  function twinUrl() {
    var path = location.pathname;
    if (isRuPage()) {
      var stripped = path.replace(/^\/ru(?=\/|$)/, '');
      return stripped === '' ? '/' : stripped;
    }
    return '/ru' + path;
  }

  function preferredLanguage() {
    var list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || ''];
    return String(list[0] || '').toLowerCase();
  }

  /* A same-site ?next= (the login page's return address) follows the visitor to
     the Russian twin too, so signing in does not land them on an English page. */
  function ruSearch(search) {
    return String(search || '').replace(/([?&]next=)(%2F|\/)(?!ru(%2F|\/))/i, '$1$2ru$2');
  }

  /* (2) explicit choice — the link still navigates by itself. */
  document.addEventListener('click', function (event) {
    var node = event.target;
    if (!node || typeof node.closest !== 'function') return;
    var link = node.closest('a[data-lang]');
    if (!link) return;
    var value = link.getAttribute('data-lang');
    if (value) store(value);
  });

  /* (1) first visit from a Russian browser, no choice recorded yet: hand the
     visitor to the Russian twin, keeping the query string and hash so that a
     confirmation link (?token=…) is not stripped. */
  if (!isRuPage() && !stored() && preferredLanguage().indexOf('ru') === 0) {
    location.replace(twinUrl() + ruSearch(location.search) + location.hash);
  }
})();
