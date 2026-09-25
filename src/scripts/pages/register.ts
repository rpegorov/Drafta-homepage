/* /register/ and /ru/register/ — account creation. Ported 1:1 from the old
   inline script (commit c497677): no sign-in on success, the tokens the
   service returns are never stored before the address is confirmed. */
import { normalizeLang } from '../../i18n';
import { clearError, post, setBusy, showError, validateEmail, validatePassword } from '../forms';
import { endpoints } from '../../lib/config';
import type { Lang } from '../../lib/types';

const MESSAGES: Record<Lang, { mismatch: string; exists: string; offline: string; generic: string }> = {
  en: {
    mismatch: 'The two passwords do not match.',
    exists: 'This email is already registered.',
    offline: 'We could not reach the accounts service. Check your connection and try again.',
    generic: 'We could not create the account. Please try again.',
  },
  ru: {
    mismatch: 'Пароли не совпадают.',
    exists: 'Этот адрес уже зарегистрирован.',
    offline: 'Не удалось связаться со службой аккаунтов. Проверьте соединение и попробуйте снова.',
    generic: 'Не удалось создать аккаунт. Попробуйте снова.',
  },
};

function reveal(el: HTMLElement | null): void {
  if (!el) return;
  el.hidden = false;
  el.classList.remove('is-hidden');
}

function conceal(el: HTMLElement | null): void {
  if (!el) return;
  el.hidden = true;
  el.classList.add('is-hidden');
}

const LANG = normalizeLang(document.documentElement.lang);
const MSG = MESSAGES[LANG];
const form = document.querySelector<HTMLFormElement>('[data-register-form]');
const sent = document.querySelector<HTMLElement>('[data-register-sent]');
const sentEmail = document.querySelector<HTMLElement>('[data-sent-email]');
const signIn = document.querySelector<HTMLElement>('[data-signin]');
const emailEl = document.getElementById('email') as HTMLInputElement | null;
const passwordEl = document.getElementById('password') as HTMLInputElement | null;
const confirmEl = document.getElementById('password-confirm') as HTMLInputElement | null;

if (form && emailEl && passwordEl && confirmEl) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearError(form);
    conceal(signIn);

    const email = emailEl.value.trim();
    const password = passwordEl.value;
    const confirmation = confirmEl.value;

    const problem = validateEmail(email, LANG)
      || validatePassword(password, LANG)
      || (password !== confirmation ? MSG.mismatch : '');

    if (problem) {
      showError(form, problem);
      return;
    }

    setBusy(form, true);

    post(endpoints.register, { email, password }).then((res) => {
      setBusy(form, false);

      if (res.ok) {
        // Deliberately no sign-in here: the tokens the service returns are
        // not stored, and nothing claims the account is active before the
        // address is confirmed by the link we just mailed.
        if (sentEmail) sentEmail.textContent = typeof res.data?.email === 'string' ? res.data.email : email;
        conceal(form);
        reveal(sent);
        return;
      }

      const status = res.status;
      const serverMessage = typeof res.data?.error === 'string' ? res.data.error : '';

      if (status === 409) {
        showError(form, serverMessage || MSG.exists);
        reveal(signIn);
        return;
      }

      showError(form, serverMessage || (status === 0 ? MSG.offline : MSG.generic));
    });
  });
}
