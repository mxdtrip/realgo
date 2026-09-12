// Internal, server-to-server endpoint the Go API calls to trigger a
// confirm-email send. Not part of the public API surface: Caddy routes every
// public /api/* request to the Go service (see app/_api/client.ts), and this
// container publishes no host port at all (docker-compose `expose: 3000`
// only) — the api container reaches this route directly over the compose
// network at MAILER_WEB_INTERNAL_URL. The shared-secret header is defense in
// depth on top of that network isolation.
//
// SMTP credentials live only here (see .env.example): the Go API never sees
// them, it only asks this route to send.

import { NextResponse } from "next/server";

import { buildConfirmEmail } from "../../../../emails/confirm-email";
import { internalSecretMatches, sendMail } from "../_shared/mailer";

export const runtime = "nodejs";

type SendVerificationEmailRequest = {
  to?: unknown;
  url?: unknown;
  expires_in_minutes?: unknown;
};

export async function POST(request: Request) {
  if (!internalSecretMatches(request.headers.get("x-internal-secret"))) {
    return NextResponse.json({ error: { code: "unauthorized", message: "unauthorized" } }, { status: 401 });
  }

  let body: SendVerificationEmailRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_request", message: "invalid JSON body" } }, { status: 400 });
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const confirmURL = typeof body.url === "string" ? body.url.trim() : "";
  const expiresInMinutes = typeof body.expires_in_minutes === "number" ? body.expires_in_minutes : 60;
  if (!to || !confirmURL) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "to and url are required" } },
      { status: 400 },
    );
  }

  const { subject, html, text } = buildConfirmEmail({ confirmURL, expiresInMinutes });
  try {
    const result = await sendMail({ to, subject, html, text, logContext: "send-verification-email" });
    return NextResponse.json(result);
  } catch (err) {
    console.error("send-verification-email: send failed", err);
    return NextResponse.json({ error: { code: "send_failed", message: "failed to send email" } }, { status: 502 });
  }
}
