import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthPageShell } from "../../../_auth/AuthPageShell";
import { YandexCallbackClient } from "./YandexCallbackClient";

export const metadata: Metadata = { title: "Вход через Яндекс ID" };

export default function YandexCallbackPage() {
  return (
    <AuthPageShell>
      <Suspense fallback={<div className="auth-layer auth-layer--page" />}>
        <YandexCallbackClient />
      </Suspense>
    </AuthPageShell>
  );
}
