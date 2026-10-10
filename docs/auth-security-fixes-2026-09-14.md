# Auth security fixes — 2026-09-14

Scope: A02, A03, A04, A05, A06, A08, A09, A10, A13, A14, A15, A16, A17, A19, A20.

| Finding | Implementation and regression coverage |
| --- | --- |
| A02 | All public registration paths return 202 with a browser challenge. User and session are created together only after code confirmation. The old immediate-registration service method was removed. Production forms and acceptance drivers use the same pending → verify flow. |
| A03 | Ignore RFC Forwarded. Walk X-Forwarded-For from the trusted socket peer, stopping at the nearest untrusted address. Strip Forwarded at the internal proxy. |
| A04 | Separate pending row per cryptographically random challenge. Confirmation requires email, code and browser challenge; resending cannot change another attempt. |
| A05 | Access JWT identifies an authoritative PostgreSQL session. Every protected request checks that session. Logout/revoke/reset invalidate access and refresh; creating a device session requires both a live access and its current refresh under the user lock. |
| A06 | Password changes atomically delete sessions and invalidate all unused reset credentials with a database trigger, independently of Redis availability. Competing password changes compare the original hash. |
| A08 | Reset INSERT never silently ignores conflicts. Concurrent requests each persist their own random token. Consuming one reset invalidates siblings under a user lock. |
| A09 | Reset and registration requests enqueue work without checking account existence in the HTTP path. Registration performs the same bcrypt operation for every valid request. Duplicate registration has the same 202 contract and no email_taken signal. |
| A10 | PostgreSQL mail jobs survive restarts. Payloads are AES-GCM encrypted with a domain-separated server key; credentials and rendered message are persisted in one transaction. A leased job retries the same credential after SMTP failure. The UI says the request is accepted, not that delivery already occurred. Disabled mail returns 503 for every address. |
| A13 | New reset links use fragments. The form accepts legacy query links, immediately removes the credential from browser history, and retains it only in memory. Service worker v4 deletes old caches and excludes auth documents, query URLs and no-store responses. Auth responses and pages use no-store / no-referrer. |
| A14 | Capture the session selector before each request; reject stale responses and retries if it changes before or after refresh. Both fetch variants have an adversarial A→B regression. |
| A15 | Web access is memory-only; refresh uses host-only Secure/HttpOnly/SameSite=Strict cookies. Session-specific cookie names prevent late A responses replacing B credentials. Browser cookie endpoints require an exact Origin and custom header; native clients never fall back to cookies. Strict per-response nonce CSP blocks injected scripts. The public editable sorting worker retains eval only on `/`; auth/cabinet pages prohibit it. |
| A16 | Require expiration, issued-at, issuer, audience, a session ID and a positive numeric subject, plus session state. Negative claim tests cover each requirement. |
| A17 | Auth HTTP logs contain fixed failure classes and hashed email, not raw JSON/SMTP/provider errors or full email. Retry logs contain only job IDs, kind and attempt count. API/relay Docker logs rotate at 10 MB × 3. |
| A19 | A dedicated internal API↔relay network and separate relay egress network replace broad shared submission access. Relay resolves only the configured API/network-namespace peer, enforces sender headers, one recipient, bounded connections, stream byte limits, TLS certificate verification and bounded transport timeouts. Socket-level tests verify rejection paths. |
| A20 | Deploy jobs depend on the complete reusable CI workflow for their checked-out commit, including API/acceptance/integration, web build/e2e, extension and relay checks. Fixtures follow pending → verification and cookie sessions. |

## Release behavior

- All previous sessions must log in again. Existing users and learning data are retained. Legacy pending registrations must restart because they lack a browser challenge.
- Web localStorage contains a non-secret session selector only. Refresh credentials are never included in browser auth JSON. The extension uses its own login instead of importing website credentials; the extension source/build is updated.
- SMTP delivery is at-least-once: provider acceptance followed by a process crash can duplicate the same message. Jobs retry within a bounded lifetime; successful and expired jobs are removed. Queue encryption depends on the server signing key remaining stable; drain queued mail before key rotation.
- For local cookie auth, set MAIL_BASE_URL to the exact browser origin (for example http://localhost:3000); cross-origin requests require credentials and the two X-Realgo headers. Production uses https://realgo.dev and staging https://staging.realgo.dev.
- API availability now includes a session lookup in PostgreSQL. Storage failures fail closed without treating a transient outage as credential revocation.
- Do not roll back to the vulnerable auth implementation. Use a forward fix; old Redis credentials are not an authority in the new version.

## Separate migration histories

Staging applies 000039 to its existing 000038 schema. Production keeps its own 000033 reset migration and adds the compatible 000035–000039 auth prerequisites. No production screenshot/attachment migration or admin UI is imported. Generated queries are built independently against each branch's schema. Do not merge the two historical migrations numbered 000033 blindly.

## Public edge verification (2026-09-16)

Browser checks on both public domains confirm that the nonce CSP reaches Chromium and blocks parser-inserted scripts without a nonce. Reset URLs are scrubbed and auth documents use no-store. The edge adds its older CSP and Referrer-Policy values alongside upstream headers; it does not remove the upstream strict policy. The final Referrer-Policy value is no-referrer. A prepared Caddy fallback/no-referrer patch removes the redundant policies but is optional cleanup and has not been applied to the system service.

## Later staging exception

PR #108 subsequently introduced immediate registration for non-production environments. This intentional exception bypasses verification on test/local and makes new/existing addresses distinguishable (A09 registration remains an exception on test). Production retains the full verified registration contract. The immediate browser path must use the same HttpOnly cookie serializer as login/verified registration; the regression test TestSecurityUnverifiedRegistrationUsesBrowserCookie protects this requirement.

## Validation

Local coverage includes full Go/acceptance tests, security integration on disposable PostgreSQL/Redis, strict claim tests, A→B retry tests, browser registration/cookie/CSP/cache tests, web typecheck/build/e2e, extension typecheck/build, relay socket tests and Compose/Caddy validation. CI and deployment results are recorded in the PRs.

Reference behavior: [Next.js nonce CSP](https://nextjs.org/docs/app/guides/content-security-policy), [smtp-server DATA size handling](https://nodemailer.com/extras/smtp-server).
