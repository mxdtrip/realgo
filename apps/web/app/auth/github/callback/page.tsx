import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthPageShell } from "../../../_auth/AuthPageShell";
import { GithubCallbackClient } from "./GithubCallbackClient";

export const metadata: Metadata = { title: "Вход через GitHub" };

export default function GithubCallbackPage() {
  return (
    <AuthPageShell>
      <Suspense fallback={<div className="auth-layer auth-layer--page" />}>
        <GithubCallbackClient />
      </Suspense>
    </AuthPageShell>
  );
}
