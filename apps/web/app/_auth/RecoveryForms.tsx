"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import * as auth from "../_api/auth";
import { useAuth } from "../_api/AuthProvider";
import { ApiError } from "../_api/types";

function errorMessage(error: unknown) { return error instanceof ApiError ? error.message : "Не удалось выполнить запрос. Попробуйте ещё раз."; }

export function ForgotPasswordForm() {
  const [email, setEmail] = useState(""); const [done, setDone] = useState(false); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setPending(true); setError(""); try { await auth.requestPasswordReset(email.trim()); setDone(true); } catch (e) { setError(errorMessage(e)); } finally { setPending(false); } }
  return <section className="auth-panel"><div className="auth-panel__heading"><h1>Сброс пароля</h1><p>Укажи email — отправим ссылку для нового пароля.</p></div>{done ? <p className="auth-form__success">Если аккаунт с таким адресом существует, инструкции уже отправлены.</p> : <form className="auth-form" onSubmit={submit}><label><span className="auth-field-label">Email</span><input autoComplete="email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>{error ? <p className="auth-form__error" role="alert">{error}</p> : null}<button disabled={pending} type="submit">{pending ? "Отправляем…" : "Отправить ссылку"}</button></form>}<p className="auth-panel__switch"><Link href="/login">Вернуться ко входу</Link></p></section>;
}

export function ResetPasswordForm() {
  const router = useRouter(); const params = useSearchParams(); const token = params.get("token") || ""; const [password, setPassword] = useState(""); const [repeat, setRepeat] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!token) { setError("Ссылка для сброса неполная."); return; } if (password.length < 8) { setError("Пароль должен содержать минимум 8 символов."); return; } if (password !== repeat) { setError("Пароли не совпадают."); return; } setPending(true); setError(""); try { await auth.confirmPasswordReset(token, password); router.replace("/login"); } catch (e) { setError(errorMessage(e)); setPending(false); } }
  return <section className="auth-panel"><div className="auth-panel__heading"><h1>Новый пароль</h1><p>После смены пароля остальные сессии будут завершены.</p></div><form className="auth-form" onSubmit={submit}><label><span className="auth-field-label">Новый пароль</span><input autoComplete="new-password" minLength={8} required type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><label><span className="auth-field-label">Повторите пароль</span><input autoComplete="new-password" minLength={8} required type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} /></label>{error ? <p className="auth-form__error" role="alert">{error}</p> : null}<button disabled={pending} type="submit">{pending ? "Сохраняем…" : "Сохранить пароль"}</button></form></section>;
}

export function VerifyEmailForm() {
	const router = useRouter(); const authContext = useAuth(); const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [notice, setNotice] = useState("Введите email и шестизначный код из письма."); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
	useEffect(() => { setEmail(window.sessionStorage.getItem("realgo:pending-verification-email") || ""); }, []);
	async function verify(event: React.FormEvent) { event.preventDefault(); setPending(true); setError(""); try { await authContext.completeEmailVerification(email.trim(), code); window.sessionStorage.removeItem("realgo:pending-verification-email"); router.replace("/onboarding/profile"); } catch (e) { setError(errorMessage(e)); setPending(false); } }
	async function resend() { if (!email.trim()) { setError("Сначала укажи email."); return; } setPending(true); setError(""); try { await auth.requestEmailVerification(email.trim()); setNotice("Новый код отправлен. Проверьте входящие и папку «Спам»."); } catch (e) { setError(errorMessage(e)); } finally { setPending(false); } }
	return <section className="auth-panel"><div className="auth-panel__heading"><h1>Подтверди email</h1><p>{notice}</p></div><form className="auth-form" onSubmit={verify}><label><span className="auth-field-label">Email</span><input autoComplete="email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label><span className="auth-field-label">Код из 6 цифр</span><input autoComplete="one-time-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>{error ? <p className="auth-form__error" role="alert">{error}</p> : null}<button disabled={pending || code.length !== 6 || !email.trim()} type="submit">Подтвердить email</button></form><p className="auth-panel__switch"><button className="auth-text-button" disabled={pending} onClick={resend} type="button">Отправить код ещё раз</button></p></section>;
}
