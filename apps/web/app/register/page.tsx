import type { Metadata } from "next";

import { AuthForm } from "../_auth/AuthForm";
import { AuthPageShell } from "../_auth/AuthPageShell";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <AuthPageShell>
      <div className="auth-layer auth-layer--page">
        <AuthForm mode="register" />
      </div>
    </AuthPageShell>
  );
}
