"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { resendVerification } from "../_api/auth";
import { useAuth } from "../_api/AuthProvider";
import { Spinner } from "../_ui/Spinner";

type State = { status: "verifying" } | { status: "success" } | { status: "invalid"; id: string | null };

export function ConfirmEmailPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const [state, setState] = useState<State>({ status: "verifying" });
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  // Effects can double-fire in dev/StrictMode; confirm-email tokens are
  // single-use, so a second real call would always fail and mask the result
  // of the first one.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const id = searchParams.get("id");
    const token = searchParams.get("token");
    if (!id || !token) {
      setState({ status: "invalid", id });
      return;
    }

    auth
      .confirmEmail(id, token)
      .then((user) => {
        setState({ status: "success" });
        router.push(user.onboarding_completed ? "/dashboard" : "/onboarding/profile");
      })
      .catch(() => setState({ status: "invalid", id }));
    // Runs once on mount against the URL's own id/token — deliberately not
    // re-run when auth/router identities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleResend(event: React.FormEvent) {
    event.preventDefault();
    if (state.status !== "invalid" || !state.id || resendStatus === "sending") return;
    setResendStatus("sending");
    try {
      await resendVerification({ id: state.id });
      setResendStatus("sent");
    } catch {
      setResendStatus("error");
    }
  }

  if (state.status === "verifying" || state.status === "success") {
    return (
      <section aria-label="Подтверждение почты" className="auth-panel">
        <p style={{ margin: 0, fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <Spinner size="sm" decorative />
          {state.status === "success" ? "Готово, входим…" : "Подтверждаем почту…"}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Подтверждение почты" className="auth-panel">
      <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>
        Ссылка недействительна или истекла. Попробуйте ещё раз.
      </p>

      {state.id ? (
        <form className="auth-form" onSubmit={handleResend}>
          {resendStatus === "error" ? (
            <p className="auth-form__error" role="alert">
              Не удалось отправить письмо. Попробуйте ещё раз.
            </p>
          ) : null}
          <button disabled={resendStatus === "sending"} type="submit">
            {resendStatus === "sent"
              ? "Письмо отправлено"
              : resendStatus === "sending"
                ? "Отправляем…"
                : "Отправить ссылку ещё раз"}
          </button>
        </form>
      ) : (
        <Link href="/register">Зарегистрироваться заново</Link>
      )}
    </section>
  );
}
