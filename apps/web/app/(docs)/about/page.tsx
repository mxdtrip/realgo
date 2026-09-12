import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "О команде",
  description:
    "ReAlgo делает небольшая команда, которая сама готовилась к техническим собеседованиям и знает разницу между «решить один раз» и «помнить через месяц».",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "О команде ReAlgo",
    description:
      "Команда, которая сама проходила технические собеседования и построила ReAlgo как память подготовки, а не ещё один список задач.",
    url: "/about",
  },
};

const team = [
  {
    handle: "Mxdtrip",
    role: "координация и продукт",
    detail:
      "продуктовые решения и приоритеты, интеграции, деплой и секреты, часть веб-документов",
  },
  {
    handle: "MixKage",
    role: "frontend",
    detail: "веб-кабинет, страницы продукта, подключение к API",
  },
  {
    handle: "bryack",
    role: "тесты",
    detail: "автор идеи; цикл повторений и quiz-логика, автотесты и e2e-харнесс",
  },
  {
    handle: "Mikebang",
    role: "backend и devops",
    detail: "API, индексы в БД, идемпотентность операций, runbook'и и оркестрация деплоя",
  },
  {
    handle: "P1xart",
    role: "миграции данных",
    detail: "миграции схемы БД, констрейнты, консистентность данных, контракт API",
  },
  {
    handle: "PAO",
    role: "QA",
    detail: "smoke-тесты, fixtures, e2e и ручная проверка перед релизом",
  },
];

export default function AboutPage() {
  return (
    <main className="landing-section legal-page">
      <article className="pattern-profile">
        <header className="pattern-profile__hero pattern-profile__hero--center">
          <span className="pattern-profile__code">Команда // About</span>
          <h1>Команда, которая сама заваливала технические собеседования</h1>
          <p className="pattern-profile__lead">
            ReAlgo делает небольшая команда, которая сама проходила
            технические собеседования и знает главную проблему: решить
            задачу один раз — легко, вспомнить её через месяц на реальном
            интервью — нет. Отсюда и продукт: не ещё один список задач, а
            память подготовки.
          </p>
        </header>

        <section className="pattern-profile__section" id="team">
          <header className="pattern-profile__rail">
            <h2>Команда</h2>
          </header>
          <div className="pattern-profile__body">
            <ul className="pattern-profile__list pattern-profile__list--mechanics">
              {team.map((member) => (
                <li key={member.handle}>
                  <strong>{member.handle}</strong> — {member.role}
                  <span className="team-member-detail">{member.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pattern-profile__section" id="realgo">
          <header className="pattern-profile__rail">
            <h2>ReAlgo</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Мы развиваем ReAlgo как самостоятельный продукт: от идеи и
              архитектуры до production, поддержки пользователей и проверки
              продуктовых гипотез. Решения принимаются по тому, насколько они
              помогают кандидату системно готовиться и не терять уже
              полученные знания.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
