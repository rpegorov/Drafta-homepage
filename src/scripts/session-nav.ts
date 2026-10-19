/* Shows the header "Account" link once a session exists. The markup ships the
   link hidden with its href already set for the page language. */
import { accessToken } from './session';

export function showAccountLink(root: Document = document): void {
  if (!accessToken()) return;
  for (const link of root.querySelectorAll<HTMLElement>('[data-account-link]')) {
    link.hidden = false;
    link.classList.remove('is-hidden');
  }
}

showAccountLink();
