import type { ReactNode } from "react";

import { getDictionary } from "../_content/i18n";

export function AuthPageShell({ children }: { children: ReactNode }) {
  const dictionary = getDictionary();

  return (
    <main className="auth-page">
      <aside className="auth-page__story">
        <a className="auth-page__brand" href="/" aria-label={dictionary.marketing.hero.homeAria}>
          <img
            alt=""
            aria-hidden="true"
            className="auth-page__brand-mark"
            height={32}
            src="/icons/realgo-mark.svg"
            width={32}
          />
          <span>{dictionary.common.brand}</span>
        </a>

        <div className="auth-page__story-content">
          <span aria-hidden="true" className="auth-page__quote-line" />
          <blockquote>
            Плохие программисты беспокоятся о коде.<br />
            Хорошие — о структурах данных и их взаимосвязях.
          </blockquote>
          <p>Линус Торвальдс</p>
        </div>
      </aside>

      <div className="auth-page__main">{children}</div>
    </main>
  );
}
