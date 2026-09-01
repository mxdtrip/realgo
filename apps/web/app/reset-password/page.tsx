"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { confirmPasswordReset } from "../_api/auth";
import { ApiError } from "../_api/types";
import { AuthPageHeader } from "../_auth/AuthPageHeader";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError("Пароль должен содержать минимум 8 символов.");
      return;
    }
    if (password !== confirmation) {
      setError("Пароли не совпадают.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await confirmPasswordReset(token, password);
      setDone(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Не удалось сменить пароль.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <AuthPageHeader />
      <div className="auth-layer auth-layer--page">
        <section aria-label="Смена пароля" className="auth-panel">
          <div className="auth-tabs">
            <a className="active" href="/reset-password">
              Новый пароль
            </a>
            <a href="/login">Вход</a>
          </div>
          {done ? (
            <div className="auth-form">
              <h1>Пароль изменён</h1>
              <p role="status">Теперь можно войти с новым паролем.</p>
              <a href="/login">Войти в ReAlgo</a>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              <h1>Создать новый пароль</h1>
              <p>{token ? "Ссылка одноразовая и действует ограниченное время." : "Ссылка недействительна или отсутствует."}</p>
              <label>
                Новый пароль
                <input
                  autoComplete="new-password"
                  disabled={pending || !token}
                  minLength={MIN_PASSWORD_LENGTH}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <label>
                Повторите пароль
                <input
                  autoComplete="new-password"
                  disabled={pending || !token}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  type="password"
                  value={confirmation}
                />
              </label>
              {error ? (
                <p className="auth-form__error" role="alert">
                  {error}
                </p>
              ) : null}
              <button disabled={pending || !token} type="submit">
                {pending ? "Сохраняем…" : "Сменить пароль"}
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
