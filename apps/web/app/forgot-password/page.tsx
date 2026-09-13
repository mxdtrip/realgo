import type { Metadata } from "next";
import { AuthPageShell } from "../_auth/AuthPageShell";
import { ForgotPasswordForm } from "../_auth/RecoveryForms";
export const metadata: Metadata = { title: "Сброс пароля" };
export default function Page() { return <AuthPageShell><div className="auth-layer auth-layer--page"><ForgotPasswordForm /></div></AuthPageShell>; }
