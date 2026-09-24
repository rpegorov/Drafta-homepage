/* Drafta — form validation, form messages and the one JSON call.
   §5b of the build contract. Plain script: it hangs validateEmail /
   validatePassword / showError / clearError / showOk / setBusy / post on
   window.DRAFTA and does nothing until a page calls them. */

(function () {
  'use strict';

  var DRAFTA = window.DRAFTA = window.DRAFTA || {};

  var MESSAGES = {
    en: {
      emailRequired: 'Enter your email address.',
      emailInvalid: 'That does not look like an email address.',
      emailSpaces: 'An email address cannot contain spaces.',
      passwordShort: 'Password must be at least 8 characters.',
      passwordLong: 'Password must be at most 1024 characters.',
      offline: 'Could not reach Drafta. Check your connection and try again.',
      badResponse: 'The server sent an unexpected response.'
    },
    ru: {
      emailRequired: 'Введите адрес электронной почты.',
      emailInvalid: 'Это не похоже на адрес электронной почты.',
      emailSpaces: 'Адрес не может содержать пробелы.',
      passwordShort: 'Пароль должен быть не короче 8 символов.',
      passwordLong: 'Пароль должен быть не длиннее 1024 символов.',
      offline: 'Не удалось связаться с Drafta. Проверьте соединение и попробуйте снова.',
      badResponse: 'Сервер вернул неожиданный ответ.'
    }
  };

  function pageLang() {
    var declared = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    return declared.indexOf('ru') === 0 ? 'ru' : 'en';
  }

  function message(key, lang) {
    return MESSAGES[lang === 'ru' ? 'ru' : 'en'][key];
  }

  /* Mirrors the server (§7): contains "@", no spaces, at least 3 characters. */
  DRAFTA.validateEmail = function (value, lang) {
    var email = typeof value === 'string' ? value : '';
    if (!email) return message('emailRequired', lang);
    if (/\s/.test(email)) return message('emailSpaces', lang);
    if (email.length < 3 || email.indexOf('@') === -1) return message('emailInvalid', lang);
    return '';
  };

  /* Mirrors the server (§7): 8…1024 characters. */
  DRAFTA.validatePassword = function (value, lang) {
    var password = typeof value === 'string' ? value : '';
    if (password.length < 8) return message('passwordShort', lang);
    if (password.length > 1024) return message('passwordLong', lang);
    return '';
  };

  function slot(formEl, className, create) {
    if (!formEl || typeof formEl.querySelector !== 'function') return null;
    var node = formEl.querySelector('.' + className);
    if (!node && create) {
      node = document.createElement('p');
      node.className = className;
      formEl.appendChild(node);
    }
    /* Announced to screen readers the moment text lands: an error interrupts,
       a confirmation waits its turn. */
    if (node && !node.hasAttribute('role')) {
      node.setAttribute('role', className === 'form__error' ? 'alert' : 'status');
    }
    return node;
  }

  /* Writes .form__error inside the form. */
  DRAFTA.showError = function (formEl, text) {
    var node = slot(formEl, 'form__error', true);
    if (!node) return;
    node.textContent = text == null ? '' : String(text);
    node.classList.toggle('is-hidden', !node.textContent);
    var ok = slot(formEl, 'form__ok', false);
    if (ok) { ok.textContent = ''; ok.classList.add('is-hidden'); }
  };

  /* Removes .form__error. */
  DRAFTA.clearError = function (formEl) {
    var node = slot(formEl, 'form__error', false);
    if (node && node.parentNode) node.parentNode.removeChild(node);
  };

  /* Writes .form__ok inside the form. */
  DRAFTA.showOk = function (formEl, text) {
    var node = slot(formEl, 'form__ok', true);
    if (!node) return;
    node.textContent = text == null ? '' : String(text);
    node.classList.toggle('is-hidden', !node.textContent);
    var err = slot(formEl, 'form__error', false);
    if (err) { err.textContent = ''; err.classList.add('is-hidden'); }
  };

  function submitButton(formEl) {
    if (!formEl || typeof formEl.querySelector !== 'function') return null;
    return formEl.querySelector('button[type="submit"]')
      || formEl.querySelector('button:not([type])')
      || formEl.querySelector('input[type="submit"]')
      || formEl.querySelector('button');
  }

  /* Toggles .is-busy (disabled + spinner, §4) on the form's submit button. */
  DRAFTA.setBusy = function (formEl, busy) {
    var button = submitButton(formEl);
    if (!button) return;
    var on = !!busy;
    button.classList.toggle('is-busy', on);
    if ('disabled' in button) button.disabled = on;
    button.setAttribute('aria-busy', on ? 'true' : 'false');
    if (formEl && formEl.setAttribute) formEl.setAttribute('aria-busy', on ? 'true' : 'false');
  };

  /* POST JSON to DRAFTA.api + path. Never throws.
     Resolves {ok, status, data}; data.error is the server's message when present. */
  DRAFTA.post = function (path, body, token) {
    var base = String(DRAFTA.api || 'https://api.drafta.org');
    var target = /^https?:\/\//i.test(String(path || '')) ? String(path) : base + String(path || '');
    var headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;

    var payload;
    try {
      payload = JSON.stringify(body == null ? {} : body);
    } catch (e) {
      return Promise.resolve({
        ok: false,
        status: 0,
        data: { error: message('badResponse', pageLang()) }
      });
    }

    return fetch(target, { method: 'POST', headers: headers, body: payload })
      .then(function (response) {
        return response.text().then(function (text) {
          var data = null;
          if (text) {
            try { data = JSON.parse(text); } catch (e) { data = null; }
          }
          if (data === null) {
            data = response.ok ? {} : { error: message('badResponse', pageLang()) };
          }
          return { ok: response.ok, status: response.status, data: data };
        });
      })
      .catch(function () {
        return { ok: false, status: 0, data: { error: message('offline', pageLang()) } };
      });
  };
})();
