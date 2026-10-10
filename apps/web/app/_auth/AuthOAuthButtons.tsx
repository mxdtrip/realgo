"use client";

import { YandexAuthButton } from "./YandexAuthButton";

/**
 * OAuth entry point. A provider whose public client id is not installed
 * remains visible but disabled, so the auth page truthfully communicates the
 * intended methods without sending visitors to a broken flow.
 */
export function AuthOAuthButtons({ disabled }: { disabled?: boolean }) {
  return (
    <div aria-label="Способ входа" className="auth-providers">
      <YandexAuthButton disabled={disabled} />
    </div>
  );
}
