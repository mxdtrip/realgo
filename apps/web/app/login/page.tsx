import type { Metadata } from "next";

import { AuthForm } from "../_auth/AuthForm";
import { AuthPageShell } from "../_auth/AuthPageShell";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return (
    <AuthPageShell>
      <div className="auth-layer auth-layer--page">
        <AuthForm mode="login" />
      </div>
    </AuthPageShell>
  );
}
