import type { Metadata } from "next";
import { AuthPageShell } from "../_auth/AuthPageShell";
import { VerifyEmailForm } from "../_auth/RecoveryForms";
export const metadata: Metadata = { title: "Подтверждение email" };
export default function Page() { return <AuthPageShell><div className="auth-layer auth-layer--page"><VerifyEmailForm /></div></AuthPageShell>; }
