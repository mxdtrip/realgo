import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageShell } from "../_auth/AuthPageShell";
import { ResetPasswordForm } from "../_auth/RecoveryForms";
export const metadata: Metadata = { title: "Новый пароль" };
export default function Page() { return <AuthPageShell><div className="auth-layer auth-layer--page"><Suspense><ResetPasswordForm /></Suspense></div></AuthPageShell>; }
