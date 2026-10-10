"use client";

import { GithubAuthButton } from "./GithubAuthButton";
import { YandexAuthButton } from "./YandexAuthButton";

/**
 * OAuth entry points. A provider whose public client id is not installed
 * remains visible but disabled, so the auth page truthfully communicates the
 * intended methods without sending visitors to a broken flow.
 */
export function AuthOAuthButtons({ disabled }: { disabled?: boolean }) {
  return (
    <div aria-label="Способ входа" className="auth-providers">
      <YandexAuthButton disabled={disabled} />
      <GithubAuthButton disabled={disabled} />
    </div>
  );
}
