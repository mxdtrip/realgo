# ReAlgo email architecture

## Two separate mail paths

```text
Human mail
Internet <-> Stalwart (mail.realgo.dev) <-> @realgo.dev mailboxes

Transactional mail
ReAlgo API (vpngw namespace) -> internal mail-relay -> SMTP2GO -> recipient
```

Stalwart remains the domain mailbox server. It owns `mail.realgo.dev`, IMAP,
JMAP and normal mailbox delivery. The application does not use Gmail SMTP and
does not change the domain MX route.

The API shares the VPN gateway network namespace for AI traffic, where direct
external SMTP has been unreliable. It therefore reaches only the private
`mail-relay:2526` service. The relay is on the normal Docker network and makes
the authenticated, TLS-protected connection to SMTP2GO.

## Transactional configuration

The API variables describe its private hop:

```text
MAIL_ENABLED=true
MAIL_SMTP_HOST=mail-relay
MAIL_SMTP_PORT=2526
MAIL_SMTP_TLS_MODE=none
MAIL_BASE_URL=https://realgo.dev
```

The production workflow supplies these relay-only variables from GitHub
Secrets; do not place their values in `.env`, source control or logs:

```text
SMTP2GO_SMTP_USERNAME
SMTP2GO_SMTP_PASSWORD
SMTP2GO_SMTP_HOST=mail.smtp2go.com
SMTP2GO_SMTP_PORT=2525
SMTP2GO_SMTP_TLS_MODE=starttls
```

`SMTP2GO_SMTP_PORT` is configurable. Use a different SMTP2GO-supported port
only when the selected environment cannot reach 2525, and retain a matching
TLS mode. The application sends with `From: ReAlgo <noreply@realgo.dev>` and
`Reply-To: support@realgo.dev`.

## Password reset smoke test

Use a registered mailbox that belongs to the operator. Submit the forgot
password form, open the resulting HTTPS `realgo.dev/reset-password?token=...`
link, set a new password, then verify that the old password is rejected and
the new one works. Do not paste the reset URL or token into tickets or logs.

Provider acceptance is visible in the relay log as
`relay_provider_accepted`; the API records `password_reset_email_sent`. A provider
acceptance confirms handoff to SMTP2GO, not final inbox placement. Failures are
logged without the recipient address, reset token, reset URL or SMTP secret.

## Diagnostics and deliverability

On appbox, inspect the API and relay containers after a test:

```sh
docker logs freeburger-api-1 --since 10m | grep -E 'password reset|email'
docker logs freeburger-mail-relay-1 --since 10m
```

The relay classifies provider failures as temporary, permanent,
configuration/authentication, or transport errors. It retries an explicit SMTP
4xx once and never retries an ambiguous post-DATA connection failure.

For a delivered test message, inspect the received headers: SPF, DKIM and
DMARC should all be `PASS`. SMTP2GO's sender-domain panel must show
`realgo.dev` as verified and its issued DKIM/return-path records must remain
present. Do not add another SPF TXT record; DNS is managed separately from this
repository.
