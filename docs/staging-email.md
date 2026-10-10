# Email on the test stand

`staging.realgo.dev` sends transactional mail through the isolated route:

`ReAlgo API → mail-relay (private Docker network) → SMTP2GO → recipient`.

The relay authenticates to `mail.smtp2go.com:2525` with STARTTLS. The API does
not receive SMTP2GO credentials. The sender is `ReAlgo <noreply@realgo.dev>`
and replies go to `support@realgo.dev`.

The default staging profile uses `APP_ENV=staging`, so a new email/password
account is created immediately without a confirmation message. This keeps the
test stand non-production as intended. Password reset remains available:

- `/forgot-password` sends a one-time, 30-minute reset link.

For a safe external smoke test, register a fresh staging account using an
inbox you control, then use `/forgot-password` for the same address. Inspect
the staging `mail-relay` logs for
`relay_provider_accepted`; this proves SMTP2GO accepted the message without
logging a recipient, token, code, URL, or credentials.
