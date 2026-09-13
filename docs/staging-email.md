# Email on the test stand

`test.realgo.dev` sends transactional mail through the isolated route:

`ReAlgo API → mail-relay (private Docker network) → SMTP2GO → recipient`.

The relay authenticates to `mail.smtp2go.com:2525` with STARTTLS. The API does
not receive SMTP2GO credentials. The sender is `ReAlgo <noreply@realgo.dev>`
and replies go to `support@realgo.dev`.

Two flows are available on staging:

- `/forgot-password` sends a one-time, 30-minute reset link.
- New email/password registrations are held outside `users` until their
  six-digit code is entered at `/verify-email`; only then are the account and
  session created. The code expires after 10 minutes and is one-time.

For a safe external smoke test, register a fresh staging account using an
inbox you control, enter the received code, then use `/forgot-password` for
the same address. Inspect the staging `mail-relay` logs for
`relay_provider_accepted`; this proves SMTP2GO accepted the message without
logging a recipient, token, code, URL, or credentials.
