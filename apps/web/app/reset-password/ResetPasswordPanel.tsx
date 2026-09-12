"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useAuth } from "../_api/AuthProvider";
import { ApiError } from "../_api/types";

export function ResetPasswordPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();

  const id = searchParams.get("id");
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // Distinct from a validation error: the link itself is dead, so the form
  // is pointless — swap it for a message instead of leaving it up to fail
  // again on every retry.
  const [linkInvalid, setLinkInvalid] = useState(false);

  if (!id || !token || linkInvalid) {
    return (
      <section aria-label="Восстановление пароля" className="auth-panel">
        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>
          Ссылка недействительна или истекла. Попробуйте ещё раз.
        </p>
        <Link href="/login">Вернуться ко входу</Link>
      </section>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    setPending(true);
    setError("");
    try {
      const user = await auth.resetPassword(id!, token!, password);
      router.push(user.onboarding_completed ? "/dashboard" : "/onboarding/profile");
    } catch (e) {
      if (e instanceof ApiError && e.code === "password_reset_invalid") {
        setLinkInvalid(true);
        return;
      }
      setError(e instanceof ApiError ? e.message : "Что-то пошло не так. Попробуйте ещё раз.");
      setPending(false);
    }
  }

  return (
    <section aria-label="Восстановление пароля" className="auth-panel">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Новый пароль
          <input
            autoComplete="new-password"
            placeholder="минимум 8 символов"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
        </label>
        <label>
          Повторите пароль
          <input
            autoComplete="new-password"
            placeholder="••••••••"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={pending}
          />
        </label>

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <button disabled={pending} type="submit">
          {pending ? "Сохраняем…" : "Установить новый пароль"}
        </button>
      </form>
    </section>
  );
}
