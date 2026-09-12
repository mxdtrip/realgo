"use client";

import { GithubAuthButton } from "./GithubAuthButton";
import { isGithubAuthConfigured } from "./githubOAuth";
import { YandexAuthButton } from "./YandexAuthButton";
import { isYandexAuthConfigured } from "./yandexOAuth";

/**
 * Fast OAuth entry points. A provider whose public client id is not installed
 * remains visible but disabled, so the auth page truthfully communicates the
 * intended methods without sending visitors to a broken flow.
 */
export function AuthOAuthButtons({ disabled }: { disabled?: boolean }) {
  const isUnavailable = !isYandexAuthConfigured() && !isGithubAuthConfigured();

  return (
    <div aria-label="Способ входа" className="auth-providers">
      <YandexAuthButton disabled={disabled} />
      <GithubAuthButton disabled={disabled} />
      {isUnavailable ? (
        <p className="auth-providers__note" id="oauth-note">
          Яндекс ID и GitHub подключаются к стенду. Войти уже можно по почте.
        </p>
      ) : null}
    </div>
  );
}
