/* Drafta — the section menu below the single breakpoint.
   Loads on every page. Without this file the header still works: under 820px the
   section links wrap onto a second row (site.css). With it, the header gets the
   .nav--menu class, the links fold behind the toggle button, and the button
   opens and closes them. */

(function () {
  'use strict';

  var header = document.querySelector('.nav');
  var button = header && header.querySelector('.nav__toggle');
  var links = header && header.querySelector('.nav__links');
  if (!header || !button || !links) return;

  var wide = window.matchMedia('(min-width: 821px)');

  function setOpen(open) {
    header.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  header.classList.add('nav--menu');
  button.hidden = false;
  setOpen(false);

  button.addEventListener('click', function () {
    setOpen(button.getAttribute('aria-expanded') !== 'true');
  });

  /* Following a section link scrolls the page, so the panel gets out of the way. */
  links.addEventListener('click', function (event) {
    if (event.target && typeof event.target.closest === 'function' && event.target.closest('a')) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !header.classList.contains('is-open')) return;
    setOpen(false);
    button.focus();
  });

  document.addEventListener('click', function (event) {
    if (header.classList.contains('is-open') && !header.contains(event.target)) setOpen(false);
  });

  /* Growing past the breakpoint shows the links inline again; a stale open
     state must not come back when the window narrows later. */
  var onWide = function (query) { if (query.matches) setOpen(false); };
  if (typeof wide.addEventListener === 'function') wide.addEventListener('change', onWide);
  else if (typeof wide.addListener === 'function') wide.addListener(onWide);
})();
