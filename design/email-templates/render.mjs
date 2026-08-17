import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");

const shared = {
  ProductURL: "https://realgo.dev",
  SupportURL: "https://realgo.dev/support",
  SettingsURL: "https://realgo.dev/settings",
  LogoURL: "https://realgo.dev/icons/realgo-logo.png",
};

const emails = [
  {
    id: "welcome",
    name: "Успешная регистрация",
    category: "onboarding",
    subject: "Добро пожаловать в ReAlgo — первая карточка уже ждёт",
    preheader: "Аккаунт создан. Настройте цель интервью и получите персональный план.",
    eyebrow: "аккаунт создан",
    badge: "READY",
    accent: "#58a6ff",
    accentSoft: "#13243a",
    icon: "✓",
    title: "Добро пожаловать, {{.FirstName}}.",
    lead: "Теперь решённые задачи не будут исчезать из памяти сразу после Accepted.",
    paragraphs: [
      "ReAlgo соединяет привычную практику, интервальные повторения и AI-подсказки в один короткий ежедневный ритуал.",
    ],
    panel: `
      <p class="panel-label">ВАШ ПЕРВЫЙ МАРШРУТ</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr><td class="step-index">01</td><td class="step-copy"><strong>Укажите дату интервью</strong><span>План автоматически подстроится под оставшееся время.</span></td></tr>
        <tr><td class="step-index">02</td><td class="step-copy"><strong>Выберите компанию</strong><span>Покажем приоритетные паттерны и темы.</span></td></tr>
        <tr><td class="step-index">03</td><td class="step-copy"><strong>Подключите расширение</strong><span>Успешные сабмиты попадут в ReAlgo без ручного ввода.</span></td></tr>
      </table>`,
    cta: { label: "Настроить подготовку", url: "{{.OnboardingURL}}" },
    footnote: "Настройка занимает около двух минут.",
    sample: { FirstName: "Алексей", OnboardingURL: "https://realgo.dev/onboarding" },
  },
  {
    id: "interview-soon",
    name: "Собеседование скоро",
    category: "lifecycle",
    subject: "Собеседование через {{.DaysLeft}} дней — фокус на главном",
    preheader: "Мы собрали приоритетный план на оставшиеся дни без лишнего гринда.",
    eyebrow: "интервью приближается",
    badge: "T−{{.DaysLeft}}",
    accent: "#d29922",
    accentSoft: "#30250f",
    icon: "⌁",
    title: "До интервью — {{.DaysLeft}} дней.",
    lead: "Сейчас важнее не решать больше, а надёжно удержать уже знакомые паттерны.",
    panel: `
      <p class="panel-label">ФОКУС НА СЕГОДНЯ</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr><td class="metric"><strong>{{.DueCount}}</strong><span>карточек<br>к повторению</span></td><td class="metric"><strong>{{.WeakCount}}</strong><span>слабых<br>паттерна</span></td><td class="metric"><strong>{{.Minutes}}</strong><span>минут<br>в фокусе</span></td></tr>
      </table>
      <div class="focus-line"><span>приоритет</span><strong>{{.FocusPattern}}</strong></div>`,
    cta: { label: "Начать короткую сессию", url: "{{.SessionURL}}" },
    secondary: { label: "Открыть весь план", url: "{{.RoadmapURL}}" },
    footnote: "Мы не добавляем новые темы в последний момент — только то, что повышает уверенность.",
    sample: { DaysLeft: "5", DueCount: "8", WeakCount: "3", Minutes: "12", FocusPattern: "Sliding Window", SessionURL: "https://realgo.dev/cards/session", RoadmapURL: "https://realgo.dev/roadmap" },
  },
  {
    id: "password-reset",
    name: "Запрос смены пароля",
    category: "security",
    subject: "Ссылка для смены пароля ReAlgo",
    preheader: "Ссылка действует {{.ExpiresIn}} минут и может быть использована только один раз.",
    eyebrow: "безопасность аккаунта",
    badge: "SECURE",
    accent: "#58a6ff",
    accentSoft: "#13243a",
    icon: "↻",
    title: "Сменить пароль?",
    lead: "Мы получили запрос на смену пароля для аккаунта {{.Email}}.",
    paragraphs: ["Если это были вы, используйте кнопку ниже. Ссылка одноразовая и перестанет работать через {{.ExpiresIn}} минут."],
    cta: { label: "Создать новый пароль", url: "{{.ResetURL}}" },
    notice: "Не запрашивали смену? Ничего делать не нужно. Ваш пароль останется прежним.",
    footnote: "Из соображений безопасности не пересылайте это письмо и не сообщайте ссылку другим людям.",
    sample: { Email: "alexey@example.com", ExpiresIn: "30", ResetURL: "https://realgo.dev/reset-password?token=demo" },
  },
  {
    id: "password-changed",
    name: "Пароль изменён",
    category: "security",
    subject: "Пароль ReAlgo изменён",
    preheader: "Подтверждаем изменение пароля и показываем, что делать, если это были не вы.",
    eyebrow: "изменение подтверждено",
    badge: "DONE",
    accent: "#3fb950",
    accentSoft: "#122b19",
    icon: "✓",
    title: "Пароль обновлён.",
    lead: "Пароль аккаунта {{.Email}} был изменён {{.ChangedAt}}.",
    panel: `
      <p class="panel-label">ДЕТАЛИ СОБЫТИЯ</p>
      <div class="detail-row"><span>Время</span><strong>{{.ChangedAt}}</strong></div>
      <div class="detail-row"><span>Устройство</span><strong>{{.Device}}</strong></div>
      <div class="detail-row"><span>Регион</span><strong>{{.Region}}</strong></div>`,
    notice: "Если это были не вы, немедленно восстановите доступ и завершите остальные активные сессии.",
    cta: { label: "Защитить аккаунт", url: "{{.RecoveryURL}}" },
    sample: { Email: "alexey@example.com", ChangedAt: "17 августа, 14:32 MSK", Device: "Chrome · macOS", Region: "Москва, Россия", RecoveryURL: "https://realgo.dev/reset-password" },
  },
  {
    id: "support-reply",
    name: "Ответ поддержки",
    category: "support",
    subject: "Re: {{.TicketSubject}} · обращение #{{.TicketID}}",
    preheader: "Команда ReAlgo ответила на ваше обращение.",
    eyebrow: "поддержка · #{{.TicketID}}",
    badge: "REPLY",
    accent: "#bc8cff",
    accentSoft: "#241936",
    icon: "→",
    title: "{{.FirstName}}, мы разобрались.",
    lead: "{{.SupportAnswer}}",
    panel: `
      <p class="panel-label">КОНТЕКСТ ОБРАЩЕНИЯ</p>
      <p class="quote">«{{.OriginalMessage}}»</p>
      <div class="detail-row"><span>Статус</span><strong>{{.TicketStatus}}</strong></div>`,
    paragraphs: ["Если проблема сохранилась, ответьте прямо на это письмо — история обращения останется в цепочке."],
    cta: { label: "Открыть ReAlgo", url: "{{.ProductURL}}" },
    signature: "{{.AgentName}} · команда поддержки ReAlgo",
    sample: { TicketID: "1842", TicketSubject: "Не появляется новая карточка", FirstName: "Алексей", SupportAnswer: "Мы восстановили генерацию карточек для вашей последней задачи. Новая сессия уже доступна в кабинете.", OriginalMessage: "После Accepted задача появилась, но карточки не сгенерировались.", TicketStatus: "решено", AgentName: "Михаил" },
  },
  {
    id: "review-reminder",
    name: "Карточки к повторению",
    category: "engagement",
    subject: "{{.DueCount}} карточек пора повторить",
    preheader: "Короткая сессия сегодня сохранит решения доступными к интервью.",
    eyebrow: "очередь повторений",
    badge: "{{.DueCount}} DUE",
    accent: "#3fb950",
    accentSoft: "#122b19",
    icon: "↗",
    title: "Память просит 7 минут.",
    lead: "{{.DueCount}} карточек подошли к оптимальному моменту повторения. Сейчас эффект будет максимальным.",
    panel: `
      <p class="panel-label">СЕГОДНЯ В ОЧЕРЕДИ</p>
      <div class="task-row"><span class="task-dot"></span><strong>{{.TaskOne}}</strong><em>{{.PatternOne}}</em></div>
      <div class="task-row"><span class="task-dot"></span><strong>{{.TaskTwo}}</strong><em>{{.PatternTwo}}</em></div>
      <div class="task-row"><span class="task-dot"></span><strong>{{.TaskThree}}</strong><em>{{.PatternThree}}</em></div>`,
    cta: { label: "Начать повторение", url: "{{.SessionURL}}" },
    footnote: "Не успеваете сегодня? Очередь сохранится, а частоту писем можно изменить в настройках.",
    sample: { DueCount: "6", TaskOne: "Minimum Window Substring", PatternOne: "sliding window", TaskTwo: "Course Schedule", PatternTwo: "topological ordering", TaskThree: "LRU Cache", PatternThree: "stateful structures", SessionURL: "https://realgo.dev/cards/session" },
  },
  {
    id: "weekly-digest",
    name: "Недельный прогресс",
    category: "engagement",
    subject: "Неделя в ReAlgo: {{.RetentionPercent}}% удержания",
    preheader: "Ваш прогресс, сильные паттерны и один понятный фокус на следующую неделю.",
    eyebrow: "weekly memory report",
    badge: "W{{.WeekNumber}}",
    accent: "#58a6ff",
    accentSoft: "#13243a",
    icon: "⌘",
    title: "Прогресс, который остаётся.",
    lead: "На этой неделе вы не просто решили задачи — вы закрепили способы их решения.",
    panel: `
      <p class="panel-label">7 ДНЕЙ В ЦИФРАХ</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr><td class="metric"><strong>{{.ReviewedCount}}</strong><span>карточек<br>повторено</span></td><td class="metric"><strong>{{.RetentionPercent}}%</strong><span>прогноз<br>удержания</span></td><td class="metric"><strong>{{.StreakDays}}</strong><span>дней<br>серия</span></td></tr>
      </table>
      <div class="focus-line"><span>рост недели</span><strong>{{.GrowthPattern}} · +{{.GrowthPercent}}%</strong></div>`,
    paragraphs: ["Следующий лучший шаг — {{.NextFocus}}. Мы уже поставили его первым в вашем плане."],
    cta: { label: "Посмотреть полный отчёт", url: "{{.DashboardURL}}" },
    sample: { WeekNumber: "33", ReviewedCount: "24", RetentionPercent: "87", StreakDays: "6", GrowthPattern: "Two Pointers", GrowthPercent: "18", NextFocus: "закрепить Dynamic Programming", DashboardURL: "https://realgo.dev/dashboard" },
  },
];

function interpolate(value, values) {
  return String(value).replace(/\{\{\.([A-Za-z0-9_]+)}}/g, (_, key) => values[key] ?? `{{.${key}}}`);
}

function emailMarkup(email, values = {}) {
  const data = { ...shared, ...values };
  const render = (value) => interpolate(value ?? "", data);
  const paragraphs = (email.paragraphs ?? []).map((p) => `<p class="body-copy">${render(p)}</p>`).join("");
  const panel = email.panel ? `<div class="data-panel">${render(email.panel)}</div>` : "";
  const notice = email.notice ? `<div class="notice"><span>i</span><p>${render(email.notice)}</p></div>` : "";
  const secondary = email.secondary ? `<p class="secondary"><a href="${render(email.secondary.url)}">${render(email.secondary.label)} →</a></p>` : "";
  const signature = email.signature ? `<p class="signature">${render(email.signature)}</p>` : "";
  const footnote = email.footnote ? `<p class="footnote">${render(email.footnote)}</p>` : "";
  const subject = render(email.subject);
  const preheader = render(email.preheader);

  return `<!doctype html>
<html lang="ru" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${subject}</title>
  <style>
    html,body{margin:0!important;padding:0!important;width:100%!important;background:#080b10;color:#e6edf3;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{border-collapse:collapse!important;mso-table-lspace:0pt!important;mso-table-rspace:0pt!important}img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}a{text-decoration:none}.preheader{display:none!important;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all}.wrap{width:100%;background:#080b10}.shell{width:100%;max-width:640px}.pad{padding:44px 20px}.card{background:#0d1117;border:1px solid #30363d;border-radius:24px;overflow:hidden}.header{padding:26px 36px;border-bottom:1px solid #21262d}.brand{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:17px;font-weight:750;letter-spacing:.2px;color:#f0f6fc}.brand img{display:inline-block;width:30px;height:30px;vertical-align:middle;margin-right:10px}.badge{font-family:SFMono-Regular,Consolas,"Liberation Mono",monospace;font-size:10px;font-weight:700;letter-spacing:1px;color:${email.accent};background:${email.accentSoft};border:1px solid ${email.accent};border-radius:999px;padding:6px 9px}.hero{padding:52px 52px 20px}.eyebrow{margin:0 0 22px;font-family:SFMono-Regular,Consolas,"Liberation Mono",monospace;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.25px;text-transform:uppercase;color:${email.accent}}.hero-icon{display:inline-block;width:48px;height:48px;line-height:48px;text-align:center;border-radius:15px;background:${email.accentSoft};border:1px solid ${email.accent};font-family:SFMono-Regular,Consolas,monospace;font-size:23px;color:${email.accent};margin-bottom:24px}.title{margin:0 0 18px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:40px;line-height:1.08;letter-spacing:-1.3px;font-weight:720;color:#f0f6fc}.lead{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:19px;line-height:1.52;letter-spacing:-.15px;color:#b1bac4}.content{padding:0 52px 52px}.body-copy{margin:22px 0 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:15px;line-height:1.7;color:#b1bac4}.data-panel{margin:30px 0 0;padding:24px;border-radius:16px;background:#161b22;border:1px solid #30363d}.panel-label{margin:0 0 18px;font-family:SFMono-Regular,Consolas,"Liberation Mono",monospace;font-size:10px;line-height:1.4;font-weight:700;letter-spacing:1.2px;color:#7d8590}.step-index{width:38px;padding:9px 0;vertical-align:top;font-family:SFMono-Regular,Consolas,monospace;font-size:12px;color:${email.accent}}.step-copy{padding:8px 0 14px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.step-copy strong{display:block;font-size:14px;color:#e6edf3}.step-copy span{display:block;margin-top:4px;font-size:12px;line-height:1.5;color:#7d8590}.metric{width:33.33%;padding:2px 10px 4px;border-left:1px solid #30363d;text-align:center}.metric:first-child{border-left:0}.metric strong{display:block;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:28px;line-height:1.1;color:#f0f6fc}.metric span{display:block;margin-top:7px;font-family:SFMono-Regular,Consolas,monospace;font-size:9px;line-height:1.5;letter-spacing:.5px;text-transform:uppercase;color:#7d8590}.focus-line,.detail-row{margin-top:20px;padding-top:18px;border-top:1px solid #30363d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.focus-line span,.detail-row span{font-family:SFMono-Regular,Consolas,monospace;font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#7d8590}.focus-line strong,.detail-row strong{float:right;font-size:13px;color:${email.accent}}.quote{margin:0 0 18px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:14px;line-height:1.65;color:#b1bac4}.task-row{padding:13px 0;border-top:1px solid #30363d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.task-row:first-of-type{border-top:0}.task-dot{display:inline-block;width:7px;height:7px;margin-right:10px;border-radius:50%;background:${email.accent}.task-row strong{font-size:13px;color:#e6edf3}.task-row em{float:right;font-family:SFMono-Regular,Consolas,monospace;font-size:10px;font-style:normal;color:#7d8590}.notice{margin:28px 0 0;padding:16px 18px;border-radius:13px;background:${email.accentSoft};border:1px solid ${email.accent};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.notice span{display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;background:${email.accent};font-family:Georgia,serif;font-weight:700;color:#080b10;vertical-align:top}.notice p{display:inline-block;width:calc(100% - 40px);margin:0 0 0 10px;font-size:12px;line-height:1.55;color:#d0d7de}.cta-wrap{padding-top:32px}.cta{display:inline-block;padding:14px 22px;border-radius:10px;background:${email.accent};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:14px;font-weight:750;color:#080b10!important}.secondary{margin:18px 0 0}.secondary a{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:13px;font-weight:650;color:${email.accent}}.signature{margin:28px 0 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:13px;color:#e6edf3}.footnote{margin:22px 0 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:11px;line-height:1.55;color:#7d8590}.footer{padding:24px 36px 30px;border-top:1px solid #21262d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:10px;line-height:1.6;color:#656d76}.footer a{color:#8c959f}.footer-links{padding-top:8px}.footer-links a{margin-right:14px}.clearfix:after{content:"";display:table;clear:both}
    @media screen and (max-width:620px){.pad{padding:18px 10px}.card{border-radius:18px}.header{padding:20px}.hero{padding:38px 26px 16px}.content{padding:0 26px 38px}.title{font-size:32px}.lead{font-size:17px}.data-panel{padding:18px}.badge{font-size:9px}.metric{padding-left:5px;padding-right:5px}.metric strong{font-size:23px}.task-row em{float:none;display:block;margin:4px 0 0 18px}.footer{padding:22px 26px}.focus-line strong,.detail-row strong{float:none;display:block;margin-top:5px}}
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <table role="presentation" class="wrap" width="100%" cellspacing="0" cellpadding="0"><tr><td class="pad" align="center">
    <table role="presentation" class="shell" width="640" cellspacing="0" cellpadding="0"><tr><td class="card">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr><td class="header"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td><a class="brand" href="${render("{{.ProductURL}}")}"><img src="${render("{{.LogoURL}}")}" width="30" height="30" alt="">realgo</a></td><td align="right"><span class="badge">${render(email.badge)}</span></td></tr></table></td></tr>
        <tr><td class="hero"><p class="eyebrow">// ${render(email.eyebrow)}</p><span class="hero-icon">${email.icon}</span><h1 class="title">${render(email.title)}</h1><p class="lead">${render(email.lead)}</p></td></tr>
        <tr><td class="content">${paragraphs}${panel}${notice}<div class="cta-wrap"><a class="cta" href="${render(email.cta.url)}">${render(email.cta.label)}</a></div>${secondary}${signature}${footnote}</td></tr>
        <tr><td class="footer">Вы получили это письмо, потому что используете ReAlgo.<div class="footer-links"><a href="${render("{{.SettingsURL}}")}">Настройки писем</a><a href="${render("{{.SupportURL}}")}">Поддержка</a><a href="${render("{{.ProductURL}}")}">realgo.dev</a></div></td></tr>
      </table>
    </td></tr></table>
  </td></tr></table>
</body>
</html>`.replace(
    `background:${email.accent}.task-row strong`,
    `background:${email.accent}}.task-row strong`,
  ).replace(".task-row strong{", "}.task-row strong{");
}

function textMarkup(email) {
  const lines = [
    email.subject,
    "",
    email.title,
    email.lead,
    ...(email.paragraphs ?? []),
    "",
    `${email.cta.label}: ${email.cta.url}`,
  ];
  if (email.secondary) lines.push(`${email.secondary.label}: ${email.secondary.url}`);
  if (email.notice) lines.push("", email.notice);
  if (email.signature) lines.push("", email.signature);
  lines.push("", "Настройки писем: {{.SettingsURL}}", "Поддержка: {{.SupportURL}}");
  return `${lines.join("\n")}\n`;
}

function previewMarkup() {
  const cards = emails.map((email) => `
    <article class="template-card" data-category="${email.category}">
      <header><div><span>${email.category}</span><h2>${email.name}</h2><p>${interpolate(email.subject, { ...shared, ...email.sample })}</p></div><a href="./preview/${email.id}.html" target="_blank">открыть ↗</a></header>
      <iframe title="${email.name}" src="./preview/${email.id}.html" loading="lazy"></iframe>
    </article>`).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ReAlgo · Email system</title><style>
  :root{color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#080b10;color:#e6edf3}*{box-sizing:border-box}body{margin:0;background:radial-gradient(1000px 500px at 50% -100px,#182334 0,#080b10 70%)}main{width:min(1500px,100%);margin:auto;padding:64px 28px 100px}.top{max-width:820px;margin-bottom:42px}.kicker{font:700 11px/1.4 SFMono-Regular,Consolas,monospace;letter-spacing:1.3px;color:#58a6ff;text-transform:uppercase}.top h1{margin:12px 0 16px;font-size:clamp(42px,7vw,76px);line-height:.98;letter-spacing:-3px}.top p{margin:0;color:#8c959f;font-size:18px;line-height:1.6}.filters{display:flex;flex-wrap:wrap;gap:8px;margin:28px 0 38px}.filters button{border:1px solid #30363d;border-radius:999px;background:#0d1117;color:#8c959f;padding:9px 14px;font:600 11px SFMono-Regular,Consolas,monospace;cursor:pointer}.filters button.active{border-color:#58a6ff;color:#58a6ff;background:#13243a}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.template-card{min-width:0;border:1px solid #30363d;border-radius:22px;background:#0d1117;overflow:hidden}.template-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 24px;border-bottom:1px solid #21262d}.template-card header span{font:700 9px SFMono-Regular,Consolas,monospace;letter-spacing:1px;text-transform:uppercase;color:#58a6ff}.template-card h2{margin:7px 0 5px;font-size:18px}.template-card header p{margin:0;font-size:12px;color:#7d8590}.template-card header a{flex:none;color:#8c959f;font:600 10px SFMono-Regular,Consolas,monospace;text-decoration:none}.template-card iframe{display:block;width:100%;height:820px;border:0;background:#080b10}.is-hidden{display:none}@media(max-width:980px){.grid{grid-template-columns:1fr}}@media(max-width:620px){main{padding:38px 14px 70px}.top h1{letter-spacing:-2px}.template-card iframe{height:700px}}
  </style></head><body><main><section class="top"><div class="kicker">// ReAlgo communication system</div><h1>Письма, которые<br>похожи на продукт.</h1><p>Единый визуальный язык для онбординга, безопасности, поддержки и возвращения пользователя в цикл подготовки.</p></section><nav class="filters" aria-label="Фильтр шаблонов"><button class="active" data-filter="all">все</button><button data-filter="onboarding">onboarding</button><button data-filter="lifecycle">lifecycle</button><button data-filter="security">security</button><button data-filter="support">support</button><button data-filter="engagement">engagement</button></nav><section class="grid">${cards}</section></main><script>document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));button.classList.add('active');document.querySelectorAll('.template-card').forEach(card=>card.classList.toggle('is-hidden',button.dataset.filter!=='all'&&card.dataset.category!==button.dataset.filter))}))</script></body></html>`;
}

await Promise.all([
  mkdir(join(dist, "templates"), { recursive: true }),
  mkdir(join(dist, "preview"), { recursive: true }),
  mkdir(join(dist, "text"), { recursive: true }),
]);

for (const email of emails) {
  await Promise.all([
    writeFile(join(dist, "templates", `${email.id}.html`), emailMarkup(email), "utf8"),
    writeFile(join(dist, "preview", `${email.id}.html`), emailMarkup(email, email.sample), "utf8"),
    writeFile(join(dist, "text", `${email.id}.txt`), textMarkup(email), "utf8"),
  ]);
}

await writeFile(join(dist, "index.html"), previewMarkup(), "utf8");
console.log(`Rendered ${emails.length} ReAlgo email templates to ${dist}`);
