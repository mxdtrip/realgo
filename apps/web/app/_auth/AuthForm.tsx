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
      <div className="auth-panel__intro">
        <span className="auth-panel__kicker">// account</span>
        <h1>{mode === "login" ? "С возвращением" : "Начнём путь"}</h1>
        <p>
          {mode === "login"
            ? "Продолжайте там, где остановились."
            : "Создайте аккаунт и превратите практику в привычку."}
        </p>
      </div>

      <div aria-label="Способ входа" className="auth-providers">
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
        <button
          aria-describedby="oauth-note"
          className="auth-provider auth-provider--github"
          disabled
          title="GitHub подключается"
          type="button"
        >
          <GithubMark />
          <span>GitHub</span>
          <small>скоро</small>
        </button>
        <p className="auth-providers__note" id="oauth-note">
          Яндекс ID и GitHub подключаются к стенду. Войти уже можно по почте.
        </p>
      </div>

      <div className="auth-divider" aria-hidden="true">
        <span>или с электронной почтой</span>
      </div>

      <div className="auth-tabs" aria-label="Раздел авторизации">
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

      <p className="auth-panel__switch">
        {mode === "login" ? "Впервые в ReAlgo?" : "Уже есть аккаунт?"}{" "}
        <Link href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "Зарегистрироваться" : "Войти"}
        </Link>
      </p>
    </section>
  );
}

function YandexMark() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <circle cx="10" cy="10" fill="#fc3f1d" r="10" />
      <path
        d="M11.1 5h-.98c-1.9 0-3.24 1-3.24 2.83 0 1.31.62 2.09 1.7 2.66L6 15h1.62l1.86-3.94h.9V15h1.5V5zm-1.32 4.94c-.94 0-1.5-.53-1.5-1.66 0-1.1.56-1.7 1.5-1.7h.7v3.36h-.7z"
        fill="#fff"
      />
    </svg>
  );
}

function GithubMark() {
  return (
    <svg aria-hidden="true" fill="currentColor" focusable="false" viewBox="0 0 24 24">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
