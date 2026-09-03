import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthPageHeader } from "../../../_auth/AuthPageHeader";
import { GithubCallbackClient } from "./GithubCallbackClient";

export const metadata: Metadata = { title: "Вход через GitHub" };

export default function GithubCallbackPage() {
  return (
    <>
      <AuthPageHeader />
      <Suspense fallback={<div className="auth-layer auth-layer--page" />}>
        <GithubCallbackClient />
      </Suspense>
    </>
  );
}
