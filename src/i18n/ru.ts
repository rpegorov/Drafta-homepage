/* Russian UI strings; typed against the English dictionary so a missing key fails the build. */

import type { Messages } from './en';

export const ru: Messages = {
  /* ---- form messages (forms.ts) ---- */
  emailRequired: 'Введите адрес электронной почты.',
  emailInvalid: 'Это не похоже на адрес электронной почты.',
  emailSpaces: 'Адрес не может содержать пробелы.',
  passwordShort: 'Пароль должен быть не короче 8 символов.',
  passwordLong: 'Пароль должен быть не длиннее 1024 символов.',
  offline: 'Не удалось связаться с Drafta. Проверьте соединение и попробуйте снова.',
  badResponse: 'Сервер вернул неожиданный ответ.',

  /* ---- pricing copy (plans.ts) ---- */
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
  note: (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'заметка';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заметки';
    return 'заметок';
  },
  trial: 'Оба варианта начинаются с 30-дневного триала — карта не нужна, передумать можно в любой момент.',
  choose: { monthly: 'Оформить на месяц', yearly: 'Оформить на год' },

  /* ---- page chrome (Base, Header, Footer) ---- */
  skipLink: 'Перейти к содержанию',
  navLabel: 'Основная навигация',
  menu: 'Меню',
  navFeatures: 'Возможности',
  navPricing: 'Тарифы',
  navFaq: 'Вопросы',
  navDocs: 'Документация',
  download: 'Скачать',
  langSwitchLabel: 'Язык',
  footerProduct: 'Продукт',
  footerFeatures: 'Возможности',
  footerPricing: 'Тарифы',
  footerPlans: 'Тарифы',
  footerAccount: 'Аккаунт',
  footerRegister: 'Создать аккаунт',
  footerSignIn: 'Войти',
  footerFaq: 'Вопросы',
  footerDownloads: 'Загрузки',
  footerLatestRelease: 'Последний релиз',
  footerLegal: 'Документы',
  footerTerms: 'Условия',
  footerPrivacy: 'Конфиденциальность',
  footerRefund: 'Возврат',
  footerContact: 'Контакты',
  footerCopyright: '© 2026 Drafta · Apache-2.0',
  footerMadeBy: 'by craftzman',
};
