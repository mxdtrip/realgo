import type { ReactNode } from "react";

import { getDictionary } from "../_content/i18n";

export function AuthPageShell({ children }: { children: ReactNode }) {
  const dictionary = getDictionary();

  return (
    <main className="auth-page">
      <aside className="auth-page__story">
        <a className="auth-page__brand" href="/" aria-label={dictionary.marketing.hero.homeAria}>
          <span aria-hidden="true" className="auth-page__brand-mark">r</span>
          <span>{dictionary.common.brand}</span>
        </a>

        <div className="auth-page__story-content">
          <span className="auth-page__eyebrow">// memory-first practice</span>
          <h2>Решения остаются<br />с тобой.</h2>
          <p>
            ReAlgo превращает пройденные задачи в понятную систему повторений — без
            ощущения, что всё нужно учить заново.
          </p>

          <div aria-hidden="true" className="auth-code-card">
            <div className="auth-code-card__head">
              <span>review.ts</span>
              <span>● ● ●</span>
            </div>
            <code>
              <span><i>01</i><b>while</b> (!remembered) {'{'}</span>
              <span><i>02</i>&nbsp;&nbsp;practice.next();</span>
              <span><i>03</i>&nbsp;&nbsp;review.at(rightTime);</span>
              <span><i>04</i>{'}'}</span>
            </code>
            <div className="auth-code-card__pulse"><span /> следующая практика · сегодня</div>
          </div>
        </div>

        <div className="auth-page__stats" aria-label="Возможности ReAlgo">
          <span><b>01</b> задачи</span>
          <span><b>02</b> повторения</span>
          <span><b>03</b> прогресс</span>
        </div>
      </aside>

      <div className="auth-page__main">{children}</div>
    </main>
  );
}
