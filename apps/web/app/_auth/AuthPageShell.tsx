import type { ReactNode } from "react";

import { getDictionary } from "../_content/i18n";
import { AuthStorySlideshow } from "./AuthStorySlideshow";

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
            src="/icons/realgo-logo.png"
            width={28}
          />
          <span>{dictionary.common.brand}</span>
        </a>

        <AuthStorySlideshow />
      </aside>

      <div className="auth-page__main">{children}</div>
    </main>
  );
}
