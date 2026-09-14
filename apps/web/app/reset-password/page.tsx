import type { Metadata } from "next";
import { AuthPageHeader } from "../_auth/AuthPageHeader";
import { ResetPasswordForm } from "../_auth/RecoveryForms";
export const metadata: Metadata = { title: "Новый пароль" };
export default function Page() { return <><AuthPageHeader /><div className="auth-layer auth-layer--page"><ResetPasswordForm /></div></>; }
