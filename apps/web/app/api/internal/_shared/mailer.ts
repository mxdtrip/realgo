// Shared plumbing for the internal send-* routes: the SMTP transport, the
// shared-secret check that authenticates the api container's server-to-server
// call, and the actual send. See send-verification-email/route.ts for why
// these routes exist and why the secret is defense in depth rather than the
// only guard.

import { timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function transport() {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    // 465 is implicit TLS; every other port (587, 25) starts plain and
    // upgrades via STARTTLS, which nodemailer does automatically here.
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return cachedTransport;
}

/** Constant-time comparison against INTERNAL_MAIL_SECRET. */
export function internalSecretMatches(provided: string | null): boolean {
  const expected = process.env.INTERNAL_MAIL_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type SendResult = { status: "sent" | "skipped" };

/**
 * Sends one email, or logs and skips when SMTP_HOST isn't configured (local
 * dev without SMTP set up — mirrors the api-side mailer's own noop fallback).
 * Throws on a genuine send failure; callers turn that into a 502.
 */
export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  logContext: string;
}): Promise<SendResult> {
  if (!process.env.SMTP_HOST) {
    console.warn(`${params.logContext}: SMTP_HOST is not set, skipping send`, { to: params.to });
    return { status: "skipped" };
  }

  await transport().sendMail({
    to: params.to,
    from: process.env.SMTP_FROM || "ReAlgo <no-reply@realgo.dev>",
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
  return { status: "sent" };
}
