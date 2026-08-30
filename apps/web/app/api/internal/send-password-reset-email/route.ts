// Internal, server-to-server endpoint the Go API calls to trigger a
// password-reset send. Same shape and trust model as
// ../send-verification-email/route.ts — see that file for the details.

import { NextResponse } from "next/server";

import { buildResetPasswordEmail } from "../../../../emails/reset-password";
import { internalSecretMatches, sendMail } from "../_shared/mailer";

export const runtime = "nodejs";

type SendPasswordResetEmailRequest = {
  to?: unknown;
  url?: unknown;
  expires_in_minutes?: unknown;
};

export async function POST(request: Request) {
  if (!internalSecretMatches(request.headers.get("x-internal-secret"))) {
    return NextResponse.json({ error: { code: "unauthorized", message: "unauthorized" } }, { status: 401 });
  }

  let body: SendPasswordResetEmailRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_request", message: "invalid JSON body" } }, { status: 400 });
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const resetURL = typeof body.url === "string" ? body.url.trim() : "";
  const expiresInMinutes = typeof body.expires_in_minutes === "number" ? body.expires_in_minutes : 60;
  if (!to || !resetURL) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "to and url are required" } },
      { status: 400 },
    );
  }

  const { subject, html, text } = buildResetPasswordEmail({ resetURL, expiresInMinutes });
  try {
    const result = await sendMail({ to, subject, html, text, logContext: "send-password-reset-email" });
    return NextResponse.json(result);
  } catch (err) {
    console.error("send-password-reset-email: send failed", err);
    return NextResponse.json({ error: { code: "send_failed", message: "failed to send email" } }, { status: 502 });
  }
}
