import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthPageHeader } from "../../../_auth/AuthPageHeader";
import { YandexCallbackClient } from "./YandexCallbackClient";

export const metadata: Metadata = { title: "Вход через Яндекс ID" };

export default function YandexCallbackPage() {
  return (
    <>
      <AuthPageHeader />
      <Suspense fallback={<div className="auth-layer auth-layer--page" />}>
        <YandexCallbackClient />
      </Suspense>
    </>
  );
}
