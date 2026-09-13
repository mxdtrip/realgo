"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "../_api/AuthProvider";
import { ApiError } from "../_api/types";
import { AuthOAuthButtons } from "./AuthOAuthButtons";
import { AuthSortingWord } from "./AuthSortingWord";

type Mode = "login" | "register";

const COPY = {
  login: {
    aria: "Вход в ReAlgo",
    submit: "Войти",
    pending: "Входим…",
    redirect: "/dashboard",
  },
  register: {
    aria: "Регистрация в ReAlgo",
    submit: "Создать аккаунт",
    pending: "Создаём…",
    redirect: "/onboarding/profile",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const auth = useAuth();
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameFocused, setNicknameFocused] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (mode === "register" && (!termsAccepted || !personalDataConsent)) return;
    if (mode === "register" && password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов.");
      return;
    }
    if (mode === "register" && password !== passwordConfirmation) {
      setError("Пароли не совпадают.");
      return;
    }
    setPending(true);
    setError("");
    try {
      if (mode === "login") {
        const authUser = await auth.login(email.trim(), password);
        router.push(authUser.onboarding_completed ? "/dashboard" : "/onboarding/profile");
      } else {
		await auth.register(email.trim(), password, nickname.trim());
		window.sessionStorage.setItem("realgo:pending-verification-email", email.trim());
		router.push("/verify-email");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Что-то пошло не так. Попробуйте ещё раз.");
      setPending(false);
    }
  }

  return (
    <section aria-label={copy.aria} className={`auth-panel auth-panel--${mode}`}>
      <div className="auth-panel__heading">
        <AuthSortingWord label={mode === "login" ? "Вход" : "Регистрация"} word={mode} />
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label>
            <span className="auth-field-label">Никнейм</span>
            <span className="auth-input">
              <NicknameIcon />
              <input
                autoComplete="nickname"
                maxLength={32}
                minLength={3}
                placeholder="Никнейм"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={() => setNicknameFocused(false)}
                onFocus={() => setNicknameFocused(true)}
                disabled={pending}
              />
            </span>
            {nicknameFocused ? <span className="auth-field-hint">3–32 символа: буквы, цифры, _ или -</span> : null}
          </label>
        ) : null}
        <label>
          <span className="auth-field-label">Email</span>
          <span className="auth-input">
            <MailIcon />
            <input
              autoComplete="email"
              placeholder="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </span>
        </label>
        <label>
          <span className="auth-field-label">Пароль</span>
          <span className="auth-input">
            <LockIcon />
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="Пароль"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
            />
            <button
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              className="auth-password-toggle"
              disabled={pending}
              onClick={() => setShowPassword((current) => !current)}
              aria-pressed={showPassword}
              type="button"
            >
              {showPassword ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </span>
          {mode === "register" && password.length > 0 ? (
            <span
              aria-live="polite"
              className={password.length < 8 ? "auth-field-hint is-invalid" : "auth-field-hint"}
            >
              {password.length < 8
                ? `Ещё ${8 - password.length} ${password.length === 7 ? "символ" : "символа"}`
                : "Пароль подходит"}
            </span>
          ) : null}
        </label>

        {mode === "register" ? (
          <label>
            <span className="auth-field-label">Повторите пароль</span>
            <span className="auth-input">
              <LockIcon />
              <input
                autoComplete="new-password"
                placeholder="Повторите пароль"
                type={showPasswordConfirmation ? "text" : "password"}
                required
                minLength={8}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                disabled={pending}
              />
              <button
                aria-label={showPasswordConfirmation ? "Скрыть пароль" : "Показать пароль"}
                className="auth-password-toggle"
                disabled={pending}
                onClick={() => setShowPasswordConfirmation((current) => !current)}
                aria-pressed={showPasswordConfirmation}
                type="button"
              >
                {showPasswordConfirmation ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </span>
            {passwordConfirmation.length > 0 && passwordConfirmation !== password ? (
              <span aria-live="polite" className="auth-field-hint is-invalid">Пароли не совпадают</span>
            ) : null}
          </label>
        ) : null}

        {mode === "register" ? (
          <div className="auth-consents">
            <label className="auth-consent">
              <input
                checked={termsAccepted}
                disabled={pending}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                required
                type="checkbox"
              />
              <span>
                Принимаю{" "}
                <Link href="/terms" target="_blank">
                  Пользовательское соглашение
                </Link>
              </span>
            </label>
            <label className="auth-consent">
              <input
                checked={personalDataConsent}
                disabled={pending}
                onChange={(e) => setPersonalDataConsent(e.target.checked)}
                required
                type="checkbox"
              />
              <span>
                Даю согласие на обработку персональных данных на условиях{" "}
                <Link href="/privacy" target="_blank">
                  Политики конфиденциальности
                </Link>
              </span>
            </label>
          </div>
        ) : null}

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          disabled={
            pending ||
            (mode === "register" &&
              (!termsAccepted ||
                !personalDataConsent ||
                !nickname.trim() ||
                password.length < 8 ||
                password !== passwordConfirmation))
          }
          type="submit"
        >
          <span>{pending ? copy.pending : copy.submit}</span>
          {!pending ? <span aria-hidden="true" className="auth-submit__arrow">→</span> : null}
        </button>
      </form>

      <div className="auth-divider" aria-hidden="true">
        <span>или продолжите через</span>
      </div>

      <AuthOAuthButtons disabled={pending} />

      <p className="auth-panel__switch">
        {mode === "login" ? "Впервые в ReAlgo?" : "Уже есть аккаунт?"}{" "}
        <Link href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "Создайте аккаунт" : "Войдите"}
        </Link>
      </p>
      {mode === "login" ? <p className="auth-panel__switch"><Link href="/forgot-password">Не помню пароль</Link></p> : null}
    </section>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 20 20">
      <rect height="13" rx="2" width="16" x="2" y="3.5" />
      <path d="m3 5 7 5 7-5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 20 20">
      <rect height="9" rx="2" width="12" x="4" y="8" />
      <path d="M6.5 8V6a3.5 3.5 0 0 1 7 0v2" />
    </svg>
  );
}

function NicknameIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 20 20">
      <circle cx="10" cy="6.25" r="3" />
      <path d="M3.5 17c.6-3.1 2.75-4.65 6.5-4.65S15.9 13.9 16.5 17" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 20 20">
      <path d="M2.25 10s2.75-4.25 7.75-4.25S17.75 10 17.75 10 15 14.25 10 14.25 2.25 10 2.25 10Z" />
      <circle cx="10" cy="10" r="2.25" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 20 20">
      <path d="M7.3 5.95A9.97 9.97 0 0 1 10 5.55c5 0 7.75 4.45 7.75 4.45a12.2 12.2 0 0 1-2.4 2.7" />
      <path d="M5.05 7.2A12.15 12.15 0 0 0 2.25 10s2.75 4.45 7.75 4.45c.95 0 1.8-.16 2.56-.42" />
      <path d="m3 3 14 14" />
    </svg>
  );
}
