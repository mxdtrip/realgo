import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthPageHeader } from "../_auth/AuthPageHeader";
import { ConfirmEmailPanel } from "./ConfirmEmailPanel";

export const metadata: Metadata = { title: "Подтверждение почты" };

export default function ConfirmEmailPage() {
  return (
    <>
      <AuthPageHeader />
      <div className="auth-layer auth-layer--page">
        <Suspense fallback={null}>
          <ConfirmEmailPanel />
        </Suspense>
      </div>
    </>
  );
}
