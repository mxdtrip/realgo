import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthPageHeader } from "../_auth/AuthPageHeader";
import { ResetPasswordPanel } from "./ResetPasswordPanel";

export const metadata: Metadata = { title: "Восстановление пароля" };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthPageHeader />
      <div className="auth-layer auth-layer--page">
        <Suspense fallback={null}>
          <ResetPasswordPanel />
        </Suspense>
      </div>
    </>
  );
}
