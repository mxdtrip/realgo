"use client";

import { useCallback, useState } from "react";

import { isYandexAuthConfigured, startYandexAuth } from "./yandexOAuth";

/** "Войти через Яндекс ID" with an honest disabled fallback for unconfigured builds. */
export function YandexAuthButton({ disabled }: { disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleClick = useCallback(() => {
    setError("");
    setPending(true);
    try {
      startYandexAuth();
      // No need to reset pending: the page is about to navigate away.
    } catch {
      setPending(false);
      setError("Вход через Яндекс ID сейчас недоступен.");
    }
  }, []);

  if (!isYandexAuthConfigured()) {
    return (
      <button
        aria-describedby="oauth-note"
        className="auth-provider auth-provider--yandex"
        disabled
        title="Яндекс ID подключается"
        type="button"
      >
        <YandexMark />
        <span>Яндекс ID</span>
        <small>скоро</small>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="auth-provider auth-provider--yandex"
        onClick={handleClick}
        disabled={disabled || pending}
      >
        <YandexMark />
        <span>{pending ? "Переходим в Яндекс…" : "Яндекс ID"}</span>
      </button>
      {error ? (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function YandexMark() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="10" fill="#fc3f1d" />
      <path
        fill="#fff"
        d="M11.1 5h-.98c-1.9 0-3.24 1-3.24 2.83 0 1.31.62 2.09 1.7 2.66L6 15h1.62l1.86-3.94h.9V15h1.5V5zm-1.32 4.94c-.94 0-1.5-.53-1.5-1.66 0-1.1.56-1.7 1.5-1.7h.7v3.36h-.7z"
      />
    </svg>
  );
}
