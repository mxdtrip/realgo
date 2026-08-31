"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { requestPasswordReset } from "../_api/auth";
import { ApiError } from "../_api/types";
import { AuthPageHeader } from "../_auth/AuthPageHeader";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await requestPasswordReset(email.trim());
      setDone(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Не удалось отправить запрос.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <AuthPageHeader />
      <div className="auth-layer auth-layer--page">
        <section aria-label="Восстановление пароля" className="auth-panel">
          <div className="auth-tabs">
            <a href="/login">Вход</a>
            <a className="active" href="/forgot-password">
              Восстановление
            </a>
          </div>
          {done ? (
            <div className="auth-form">
              <h1>Проверьте почту</h1>
              <p role="status">
                Если аккаунт с таким адресом существует, мы отправили ссылку для смены пароля
                с адреса support@realgo.dev.
              </p>
              <a href="/login">Вернуться ко входу</a>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              <h1>Забыли пароль?</h1>
              <p>Укажите email аккаунта — мы отправим одноразовую ссылку.</p>
              <label>
                Email
                <input
                  autoComplete="email"
                  disabled={pending}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              {error ? (
                <p className="auth-form__error" role="alert">
                  {error}
                </p>
              ) : null}
              <button disabled={pending} type="submit">
                {pending ? "Отправляем…" : "Отправить ссылку"}
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
