"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "../../../_api/AuthProvider";
import { ApiError } from "../../../_api/types";
import { consumeGithubState, githubRedirectURI } from "../../../_auth/githubOAuth";

export function GithubCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const [error, setError] = useState("");
  // The authorization code is single-use server-side; guard against React
  // re-running the effect (StrictMode, or a param-triggered re-render) so it
  // isn't sent twice and rejected by GitHub on the second attempt.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const oauthError = searchParams.get("error");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (oauthError) {
      setError("Вход через GitHub отменён.");
      return;
    }
    if (!code || !consumeGithubState(state)) {
      setError("Не удалось подтвердить запрос входа через GitHub. Попробуйте ещё раз.");
      return;
    }

    auth
      .loginWithGithub(code, githubRedirectURI())
      .then((user) => {
        router.replace(user.onboarding_completed ? "/dashboard" : "/onboarding/profile");
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "Что-то пошло не так. Попробуйте ещё раз.");
      });
  }, [auth, router, searchParams]);

  return (
    <div className="auth-layer auth-layer--page">
      <section className="auth-panel" aria-live="polite">
        {error ? (
          <>
            <p className="auth-form__error" role="alert">
              {error}
            </p>
            <a href="/login">Вернуться ко входу</a>
          </>
        ) : (
          <p>Входим через GitHub…</p>
        )}
      </section>
    </div>
  );
}
