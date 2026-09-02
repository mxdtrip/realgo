import type { Metadata } from "next";

import { AuthForm } from "../_auth/AuthForm";
import { AuthPageHeader } from "../_auth/AuthPageHeader";

export const metadata: Metadata = { title: "Регистрация", robots: { index: false, follow: true } };

export default function RegisterPage() {
  return (
    <>
      <AuthPageHeader />
      <div className="auth-layer auth-layer--page">
        <AuthForm mode="register" />
      </div>
    </>
  );
}
