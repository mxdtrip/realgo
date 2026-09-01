export const supportedLocales = ["ru"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "ru";

const russianShortWordPattern =
  /(^|[\s([{"«„“—–-])(а|и|я|в|с|у|к|о|но|не|на|по|из|за|до|от|со|во|ко|об|же|бы|ли)([ \t\r\n]+)/giu;

/** Keep short Russian prepositions, conjunctions and particles with the next word. */
export function keepShortWords(value: string): string {
  return value.replace(russianShortWordPattern, "$1$2\u00a0");
}

const ru = {
  common: {
    brand: "ReAlgo",
    metadata: {
      title: "ReAlgo — подготовка к алгоритмическим собеседованиям",
      description:
        "ReAlgo строит персональный план подготовки к алгоритмическому собеседованию, сохраняет решённые задачи и возвращает их на интервальное повторение.",
      applicationName: "ReAlgo",
      siteUrl: "https://realgo.dev",
      ogImageAlt: "ReAlgo — платформа подготовки к алгоритмическим собеседованиям",
      ogEyebrow: "/задачи /план /повторения",
      ogHeadline: "Подготовка к алгоритмическим собеседованиям",
      ogFooter: "решай → повторяй → запоминай",
      keywords: [
        "подготовка к алгоритмическому собеседованию",
        "подготовка к техническому собеседованию",
        "интервальные повторения",
        "LeetCode",
        "HackerRank",
        "GeeksforGeeks",
        "Codeforces",
        "алгоритмические задачи",
      ],
    },
  },
  pwa: {
    name: "ReAlgo — Memory layer for interview prep",
    shortName: "ReAlgo",
    description:
      "ReAlgo помогает не забывать решённые задачи, вовремя возвращает их к повторению и складывает понятный план подготовки к интервью.",
  },
  marketing: {
    hero: {
      homeAria: "ReAlgo home",
      navAria: "Site sections",
      nav: [
        { href: "memory", label: "Tasks" },
        { href: "roadmap", label: "Plan" },
        { href: "reviews", label: "Reviews" },
        { href: "pricing", label: "Pricing" },
        { href: "faq", label: "FAQ" },
      ],
      auth: {
        login: "Войти",
        signup: "Регистрация",
        dashboard: "Кабинет",
        createAccount: "Создать аккаунт",
        continue: "Продолжить",
        email: "Электронная почта",
        emailPlaceholder: "you@company.com",
        password: "Пароль",
        passwordPlaceholder: "••••••••",
        interviewDate: "Дата собеседования",
        loginAria: "Войти",
        signupAria: "Создать аккаунт",
        pending: "Подождите…",
        error: "Что-то пошло не так. Попробуйте ещё раз.",
      },
      sortingCodeAria: "Sorting code",
      title: "Подготовка к алгоритмическим собеседованиям, которая помогает не забывать решения",
      titleAccent: "не забывать решения",
      lead:
        "Практикуйтесь системно, закрепляйте знания и легко вспоминайте нужные подходы на собеседовании.",
      eyebrow: "Подготовка к алгоритмическим собеседованиям",
      tagline:
        "Решай задачи на привычной платформе. ReAlgo сохранит прогресс, покажет слабые паттерны и поможет вовремя к ним вернуться.",
      cta: "Начать подготовку сейчас",
      wordAria: "realgo",
      codeError: "Код не компилируется — ReAlgo не смог его выполнить. Проверь синтаксис.",
    },
    memoryTasks: [
      ["Two Sum II", "Two Pointers", "повторить", "завтра"],
      ["Longest Substring", "Sliding Window", "закрепляется", "через 3 дня"],
      ["Valid Parentheses", "Stack", "уверенно", "на неделе"],
    ],
    // Срез живого роадмапа кабинета: неделя = один паттерн NeetCode 150,
    // прогресс считается по реально решённым задачам.
    roadmapWeeks: [
      {
        label: "неделя 1",
        title: "Hashing / Frequency",
        focus: "частотные словари, группировки и уникальность — база большинства задач",
        state: "пройдено",
        tone: "done",
        progress: 100,
      },
      {
        label: "неделя 2",
        title: "Two Pointers",
        focus: "парные указатели на отсортированных данных и встречные проходы",
        state: "в работе",
        tone: "active",
        progress: 72,
      },
      {
        label: "неделя 3",
        title: "Sliding Window",
        focus: "окна переменной длины: инвариант окна и его сжатие",
        state: "в работе",
        tone: "active",
        progress: 45,
      },
    ],
    reviewCards: [
      [
        "Recall",
        "Почему именно карточки?",
        "Потому что вспомнить ответ самому — не то же самое, что узнать его на экране. Карточка тренирует именно то усилие, которое пригодится на интервью.",
      ],
      [
        "Interval",
        "Как карточки влияют на запоминание?",
        "Твоя оценка сдвигает следующий показ: легко — реже, тяжело — чаще. Так повторения подстраиваются под реальную уверенность, а не идут по одному общему расписанию.",
      ],
      [
        "Miss",
        "А если ответ совсем забылся?",
        "Ничего страшного — карточка вернётся раньше. Забытое становится не поводом для тревоги, а понятным сигналом, что повторить в первую очередь.",
      ],
    ],
    // [название, цена, состав, CTA, характер платежа].
    //
    // Цены в рублях: расчёты с потребителем внутри РФ ведутся в валюте РФ
    // (ст. 317 ГК РФ), а Pro — разовая бессрочная лицензия, а не подписка.
    // Пятый элемент существует именно поэтому: без явной подписи «разово»
    // цена рядом с бесплатным планом по умолчанию читается как ежемесячная.
    // Его же показывает /checkout вместо прежнего захардкоженного «/ мес».
    pricing: [
      [
        "Free",
        "0 ₽",
        [
          "Сохранение решённых задач прямо из браузера",
          "Оценка уверенности после каждой задачи",
          "Расписание интервальных повторений",
          "Базовая статистика прогресса",
        ],
        "Начать бесплатно",
        "",
      ],
      [
        "Pro",
        "Скоро",
        [
          "Всё из Free",
          "Персональный план под роль и дату интервью",
          "Приоритет тем под выбранные компании",
          "Выбор стратегии персонального плана",
          "Расширенные карточки: паттерны, шаги, граничные случаи",
        ],
        "Купить PRO",
        "",
      ],
    ],
    sections: {
      memory: {
        kicker: "Задачи",
        agentTitle: "Застрял в задаче? ReAlgo подскажет следующий шаг.",
        agentDescription:
          "ИИ-помощник видит открытую задачу и даёт три уровня подсказок: от мягкой наводки до разбора паттерна. Ты продолжаешь решать сам и не переключаешься между вкладками — помощь появляется только по твоему запросу.",
        agentCta: "Скачать ИИ-помощника",
        title: "Ты решил задачу.\nReAlgo сохраняет то,\nк чему нужно вернуться.",
        description:
          "После решения отметь, насколько уверенно справился. ReAlgo сохранит задачу, оценку и известный паттерн, а затем добавит нужное в очередь повторений — без отдельной таблицы и заметок.",
        demoUrl: "leetcode.com/problems/two-sum-ii",
        demoStatus: "Saved",
        ratingAria: "Difficulty rating",
        ratings: ["сложно", "нормально", "уверенно"],
        cta: "Сохранить первую задачу",
      },
      roadmap: {
        kicker: "План",
        title: "Каждый день понятно, что решать дальше.",
        description:
          "Укажи роль, компанию и дату интервью. ReAlgo распределит темы, задачи и повторения по плану, учтёт твой прогресс и покажет следующий понятный шаг вместо длинного списка.",
        cta: "Собрать мой план",
      },
      reviews: {
        kicker: "Повторения",
        title: "Вспоминай сам — ReAlgo подскажет, когда повторить.",
        description:
          "Короткие карточки помогают восстановить паттерн, механику решения и граничные случаи. Сначала попробуй ответить сам, затем сравни с карточкой. Если было сложно — тема вернётся раньше; если легко — позже.",
        cta: "Запустить повторения",
        flipToAnswer: "показать ответ",
        flipToQuestion: "показать вопрос",
      },
      pricing: {
        kicker: "Тарифы",
        title: "Free помогает не забыть решённое. Pro помогает подготовиться к конкретному интервью.",
        description:
          "Сохраняй задачи и повторяй важные темы бесплатно. С Pro ты получишь персональный план подготовки, приоритет задач под выбранную компанию и расширенные карточки, которые помогают глубже разбирать паттерны и механику решений.",
      },
      faq: {
        kicker: "FAQ",
        title: "Всё, что нужно знать перед стартом.",
        description:
          "Коротко о расширении, повторениях и том, как ReAlgo встраивается в привычную подготовку.",
        items: [
          {
            question: "ReAlgo сам решает задачи?",
            answer:
              "Нет. Ты решаешь задачи на привычной платформе, а ReAlgo сохраняет учебный контекст, помогает отслеживать прогресс и возвращает нужные темы на повторение.",
          },
          {
            question: "Что именно сохраняет браузерное расширение?",
            answer:
              "Платформу, задачу, статус решения, твою оценку уверенности и паттерн, если он определён. ReAlgo не получает доступ к закрытым материалам и не заменяет твою практику.",
          },
          {
            question: "Чем это отличается от обычного списка решённых задач?",
            answer:
              "Список показывает, что ты уже сделал. ReAlgo помогает понять, когда к этому вернуться, какие темы забываются и что стоит повторить следующим.",
          },
          {
            question: "Можно пользоваться бесплатно?",
            answer:
              "Да. Free включает сохранение задач, оценку уверенности, базовую статистику и расписание повторений. Платные функции появятся позже.",
          },
        ],
      },
    },
    proof: [
      { value: "4", label: "платформы для практики" },
      { value: "111", label: "тем и подпаттернов в базе" },
      { value: "428", label: "компаний в базе задач с собеседований" },
    ],
    awards: {
      title: "Победитель хакатона",
      event: "«Kodik Launchpad 2026»",
    },
    // Dismissible toast in the bottom-right corner of the landing page,
    // rendered in Kodik's brand colours. See app/components/KodikWinNotice.tsx.
    hackathonNotice: {
      eyebrow: "Kodik Launchpad 2026",
      title: "ReAlgo — победитель хакатона",
      description:
        "30 дней от идеи до продукта: собрали MVP, прошли квалификацию и защитили проект. Посмотри презентацию, с которой мы выиграли.",
      cta: "Смотреть презентацию",
      href: "/presentation",
      dismiss: "Закрыть уведомление",
      // Names the landmark. The mascot itself is decorative (alt="") — the
      // region label already says what the card is.
      regionLabel: "Уведомление о победе в хакатоне Kodik Launchpad",
    },
    footer: {
      description: "Подготовка к алгоритмическим собеседованиям без бесконечного списка задач.",
      columns: [
        {
          title: "продукт",
          links: [
            { href: "/#memory", label: "Задачи" },
            { href: "/#roadmap", label: "План" },
            { href: "/#reviews", label: "Повторения" },
            { href: "/#pricing", label: "Тарифы" },
            { href: "/#faq", label: "Вопросы" },
          ],
        },
        {
          title: "разработчикам",
          links: [
            { href: "/docs", label: "Документация" },
            { href: "/anki-export", label: "Экспорт в Anki" },
            { href: "/changelog", label: "Изменения" },
          ],
        },
        {
          title: "компания",
          links: [
            { href: "/about", label: "О ReAlgo" },
            { href: "https://t.me/realgo_devlog", label: "Блог" },
            // Served by the `presentation` nginx container, not by Next — Caddy
            // strips the /presentation prefix and proxies there. The link is
            // written without a trailing slash on purpose: Caddy redirects it,
            // so the footer stays readable and the deck's relative asset paths
            // still resolve. The older /pitch-deck.html stays reachable by
            // direct URL but is no longer linked from here.
            { href: "/presentation", label: "Презентация" },
          ],
        },
        {
          title: "документы",
          links: [
            { href: "/privacy", label: "Конфиденциальность" },
            { href: "/terms", label: "Условия" },
            { href: "/offer", label: "Оферта" },
            { href: "/support", label: "Поддержка" },
          ],
        },
      ],
      copyright: "© 2026 ReAlgo. All rights reserved.",
      tagline: "решай → повторяй → вспоминай",
    },
  },
  onboarding: {
    profile: {
      stepLabel: "Шаг",
      back: "Назад",
      next: "Далее",
      skip: "Пропустить",
      platform: {
        title: "На какой площадке готовишься?",
        description:
          "Выбери основную площадку с задачами — так карточки и прогресс будут ближе к тому, где ты реально решаешь.",
        fieldLabel: "Выбор площадки для подготовки",
        comingSoon: "скоро",
      },
      company: {
        title: "В какую компанию хочешь устроиться?",
        description:
          "Выбери основную цель — ReAlgo будет рекомендовать задачи и темы, которые эта компания реально спрашивает на интервью.",
        label: "компания",
        placeholder: "Например, Google…",
        selectedLabel: "Выбранная компания",
        suggestionsLabel: "Подсказки компаний из каталога ReAlgo",
        skipHint: "Если рынок IT для тебя и без того прост и понятен — пропусти этот шаг.",
      },
      date: {
        title: "Дата интервью",
        description:
          "Прокрути колёса — активными станут день и месяц, которые остановятся по центру.",
        wheelsLabel: "Колёса выбора дня и месяца интервью",
        dayAria: "День интервью",
        monthAria: "Месяц интервью",
        resultLabel: "интервью",
      },
      roadmap: {
        title: "Твой план подготовки",
        description:
          "Горизонт считаем из даты собеседования. Выбери, как расставить темы — ReAlgo сразу покажет результат и оставит лишнее в резерве.",
        priorityLabel: "Как расставить темы?",
        priorityChangeLater: "можно изменить позже",
        recommended: "рекомендуем",
        modes: {
          balanced: {
            title: "Оптимально",
            description: "Частые темы целевой компании, твои пробелы и плавное усложнение.",
          },
          easy_first: {
            title: "Легче → сложнее",
            description: "Сначала темы с большей долей easy-задач, затем medium и hard.",
          },
          company_frequency: {
            title: "Чаще спрашивают",
            description: "Сначала подпаттерны с максимальным числом релевантных задач компании.",
          },
          knowledge_gaps: {
            title: "Закрыть пробелы",
            description: "Сначала темы с самой низкой текущей уверенностью.",
          },
        },
        horizonLabel: "горизонт до собеседования",
        previewLabel: "предпросмотр плана",
        previewWeeksUnit: "недель",
        previewTopicsUnit: "тем в плане",
        previewReserveUnit: "тем в резерве",
        previewLoading: "Считаем план по твоим данным…",
        previewError: "Не удалось загрузить данные для плана. Нажми «Далее», чтобы повторить.",
        noPoolTitle: "Пока не из чего строить план",
        noPoolDescription:
          "В атласе пока нет доступных подпаттернов. Настройки можно сохранить и вернуться к плану позже.",
      },
      welcome: {
        eyebrow: "setup complete",
        title: "Добро пожаловать в ReAlgo",
        description:
          "План сохранён в профиле и будет доступен на любом устройстве. Можно переходить в кабинет и начинать подготовку.",
        action: "Перейти в Dashboard",
        summary: {
          platform: "площадка",
          companies: "компании",
          date: "интервью",
          roadmap: "план",
          priority: "приоритет",
          empty: "—",
        },
      },
    },
  },
  cabinet: {
    layout: {
      brand: "ReAlgo",
      navAria: "Personal cabinet",
      navGroups: [
        {
          title: "подготовка",
          items: [
            { href: "/dashboard", label: "dashboard", icon: "dashboard", count: "" },
            { href: "/reviews", label: "reviews", icon: "reviews", count: "" },
            { href: "/problems", label: "problems", icon: "problems", count: "" },
            { href: "/cards", label: "cards", icon: "cards", count: "" },
          ],
        },
        {
          title: "аналитика",
          items: [
            { href: "/roadmap", label: "roadmap", icon: "roadmap", count: "" },
            { href: "/patterns", label: "patterns", icon: "patterns", count: "" },
          ],
        },
        {
          title: "система",
          items: [
            { href: "/extension", label: "extension", icon: "extension", count: "" },
            { href: "/settings", label: "settings", icon: "settings", count: "" },
          ],
        },
      ],
      pathPrefix: "~/realgo",
      dueChip: "due today",
      backToMarketing: "на сайт",
      logout: "logout",
      demoBadge: "demo",
      demoTitle: "Демо-режим: авторизация отключена, кабинет работает на моковых данных.",
      account: {
        name: "Demo Runner",
        email: "demo@realgo.dev",
        initials: "dr",
        rows: [
          ["plan", "free mock"],
          ["interview", "20.07.2026"],
          ["sync", "2m ago"],
          ["build", "v0.4.2 · fsrs-6"],
        ],
        menuSettings: "settings",
        menuReport: "report a problem",
        menuLogout: "log out",
        logoutPending: "logging out…",
      },
      profile: {
        interview: {
          prefix: "interview",
          today: "today",
          past: "passed",
          missing: "not set",
        },
      },
    },
    shell: {
      hotkeys: {
        title: "горячие клавиши",
        description: "Работают на страницах кабинета, вне полей ввода.",
        disableLabel: "отключить горячие клавиши",
        disabledNote: "Хоткеи отключены — работает только «?».",
        close: "закрыть",
        groups: [
          {
            title: "навигация",
            items: [
              ["g d", "dashboard"],
              ["g r", "reviews"],
              ["g p", "problems"],
              ["g c", "cards"],
              ["g t", "patterns"],
              ["g s", "settings"],
              ["g n", "начать сессию повторений"],
            ],
          },
          {
            title: "действия",
            items: [
              ["?", "эта справка"],
              ["esc", "закрыть диалог"],
            ],
          },
          {
            title: "онбординги (для тестов)",
            items: [
              ["g w", "welcome-тур заново"],
              ["g o", "полевой онбординг заново"],
            ],
          },
        ],
      },
      report: {
        triggerAria: "Сообщить о проблеме",
        title: "сообщить о проблеме",
        description:
          "Опиши, что пошло не так, что ты делал и какого результата ожидал.",
        fieldLabel: "что произошло",
        placeholder: "Например: нажал «Начать сессию», но загрузка не завершилась…",
        privacyNote:
          "Диагностика удаляется через 90 дней и не собирает значения форм, токены или хранилище. Вложение удаляется через 30 дней.",
        send: "отправить отчёт",
        sending: "отправляем…",
        sentTitle: "отчёт доставлен",
        sentNote: "Спасибо. Отчёт сохранён, команда сможет найти его по номеру ниже.",
        reportIdLabel: "номер отчёта",
        sendFailed: "Не удалось доставить отчёт. Проверь соединение и попробуй ещё раз.",
        retry: "повторить отправку",
        attachmentAdd: "прикрепить файл",
        attachmentRemove: "удалить файл",
        attachmentHint: "Фото и текст — до 5 МБ, видео — до 15 МБ.",
        attachmentFailed: "Файл не добавлен: разрешены фото, текст и видео с указанными лимитами.",
        attachmentSelected: "выбран файл",
        copy: "скопировать отчёт",
        copied: "скопировано ✓",
        copyFailed: "не удалось — попробуй ещё раз",
        close: "закрыть",
      },
      tour: {
        badge: "welcome",
        stepOf: "из",
        next: "дальше",
        done: "понятно, поехали",
        skip: "пропустить",
        steps: [
          {
            target: "nav",
            title: "разделы кабинета",
            text: "В навигации — вся подготовка: dashboard с планом на сегодня, очередь повторений, задачи и карточки.",
          },
          {
            target: "due",
            title: "очередь на сегодня",
            text: "Счётчик due today показывает, сколько повторений ждут прямо сейчас. Клик ведёт к списку.",
          },
          {
            target: "content",
            title: "рабочая область",
            text: "Здесь живут страницы разделов. Начни с dashboard — блок next up подскажет первый шаг.",
          },
          {
            target: "",
            title: "горячие клавиши",
            text: "Нажми «?» в любой момент — откроется справка: g d / g r — навигация, s — старт сессии повторений.",
          },
        ],
      },
    },
    common: {
      startSession: "start session",
      viewAll: "view all →",
      hard: "hard",
      normal: "normal",
      easy: "easy",
      ratingAria: "Mock review rating",
    },
    pages: {
      dashboard: {
        eyebrow: "/dashboard",
        title: "Сегодня повторяем то, что может забыться.",
        description:
          "ReAlgo собирает короткую очередь повторений и подсвечивает слабые темы — чтобы решённое не терялось до собеседования.",
        launcher: {
          eyebrow: "practice",
          title: "Практика по активным подпаттернам",
          metaUnits: {
            subpatterns: "подпаттерна(ов)",
            cards: "карт.",
            minutes: "мин",
          },
          emptyTitle: "Практика пока не собрана",
          emptyMeta: "Добавь подпаттерны в практику — кнопка появится здесь.",
          start: "начать практику",
        },
        queueTitle: "Ближайшие повторения",
        queueEmpty: "Очередь пуста — всё повторено вовремя.",
        patternsTitle: "Слабые зоны",
        patternsEmpty: "Слабых зон нет — уверенность по паттернам выше порога.",
        loading: "Загружаем дашборд…",
        errorTitle: "Не удалось загрузить дашборд",
        retry: "повторить",
        dayToday: "сегодня",
        dayTomorrow: "завтра",
        dayOverdue: "просрочено на",
        dayUnits: ["день", "дня", "дней"],
        statTooltips: {
          today_queue:
            "Сколько повторений запланировано на сегодня: задачи, карточки и паттерны, у которых подошёл срок.",
          solved_total: "Сколько задач решено за всё время с включённым расширением.",
          streak: "Сколько дней подряд без пропуска повторений. Серия помогает не бросить подготовку.",
          readiness:
            "Оценка готовности к собеседованию по прогрессу: решённые задачи, закрытые повторения и слабые места.",
        },
        heatmap: {
          title: "Активность повторений",
          aria: "Активность повторений за последние 56 дней",
          foot: "последние 56 дней",
          scaleLess: "less",
          scaleMore: "more",
          tooltip: {
            empty: "без повторений",
            months: [
              "января",
              "февраля",
              "марта",
              "апреля",
              "мая",
              "июня",
              "июля",
              "августа",
              "сентября",
              "октября",
              "ноября",
              "декабря",
            ],
            unitForms: ["повторение", "повторения", "повторений"],
          },
          statDays: "активных дней",
          statReviews: "повторений за период",
          statStreak: "текущий streak",
        },
      },
      reviews: {
        // Тоны типов нужны дашборду (превью очереди повторений).
        types: [
          ["problem", "задачи", "accent"],
          ["card", "карточки", "success"],
          ["pattern", "паттерны", "warning"],
        ],
        journal: {
          eyebrow: "/reviews",
          title: "Решённые задачи",
          description:
            "Журнал решённого на платформах: статус, сколько подсказок потрачено и как ты сам оценил задачу после сабмита. Фиксирует расширение.",
          summaryUnit: "задач в журнале",
          panelEyebrow: "journal",
          panelTitle: "Solved on platforms",
          searchPlaceholder: "поиск по названию или паттерну",
          searchAria: "Поиск по журналу задач",
          filterAll: "all",
          empty: "Ничего не нашлось — измени запрос или фильтр.",
          emptyAll: "Журнал пуст. Реши первую задачу с включённым расширением — она появится здесь.",
          emptyAllCta: "настроить расширение →",
          loading: "Загружаем задачи…",
          errorTitle: "Не удалось загрузить задачи",
          retry: "повторить",
          loadMore: "показать ещё",
          noValue: "—",
          hintsNone: "0",
          columns: {
            problem: "problem",
            platform: "platform",
            pattern: "pattern",
            status: "status",
            hints: "hints",
            rating: "self-rating",
          },
          statuses: [
            ["saved", "сохранена", "default"],
            ["reviewing", "повторяется", "accent"],
            ["mastered", "освоена", "success"],
            ["archived", "в архиве", "default"],
          ],
          difficulty: {
            easy: "easy",
            medium: "medium",
            hard: "hard",
          },
          ratings: {
            hard: "hard",
            normal: "normal",
            easy: "easy",
          },
        },
      },
      problems: {
        eyebrow: "/problems",
        title: "Практика подпаттернов",
        description:
          "Твой рабочий набор: какие подпаттерны взяты в практику и где каждый находится — только добавлен, в работе или уже освоен.",
        panelEyebrow: "practice",
        panelTitle: "Subpattern progress",
        filterAll: "all",
        stages: {
          added: ["добавлен", "default"],
          working: ["в работе", "accent"],
          mastered: ["освоен", "success"],
        },
        masteryLabel: "mastery",
        cardsUnit: "карт.",
        dueUnit: "к повторению",
        solvedLabel: "решено",
        addMore: "добавить из атласа →",
        remove: "убрать из практики",
        removed: "Убрано из практики:",
        removeFailed: "Не удалось убрать — попробуй ещё раз.",
        empty: "С таким фильтром пусто.",
        emptyAll: "В практике пока ничего нет. Добавь подпаттерны из атласа — и здесь появится прогресс.",
        emptyAllCta: "открыть атлас →",
        loading: "Загружаем практику…",
        errorTitle: "Не удалось загрузить практику",
        retry: "повторить",
      },
      roadmap: {
        eyebrow: "/roadmap",
        title: "ReAlgo Core Roadmap",
        description:
          "Маршрут по паттернам: каждая неделя закрывает один паттерн, прогресс считается по реально решённым задачам.",
        panelEyebrow: "plan",
        panelTitle: "Preparation track",
        overallLabel: "общий прогресс",
        nowLabel: "сейчас",
        statusDone: "пройдено",
        statusActive: "в работе",
        statusTodo: "впереди",
        practiceEyebrow: "week practice",
        practiceCta: "Приступить к практике",
        practiceAction: "start review",
        lockedEyebrow: "locked",
        lockedTitle: "Сначала завершить предыдущие недели",
        reviewEyebrow: "review week",
        reviewTitle: "Повторение и mock interview",
        empty: "Роадмап пока пуст — задачи появятся после первого решения с расширением.",
        loading: "Загружаем роадмап…",
        errorTitle: "Не удалось загрузить роадмап",
        retry: "повторить",
        personalizedTitle: "Твой персональный roadmap",
        personalizedDescription:
          "План построен под выбранный горизонт и темы. Неделя закрывает конкретные подпаттерны — подпаттерн считается закрытым, когда все карточки внутри него отмечены very easy.",
        personalizedPanelTitle: "personal preparation track",
        personalizedHintCompany: "фокус",
        personalizedHintWeeks: "недель в плане",
        emptyStateTitle: "Roadmap ещё не построен",
        emptyStateDescription:
          "Пройди онбординг, чтобы выбрать горизонт подготовки и темы — ReAlgo соберёт персональный план по неделям.",
        emptyStateAction: "построить roadmap",
        deleteRoadmap: "удалить roadmap",
        deleteRoadmapPending: "удаляем…",
        priorityTitle: "Порядок тем",
        priorityChangeLater: "Меняется только будущее плана",
        priorityPreview: "Предпросмотр: завершённые и текущая недели останутся на месте.",
        priorityApply: "перестроить будущие недели",
        priorityCancel: "отмена",
        priorityPending: "сохраняем…",
        selectedLabel: "тем в плане",
        reserveLabel: "тем в резерве",
        coreLabel: "core plan",
        modes: {
          balanced: {
            title: "Оптимально",
            description: "Частота компании, твои пробелы и плавное усложнение.",
          },
          easy_first: {
            title: "Легче → сложнее",
            description: "Сначала темы с большей долей easy-задач.",
          },
          company_frequency: {
            title: "Чаще спрашивают",
            description: "Сначала темы с максимальным числом задач компании.",
          },
          knowledge_gaps: {
            title: "Закрыть пробелы",
            description: "Сначала темы с минимальной текущей уверенностью.",
          },
        },
      },
      patterns: {
        eyebrow: "/patterns",
        title: "Паттерны и уверенность",
        description:
          "Темы, где уверенность проседает: ReAlgo показывает не «реши ещё», а что именно закрепить в первую очередь.",
        summaryUnit: "паттерна требуют внимания",
        panelEyebrow: "weak spots",
        panelTitle: "Pattern confidence",
        confidenceLabel: "confidence",
        priorityHigh: "high priority",
        priorityMed: "review soon",
        trainLink: "review now →",
        weeklyLabel: "за неделю",
        weakColumnTitle: "Слабые паттерны",
        strongColumnTitle: "Сильные паттерны",
        strongPriority: "закреплено",
        strongEmpty: "Пока нет закреплённых паттернов — повторяй регулярно.",
      },
      patternDetail: {
        eyebrow: "/patterns",
        backLink: "← все паттерны",
        loading: "Загружаем паттерн…",
        errorTitle: "Не удалось загрузить паттерн",
        notFoundTitle: "Такого паттерна нет",
        retry: "повторить",
        descriptionTitle: "Что это",
        techniquesTitle: "Разновидности",
        symptomsTitle: "Как распознать",
        symptomsEmpty: "Материал по симптомам ещё готовится.",
        checklistTitle: "Держи в голове",
        examplesTitle: "Примеры задач",
        examplesEmpty: "Пока нет привязанных задач.",
        practiceCta: "Потренировать этот паттерн",
        sessionEmpty: "Пока нет карточек по этому паттерну — загляни позже.",
        sessionError: "Не удалось загрузить карточки для тренировки.",
      },
      atlas: {
        eyebrow: "/patterns",
        title: "Pattern Atlas",
        description:
          "Карта знаний ReAlgo Taxonomy: инструменты, семейства паттернов и субпаттерны с твоим прогрессом. Выбери компанию — карта подсветит, что она реально спрашивает.",
        taxonomyLabel: "taxonomy",
        loading: "Загружаем атлас…",
        errorTitle: "Не удалось загрузить атлас",
        retry: "повторить",
        searchPlaceholder: "поиск по паттернам",
        searchAria: "Поиск по атласу паттернов",
        searchEmpty: "Ничего не нашлось — измени запрос.",
        views: { tree: "Tree", companies: "Companies" },
        viewAria: "Режим атласа",
        companyLabel: "target company",
        companyNone: "— без компании —",
        companyAria: "Целевая компания",
        companyHint: "Выбери компанию, чтобы подсветить релевантные субпаттерны.",
        companySearchPlaceholder: "поиск компании",
        companySearchAria: "Поиск компании",
        companyPickerEmpty: "Компании не найдены",
        close: "закрыть",
        platformLabel: "площадка",
        platformNone: "— все площадки —",
        platformAria: "Площадка подготовки",
        demoBadge: "demo data",
        demoNote: "Демо-данные для примера — не реальная статистика интервью.",
        familiesTitle: "Pattern Families",
        familyColumns: {
          pattern: "паттерн",
          difficulty: "задачи по сложности",
          tasks: "задачи",
          subpatterns: "подпаттерны",
        },
        familyDifficultyUnknown: "нет данных",
        familyDifficultyNoData: "нет задач с разметкой",
        familyDifficultyHint:
          "Показываем распределение привязанных задач по easy/medium/hard. Среднюю сложность паттерна не считаем: она была бы слишком условной.",
        expandAria: "Раскрыть семейство",
        collapseAria: "Свернуть семейство",
        subpatternUnit: ["субпаттерн", "субпаттерна", "субпаттернов"],
        taskUnit: ["задача", "задачи", "задач"],
        solvedLabel: "solved",
        dueLabel: "due",
        masteryStatuses: {
          not_started: "не изучен",
          learning: "изучается",
          weak: "слабый",
          unstable: "нестабильный",
          strong: "уверенный",
          mastered: "освоен",
        },
        relevanceLabels: {
          high: "high",
          medium: "medium",
          low: "low",
          insufficient_evidence: "мало данных",
          no_evidence: "нет данных",
        },
        legendAria: "Легенда статусов",
        coverage: {
          title: "Coverage",
          studied: "изучено подпаттернов",
          strong: "уверенно",
          unstable: "нестабильно",
          weak: "слабо",
          gapsTitle: "Top gaps",
          gapsEmpty: "Провалов нет — релевантные субпаттерны в хорошей форме.",
          noCompany: "Выбери компанию, чтобы увидеть готовность к ней.",
          problemsTitle: "Relevant Problems",
          problemsEmpty: "У компании пока нет привязанных задач.",
          problemsHint: "Задачи, по которым у компании есть evidence — отрабатывай их рядом с релевантными субпаттернами.",
          problemStatuses: {
            not_started: "не начата",
            saved: "сохранена",
            reviewing: "повторяется",
            mastered: "освоена",
            archived: "в архиве",
          },
        },
      },
      atlasNode: {
        eyebrow: "/patterns",
        backLink: "← атлас паттернов",
        loading: "Загружаем…",
        errorTitle: "Не удалось загрузить",
        notFoundTitle: "Такого узла в атласе нет",
        retry: "повторить",
        kindLabels: {
          tool: "tool",
          family: "pattern family",
          subpattern: "subpattern",
          pattern: "pattern",
        },
        masteryLabel: "mastery",
        solvedLabel: "solved",
        nextReviewLabel: "next review",
        dueNow: "пора повторить",
        noReviews: "повторения не назначены",
        familiesLabel: "family",
        toolsLabel: "requires",
        subpatternsTitle: "Субпаттерны",
        profile: {
          eyebrow: "pattern",
          pendingBadge: "материал готовится",
          sections: {
            what: {
              title: "Что это",
              pending: "Короткое определение паттерна появится здесь — 2–3 предложения о сути.",
            },
            recognize: {
              title: "Как распознать",
              hint: "Главные признаки в условии задачи.",
              pending: "Список признаков, по которым паттерн виден прямо в условии, появится здесь.",
            },
            mechanics: {
              title: "Ключевая механика",
              hint: "Что именно двигается, хранится и обновляется.",
              pending: "Разбор механики — какие структуры живут внутри решения и как меняются — появится здесь.",
            },
            misfits: {
              title: "Когда не подходит",
              hint: "Типичные ложные сигналы: задача выглядит похоже, но паттерн не тот.",
              pending: "2–3 типичных ложных сигнала появятся здесь.",
            },
          },
          subpatterns: {
            title: "Подпаттерны",
            hint: "Разновидности внутри семейства и чем они отличаются.",
            empty: "Подпаттерны для этого семейства ещё не заведены.",
            notePending: "описание готовится",
          },
        },
        actions: {
          session: "Повторить слабые места",
        },
        practiceToggle: {
          add: "добавить в практику",
          active: "в практике",
          failed: "Не получилось — попробуй ещё раз.",
        },
        learn: {
          title: "Методика",
          whatItIs: "Что это",
          mentalModel: "Ключевая механика",
          recognitionCues: "Как распознать",
          antiCues: "Когда это НЕ подходит",
          coreInvariant: "Инвариант",
          skeleton: "Canonical skeleton",
          miniExample: "Мини-пример",
          commonMistakes: "Типичные ошибки",
          dontConfuse: "Не путать с",
          preparing: "Методический материал готовится — скоро появится.",
        },
        cta: {
          eyebrow: "cards",
          title: "Карточки для тренировки",
          note: "Короткая сессия по этому субпаттерну: распознавание, механика и граничные случаи.",
        },
        problems: {
          title: "Задачи",
          hint: "Практика по субпаттерну — с компаниями, где задачу реально спрашивали.",
          companiesNone: "компании не отмечены",
          difficultyLabel: "difficulty",
          showAll: "показать все",
          showLess: "свернуть",
        },
        cards: {
          title: "Карточки",
          empty: "Карточек по этому субпаттерну пока нет.",
          types: {
            pattern_recognition: "recognition",
            algorithm_mechanics: "mechanics",
            edge_case: "edge case",
            recognition: "recognition",
            invariant: "invariant",
            skeleton: "skeleton",
            contrast: "contrast",
            pitfall: "pitfall",
            debugging: "debugging",
          },
        },
        practice: {
          title: "Общая практика",
          empty: "К этому субпаттерну задачи ещё не привязаны.",
          tiers: {
            foundational: "foundational",
            core: "core",
            advanced: "advanced",
          },
          statuses: {
            not_started: "не решена",
            in_progress: "в работе",
            solved: "решена",
            reviewing: "повторяется",
            skipped: "пропущена",
          },
        },
        companyPractice: {
          title: "Задачи компаний",
          empty: "Задач с привязкой к компаниям для этого субпаттерна пока нет.",
          evidenceUnit: ["упоминание", "упоминания", "упоминаний"],
        },
      },
      cards: {
        eyebrow: "/cards",
        title: "Карточки повторения",
        description:
          "Короткие карточки на распознавание паттерна, механику алгоритма и пограничные случаи — без готового кода, только суть.",
        panelEyebrow: "session",
        panelTitle: "Today cards",
        overview: {
          readyTitle: "Короткая сессия без лишнего шума.",
          readyDescription:
            "Сначала попробуй воспроизвести ответ сам. Затем открой правильный и честно оцени сложность.",
          start: "start session",
          cardUnit: "карт.",
          dueLabel: "к повторению сегодня",
          estimatedTime: "~5 минут",
          minuteUnit: "мин",
          mixEyebrow: "mix",
          mixTitle: "Что повторяем сегодня",
          types: [
            ["pattern_recognition", "Распознавание паттерна"],
            ["algorithm_mechanics", "Механика алгоритма"],
            ["edge_case", "Пограничные случаи"],
          ],
          methodEyebrow: "method",
          methodTitle: "Как проходит повторение",
          methodSteps: [
            ["01", "Вспомни", "Сформулируй ответ до того, как перевернёшь карточку."],
            ["02", "Сверь", "Открой короткий правильный ответ и найди пробел."],
            ["03", "Оцени", "Hard вернётся в очередь, normal/easy завершат карточку."],
          ],
        },
        session: {
          loading: "Loading card session…",
          sessionError: "Не удалось загрузить карточки. Обнови страницу или загляни позже.",
          retry: "повторить",
          progress: "reviewed",
          remaining: "remaining",
          showAnswer: "Show answer",
          hideAnswer: "Hide answer",
          ratePrompt: "Как вспомнилось?",
          hardHint: "вернуть в очередь",
          normalHint: "закрепить позже",
          easyHint: "считать уверенной",
          reset: "Reset session",
          completedEyebrow: "session complete",
          completedTitle: "Карточки на сегодня разобраны.",
          completedDescription:
            "Оценки сохранены. Hard-карточки возвращались в очередь, easy/normal закрывали карточку на сегодня.",
          startAgain: "Start again",
          lastReviews: "Last ratings",
          answerLabel: "answer",
          questionLabel: "question",
          nextReview: {
            hard: "сегодня ещё раз",
            normal: "через 3 дня",
            easy: "через 7 дней",
          },
          emptyHistory: "Оценок пока нет — открой ответ и выбери сложность.",
          sessionCompleteTitle: "ReAlgo cards complete",
          sessionCompleteBody: "Карточки на сегодня разобраны. Завтра вернём нужные паттерны.",
          focus: {
            aiBadgeTitle: "Карточка сгенерирована ИИ — возможны неточности",
            exit: "Exit session",
            progress: "Card",
            of: "of",
            showAnswer: "Show answer",
            answerPrompt: "Сравни ответ со своей формулировкой",
            ratePrompt: "Насколько легко удалось воспроизвести ответ?",
            saving: "Сохраняем оценку…",
            saveError: "Не удалось сохранить оценку. Попробуй ещё раз.",
            keyboardHint: "Space — показать ответ · 1 — Easy · 2 — Normal · 3 — Hard",
            hard: "Hard",
            normal: "Normal",
            easy: "Easy",
            hardHint: "повторить ещё раз",
            normalHint: "вернуться позже",
            easyHint: "ответ уверенный",
            completedEyebrow: "session complete",
            completedTitle: "Повторение завершено.",
            completedDescription:
              "Оценки сохранены. Карточки с оценкой hard уже вернулись в очередь и были повторены.",
            repeatDue: "Repeat hard/normal",
            repeatDueFallback: "Start full review again",
            returnToCards: "Return to cards",
          },
        },
      },
      extension: {
        eyebrow: "/extension",
        title: "Расширение и синхронизация",
        description:
          "Расширение само сохраняет решённые задачи и оценки прямо из браузера. Храним только нужный минимум — без содержимого страниц.",
        statusEyebrow: "status",
        statusTitle: "Connection",
        platformsUnit: "platforms",
        metaLastSync: "last sync",
        metaEventsToday: "events today",
        stateLive: "live",
        stateIdle: "idle",
        justNow: "только что",
        agoMinutes: "мин назад",
        agoHours: "ч назад",
        agoDays: "дн назад",
        statusDescription:
          "Авто-синхронизация включена: решённые задачи и оценки попадают в кабинет автоматически.",
        statusEmpty:
          "Расширение ещё не приносило событий. Установи его и реши первую задачу — платформа появится здесь.",
        eventsEyebrow: "events",
        eventsTitle: "Event log",
        eventsUnit: "последних",
        eventsEmpty: "Событий пока нет.",
        listening: "listening for submissions…",
        loading: "Загружаем статус расширения…",
        errorTitle: "Не удалось загрузить статус расширения",
        retry: "повторить",
        eventTypes: [
          ["problem_solved", "solved", "success"],
          ["problem_submitted", "submitted", "warning"],
          ["rating_changed", "rating updated", "accent"],
          ["problem_viewed", "viewed", "default"],
        ],
      },
      settings: {
        eyebrow: "/settings",
        title: "Настройки аккаунта",
        description:
          "Профиль, дата интервью, установка приложения, напоминания и приватность — всё, что настраивает подготовку.",
        profileEyebrow: "profile",
        profileTitle: "Preparation settings",
        installEyebrow: "pwa",
        installTitle: "Install ReAlgo",
        notificationsEyebrow: "notifications",
        notificationsTitle: "Review reminders",
        privacyEyebrow: "privacy",
        privacyTitle: "Data controls",
        deleteTitle: "удаление аккаунта и данных",
        deleteDescription:
          "По заявке мы безвозвратно удаляем аккаунт и все связанные с ним данные: решённые задачи, историю повторений, карточки, AI-материалы и настройки.",
        deleteAccount: "оставить заявку на удаление",
        deleteConfirm: "Аккаунт ReAlgo и все данные будут удалены безвозвратно. Это действие нельзя отменить.",
        deletePasswordPrompt: "Введите пароль, чтобы подтвердить удаление",
        deleteCancel: "отмена",
        deleteForever: "удалить навсегда",
        deleteDone: "account deleted",
        actionFailed: "action failed",
        profile: {
          emailLabel: "email",
          email: "demo@realgo.dev",
          timezoneLabel: "timezone",
          timezone: "Europe/Moscow",
          timezonePlaceholder: "Например, Europe/Moscow",
          interviewDateLabel: "interview date",
          interviewDate: "2026-07-20",
          platformLabel: "площадка",
          platformPlaceholder: "—",
          planLabel: "plan",
          plan: "Free mock",
          save: "save changes",
          saved: "saved",
          saveFailed: "profile save failed",
          quickSetup: "quick setup →",
        },
        install: {
          description:
            "Сохрани ReAlgo как приложение, чтобы открывать кабинет и карточки с домашнего экрана.",
          install: "install app",
          installed: "installed",
          manualSupport: "ReAlgo поддерживает установку как PWA-приложение.",
          manualHint: "Используй меню браузера: Share → Add to Home Screen.",
          ready: "ready to install",
        },
        notifications: {
          description:
            "Базовые флаги напоминаний синхронизируются с аккаунтом; показ уведомлений остаётся локальным через браузер/PWA.",
          enable: "enable",
          enabled: "notifications enabled",
          disabled: "permission required",
          permissionDenied: "permission denied in browser",
          permissionGranted: "permission granted",
          permissionUnsupported: "notifications unsupported",
          dailyReminder: "Ежедневное напоминание о подготовке",
          cardReviewReminder: "Карточки к повторению",
          streakReminder: "Защита серии (streak)",
          reminderTime: "reminder time",
          sendTest: "send test",
          syncFailed: "notification settings sync failed",
          testTitle: "ReAlgo review reminder",
          testBody: "Карточки ждут короткого повторения.",
          testSent: "test notification sent",
        },
      },
    },
  },
} as const;

export type Dictionary = typeof ru;

const dictionaries: Record<Locale, Dictionary> = {
  ru,
};

export function getDictionary(locale: Locale = defaultLocale) {
  return dictionaries[locale];
}

export function isSupportedLocale(value: string): value is Locale {
  return supportedLocales.includes(value as Locale);
}

// ===== #114 account security panel =====
export const accountSecurityCopy = {
  panelEyebrow: "security",
  panelTitle: "Password & sessions",
  currentPasswordLabel: "current password",
  newPasswordLabel: "new password",
  confirmPasswordLabel: "confirm password",
  passwordPlaceholder: "••••••••",
  save: "change password",
  saved: "password changed",
  saveFailed: "password change failed",
  tooShort: "Минимум 8 символов",
  mismatch: "Пароли не совпадают",
  soon: "Смена пароля скоро будет доступна.",
  revokeTitle: "Выйти со всех устройств",
  revokeDescription:
    "Завершит все активные сессии, кроме текущей. Потребуется заново войти на других устройствах.",
  revokeAction: "log out everywhere",
  revokeConfirm: "Выйти со всех устройств? Это действие нельзя отменить.",
  revokeDone: "all sessions revoked",
  revokeFallback: "Серверная заглушка — текущая сессия завершена локально.",
  revokeFailed: "revoke failed",
} as const;

// ===== #62 onboarding API wiring =====
export const onboardingApiCopy = {
  saving: "Сохраняем…",
  saveFailed: "Не удалось сохранить профиль. Попробуйте ещё раз.",
  companiesSearchFailed: "Не удалось загрузить подсказки компаний.",
} as const;
