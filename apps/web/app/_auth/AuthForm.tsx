"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { requestPasswordReset, resendVerification } from "../_api/auth";
import { useAuth } from "../_api/AuthProvider";
import { ApiError } from "../_api/types";

type Mode = "login" | "register";

const COPY = {
  login: {
    aria: "Вход в ReAlgo",
    submit: "Войти",
    pending: "Входим…",
  },
  register: {
    aria: "Регистрация в ReAlgo",
    submit: "Создать аккаунт",
    pending: "Создаём…",
  },
} as const;

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  color: "var(--text-dim)",
  textDecoration: "underline",
  fontSize: 13,
  cursor: "pointer",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const auth = useAuth();
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // Set once register sends a confirmation link, or login is rejected for an
  // unconfirmed account — either way the account needs a click in the inbox
  // before anything else can happen.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // "Забыли пароль?" sub-view, reachable only from the login form.
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [resetResendStatus, setResetResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (mode === "register" && !consent) return;
    setPending(true);
    setError("");
    try {
      if (mode === "login") {
        const authUser = await auth.login(email.trim(), password);
        router.push(authUser.onboarding_completed ? "/dashboard" : "/onboarding/profile");
        return;
      }
      const result = await auth.register(email.trim(), password);
      setAwaitingConfirmation(result.email);
    } catch (e) {
      if (mode === "login" && e instanceof ApiError && e.code === "email_not_verified") {
        setAwaitingConfirmation(email.trim());
        return;
      }
      setError(e instanceof ApiError ? e.message : "Что-то пошло не так. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  async function handleResend(event: React.FormEvent) {
    event.preventDefault();
    if (!awaitingConfirmation || resendStatus === "sending") return;
    setResendStatus("sending");
    try {
      await resendVerification({ email: awaitingConfirmation });
      setResendStatus("sent");
    } catch {
      setResendStatus("error");
    }
  }

  async function handleRequestReset(event: React.FormEvent) {
    event.preventDefault();
    if (resetPending) return;
    setResetPending(true);
    setResetError("");
    try {
      // The endpoint itself is neutral (200 whether or not the email is
      // registered — never reveals that). A thrown error here is a genuine
      // client/network failure, not "email unknown", so it's worth surfacing
      // rather than lying about a link having been sent.
      await requestPasswordReset(resetEmail.trim());
      setResetSentTo(resetEmail.trim());
    } catch (e) {
      setResetError(e instanceof ApiError ? e.message : "Что-то пошло не так. Попробуйте ещё раз.");
    } finally {
      setResetPending(false);
    }
  }

  async function handleResendReset(event: React.FormEvent) {
    event.preventDefault();
    if (!resetSentTo || resetResendStatus === "sending") return;
    setResetResendStatus("sending");
    try {
      await requestPasswordReset(resetSentTo);
      setResetResendStatus("sent");
    } catch {
      setResetResendStatus("error");
    }
  }

  function closeForgotPassword() {
    setForgotPasswordOpen(false);
    setResetEmail("");
    setResetSentTo(null);
    setResetResendStatus("idle");
  }

  if (forgotPasswordOpen) {
    return (
      <section aria-label="Восстановление пароля" className="auth-panel">
        <div className="auth-tabs">
          <Link className={mode === "login" ? "active" : ""} href="/login">
            Вход
          </Link>
          <Link className={mode === "register" ? "active" : ""} href="/register">
            Регистрация
          </Link>
        </div>

        {resetSentTo ? (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>
              Если <strong>{resetSentTo}</strong> зарегистрирован у нас, мы отправили на него
              письмо со ссылкой для восстановления пароля — она действует час.
            </p>
            <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.5, color: "var(--text-dim)" }}>
              Не пришло письмо? Проверьте папку «Спам» или отправьте ссылку ещё раз.
            </p>
            <form className="auth-form" onSubmit={handleResendReset}>
              {resetResendStatus === "error" ? (
                <p className="auth-form__error" role="alert">
                  Не удалось отправить письмо. Попробуйте ещё раз.
                </p>
              ) : null}
              <button disabled={resetResendStatus === "sending"} type="submit">
                {resetResendStatus === "sent"
                  ? "Письмо отправлено ещё раз"
                  : resetResendStatus === "sending"
                    ? "Отправляем…"
                    : "Отправить письмо ещё раз"}
              </button>
            </form>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleRequestReset}>
            <p style={{ margin: "0 0 4px", fontSize: 14, lineHeight: 1.5 }}>
              Введите почту, указанную при регистрации — пришлём ссылку для восстановления пароля.
            </p>
            <label>
              Email
              <input
                autoComplete="email"
                placeholder="you@example.com"
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={resetPending}
              />
            </label>
            {resetError ? (
              <p className="auth-form__error" role="alert">
                {resetError}
              </p>
            ) : null}
            <button disabled={resetPending} type="submit">
              {resetPending ? "Отправляем…" : "Отправить ссылку"}
            </button>
          </form>
        )}

        <p style={{ marginTop: 16 }}>
          <button onClick={closeForgotPassword} style={linkButtonStyle} type="button">
            Назад ко входу
          </button>
        </p>
      </section>
    );
  }

  if (awaitingConfirmation) {
    return (
      <section aria-label={copy.aria} className="auth-panel">
        <div className="auth-tabs">
          <Link className={mode === "login" ? "active" : ""} href="/login">
            Вход
          </Link>
          <Link className={mode === "register" ? "active" : ""} href="/register">
            Регистрация
          </Link>
        </div>

        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>
          Мы отправили письмо на <strong>{awaitingConfirmation}</strong>. Перейдите по ссылке в
          нём, чтобы подтвердить почту — ссылка действует час.
        </p>
        <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.5, color: "var(--text-dim)" }}>
          Не пришло письмо? Проверьте папку «Спам» или отправьте ссылку ещё раз.
        </p>

        <form className="auth-form" onSubmit={handleResend}>
          {resendStatus === "error" ? (
            <p className="auth-form__error" role="alert">
              Не удалось отправить письмо. Попробуйте ещё раз.
            </p>
          ) : null}
          <button disabled={resendStatus === "sending"} type="submit">
            {resendStatus === "sent"
              ? "Письмо отправлено ещё раз"
              : resendStatus === "sending"
                ? "Отправляем…"
                : "Отправить письмо ещё раз"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section aria-label={copy.aria} className="auth-panel">
      <div className="auth-tabs">
        <Link className={mode === "login" ? "active" : ""} href="/login">
          Вход
        </Link>
        <Link className={mode === "register" ? "active" : ""} href="/register">
          Регистрация
        </Link>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            autoComplete="email"
            placeholder="you@example.com"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </label>
        <label>
          Пароль
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "register" ? "минимум 8 символов" : "••••••••"}
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
        </label>

        {mode === "register" ? (
          <label className="auth-consent">
            <input
              checked={consent}
              disabled={pending}
              onChange={(e) => setConsent(e.target.checked)}
              required
              type="checkbox"
            />
            <span>
              Принимаю{" "}
              <Link href="/terms" target="_blank">
                Условия использования
              </Link>{" "}
              и{" "}
              <Link href="/privacy" target="_blank">
                Политику конфиденциальности
              </Link>
            </span>
          </label>
        ) : null}

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <button disabled={pending || (mode === "register" && !consent)} type="submit">
          {pending ? copy.pending : copy.submit}
        </button>

        {mode === "login" ? (
          <button
            onClick={() => {
              setResetEmail(email);
              setForgotPasswordOpen(true);
            }}
            style={{ ...linkButtonStyle, alignSelf: "center" }}
            type="button"
          >
            Забыли свой пароль?
          </button>
        ) : null}
      </form>
    </section>
  );
}
