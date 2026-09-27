# F01 — Authentication

Status: implemented locally. Live Google verification requires OAuth configuration.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Objective and scope

Google sign-in is the gate in front of Editor and Releases. The account must
be a verified Google email with the exact domain `anywhere.co`. The header
shows Sign out, which clears the session and returns to sign-in. The session
also expires and then returns to sign-in.

## Acceptance criteria

- Unauthenticated users see sign-in; an authorized user reaches the shell.
- Server-verified identity and email verification are required. Missing/unverified
  email and other domains are rejected, including lookalike domains.
- A client email claim or Google hosted-domain hint cannot grant access.
- Protected server entry points independently enforce session authorization.
- The header shows Sign out. It clears the session and returns to sign-in.
  An expired session returns to sign-in. Canceled or failed sign-in offers a
  retry and does not grant access.
- Tokens stay server-side. Errors and logs do not disclose credentials.

## Proposed implementation boundaries

Routes remain under root `app/`; session/provider integration belongs in
`src/lib/auth/`. Choose the auth library and session persistence, callback URL,
cookie configuration, and expiry behavior before coding. Missing configuration
fails closed when auth is invoked. Sign-in requests `openid email profile`
only. Cloud Storage access is part of F10, and a successful login does not
grant it.

## Verification

Test allowed, unverified, missing, wrong-domain, and lookalike-domain identities;
unauthenticated protected requests; provider cancellation and session expiry.
Use mocked provider behavior for automated tests. Run lint, typecheck, build,
and relevant tests once the feature and test harness exist.

## Implemented decisions

Auth.js 5.0.0-beta.32 handles Google OIDC and encrypted cookie sessions. Sessions
have an eight-hour absolute lifetime. The server requires a verified exact-domain
Google email and discards provider tokens. Sign-in does not request Cloud
Storage access. `/sign-in` handles denial and retry; `/editor` is an
authenticated shell only. The header shows Sign out, which clears the session
and returns to `/sign-in`.
A reusable server authorization guard must be called by each future protected
operation. See the root README for environment setup, cookie/revocation limits,
verification commands, and the remaining live Google acceptance checklist.
