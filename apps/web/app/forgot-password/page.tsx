import type { Metadata } from "next";
import { AuthPageHeader } from "../_auth/AuthPageHeader";
import { ForgotPasswordForm } from "../_auth/RecoveryForms";
export const metadata: Metadata = { title: "Сброс пароля" };
export default function Page() { return <><AuthPageHeader /><div className="auth-layer auth-layer--page"><ForgotPasswordForm /></div></>; }
