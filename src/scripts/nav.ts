/* Drafta — the section menu below the single breakpoint. Loads on every page.
   Without this module the header still works: under 820px the section links
   wrap onto a second row (site.css). With it, the header gets .nav--menu, the
   links fold behind the toggle button, and the button opens and closes them. */

const WIDE_QUERY = '(min-width: 821px)';

export function initNav(root: Document = document): void {
  const header = root.querySelector<HTMLElement>('.nav');
  const button = header?.querySelector<HTMLButtonElement>('.nav__toggle');
  const links = header?.querySelector<HTMLElement>('.nav__links');
  if (!header || !button || !links) return;

  const setOpen = (open: boolean): void => {
    header.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  header.classList.add('nav--menu');
  button.hidden = false;
  setOpen(false);

  button.addEventListener('click', () => {
    setOpen(button.getAttribute('aria-expanded') !== 'true');
  });

  /* Following a section link scrolls the page, so the panel gets out of the way. */
  links.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    if (target && typeof target.closest === 'function' && target.closest('a')) setOpen(false);
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !header.classList.contains('is-open')) return;
    setOpen(false);
    button.focus();
  });

  root.addEventListener('click', (event) => {
    if (header.classList.contains('is-open') && !header.contains(event.target as Node)) setOpen(false);
  });

  /* Growing past the breakpoint shows the links inline again; a stale open
     state must not come back when the window narrows later. */
  const wide = window.matchMedia(WIDE_QUERY);
  wide.addEventListener('change', (query) => { if (query.matches) setOpen(false); });
}

initNav();
