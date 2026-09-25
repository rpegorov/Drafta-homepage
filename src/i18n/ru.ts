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
  navBlog: 'Блог',
  navDocs: 'Документация',
  download: 'Скачать',
  langSwitchLabel: 'Язык',
  footerProduct: 'Продукт',
  footerFeatures: 'Возможности',
  footerPricing: 'Тарифы',
  footerPlans: 'Выбрать тариф',
  footerBlog: 'Блог',
  footerRss: 'RSS-лента',
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

  /* ---- checkout page (ЗАДАЧА-1.3) ---- */
  checkoutTitle: 'Оплата — Drafta',
  checkoutMetaDescription: 'Один тариф и два периода оплаты — месяц или год. Новый аккаунт начинается с 30-дневного пробного периода, карта не нужна; лимиты хранилища и заметок берутся из API аккаунтов.',
  checkoutOgDescription: 'Один тариф, оплата раз в месяц или раз в год. 30-дневный пробный период, карта не нужна; лимиты берутся из API аккаунтов.',
  checkoutEyebrow: 'Оплата',
  checkoutH1: 'Один тариф. Два периода оплаты.',
  checkoutLede: 'Оплата раз в месяц или раз в год — приложение одно и то же, а заметки остаются обычными файлами Markdown на диске.',
  checkoutCalloutStrong: '30 дней полного приложения, без карты.',
  checkoutCalloutRest: 'Каждый новый аккаунт начинается с 30-дневного пробного периода: пока он идёт, списаний нет, а передумать можно в любой момент.',
  checkoutPricingEyebrow: 'Тарифы',
  checkoutPricingH2: 'Всё включено в один тариф.',
  checkoutPricingLede: 'Цены приходят напрямую из API аккаунтов при открытии страницы — зашитых цифр здесь нет.',
  checkoutQuotaNote: 'Облачное хранилище зашифровано end-to-end, поэтому сервис хранит шифротекст, который не может прочитать. Если не хотите тратить квоту тарифа, подключите собственный CouchDB — локально или на сервере, который вы контролируете.',
  checkoutOrderH2: 'Ваш заказ',
  checkoutOrderChecking: 'Проверяем сессию…',
  checkoutOrderNote: 'Платёжный провайдер ещё не подключён: деньги не списаны, покупка не завершена. Строки выше — ответ сервера без изменений.',
  checkoutInkH2: 'Оплата пока не подключена.',
  checkoutInkP: 'Подписка фиксирует запрос в аккаунте, а страница печатает ответ сервера дословно: тариф, статус и конец периода. Деньги не списываются, и страница никогда не сообщает о покупке, которой не было.',
  checkoutPullquote: 'Что вернул сервер — то вы здесь и читаете. Включая его ошибки.',
  checkoutPullquoteSource: 'Страница оплаты: честно по построению',
  checkoutFaqH2: 'Вопросы',
  checkoutFaqQ1: 'Есть ли тариф дешевле?',
  checkoutFaqA1: 'Нет. Тариф один, а периодов оплаты два — месяц и год; второго тарифа и пожизненной лицензии нет. Лимиты хранилища и заметок в обоих случаях одинаковые, и они приходят из API аккаунтов.',
  checkoutFaqQ2: 'Что будет после пробного периода?',
  checkoutFaqA2: '30 дней начинаются с подтверждения email и не требуют карты. После них приложение работает только на чтение, пока на аккаунте нет тарифа: заметки по-прежнему читаются, а создание, правка и экспорт требуют тарифа, выбранного на этой странице.',
  checkoutFaqQ3: 'Что нужно приложению?',
  checkoutFaqA3Pre: 'macOS 26 или новее, Apple Silicon и Intel. Приложение скачивается со ',
  checkoutFaqA3Link: 'страницы релизов',
  checkoutFaqA3Post: ' — это не веб-приложение.',

  /* ---- checkout page script (scripts/pages/checkout.ts) ---- */
  checkoutSending: 'Отправляем запрос в api.drafta.org…',
  checkoutAccepted: 'API аккаунтов принял запрос.',
  checkoutSelected: 'Тариф отправлен на сервер:',
  checkoutQuota: 'Квота тарифа — так, как её отдаёт API аккаунтов: {value}.',
  checkoutRetry: 'Ничего не изменилось. Можно попробовать снова.',
  checkoutExpired: 'Сессия больше не действует. Войдите снова, чтобы продолжить.',
  checkoutNetwork: 'Сетевая ошибка — API аккаунтов недоступен.',
  checkoutSignedInAs: 'Вы вошли как {value}.',
  checkoutSignedIn: 'Вы вошли.',
  checkoutNeedsAccount: 'Для покупки нужен аккаунт. Войдите, чтобы продолжить — новый аккаунт начинается с 30-дневного пробного периода.',
  checkoutDeepLink: 'Выбрано ниже: {value}. Нажмите её кнопку, когда будете готовы — списаний пока нет.',
  checkoutNoTransport: 'Клиент API аккаунтов не загрузился. Обновите страницу.',
  checkoutNoRenderer: 'Не удалось загрузить тарифы. Обновите страницу.',

  /* ---- blog (ЗАДАЧА-2.1) ---- */
  blog: {
    metaTitle: 'Блог — Drafta',
    metaDescription: 'Заметки о том, как делается Drafta: релизы, решения по дизайну и устройство Markdown-редактора изнутри. Написано в Drafta и опубликовано прямо из неё.',
    eyebrow: 'Блог',
    h1: 'Заметки о том, как делается Drafta.',
    lede: 'Релизы, решения по дизайну и устройство приложения изнутри — написано в Drafta и опубликовано прямо из неё.',
    listLabel: 'Посты',
    emptyTitle: 'Постов пока нет.',
    emptyBody: 'Первый уже в работе. Подпишитесь на ленту — он придёт к вам, как только выйдет.',
    rssLabel: 'RSS-лента',
    rssTitle: 'Блог Drafta',
    rssDescription: 'Заметки о том, как делается Drafta: релизы, решения по дизайну и устройство приложения изнутри.',
    allPosts: '← Все посты',
    published: 'Опубликовано',
    updated: 'Обновлено',
    tagsLabel: 'Теги',
    translatedFrom: { en: 'Переведено автоматически с английского', ru: 'Переведено автоматически с русского' } as Record<string, string>,
    readOriginal: 'Читать оригинал →',
  },
};
