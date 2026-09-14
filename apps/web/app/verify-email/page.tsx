import type { Metadata } from "next";
import { AuthPageHeader } from "../_auth/AuthPageHeader";
import { VerifyEmailForm } from "../_auth/RecoveryForms";
export const metadata: Metadata = { title: "Подтверждение email" };
export default function Page() { return <><AuthPageHeader /><div className="auth-layer auth-layer--page"><VerifyEmailForm /></div></>; }
