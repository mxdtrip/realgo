import type { Metadata } from "next";

import { AuthForm } from "../_auth/AuthForm";
import { AuthPageHeader } from "../_auth/AuthPageHeader";

export const metadata: Metadata = { title: "Вход", robots: { index: false, follow: true } };

export default function LoginPage() {
  return (
    <>
      <AuthPageHeader />
      <div className="auth-layer auth-layer--page">
        <AuthForm mode="login" />
      </div>
    </>
  );
}
