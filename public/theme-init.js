/* Drafta — colour theme, set before first paint. The page ships as
   data-theme="paper"; a reader whose system is dark gets the brand's dark
   theme "sumi", and the page follows the system when it changes. A plain
   blocking file (not inline) so a script-src 'self' CSP allows it. */
(function () {
  'use strict';
  var query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function apply() {
    document.documentElement.setAttribute('data-theme', query && query.matches ? 'sumi' : 'paper');
  }
  apply();
  if (query && typeof query.addEventListener === 'function') query.addEventListener('change', apply);
})();
