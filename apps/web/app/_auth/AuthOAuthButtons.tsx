"use client";

import { GithubAuthButton } from "./GithubAuthButton";
import { isGithubAuthConfigured } from "./githubOAuth";
import { YandexAuthButton } from "./YandexAuthButton";
import { isYandexAuthConfigured } from "./yandexOAuth";

/**
 * Divider + whichever "sign in with ..." buttons are configured for this
 * build. Renders nothing when no provider is configured, so an unconfigured
 * deployment never shows a bare, useless divider.
 */
export function AuthOAuthButtons({ disabled }: { disabled?: boolean }) {
  if (!isYandexAuthConfigured() && !isGithubAuthConfigured()) return null;

  return (
    <div className="auth-oauth">
      <div className="auth-divider">
        <span>или</span>
      </div>
      <YandexAuthButton disabled={disabled} />
      <GithubAuthButton disabled={disabled} />
    </div>
  );
}
