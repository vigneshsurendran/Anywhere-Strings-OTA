# F01 — Authentication

Status: specification only. First feature after Milestone 0.
Read [MVP](../MVP.md) and [technical plan](../TECHNICAL_PLAN.md) first.
This spec expands requirements recovered from the prior conversation; details
marked proposed must be reconciled with the original documents when available.

## Objective and scope

Provide Google sign-in, access denial, sign-out, and a minimal authenticated
editor shell. Require a verified Google email with exact domain `anywhere.co`.
Do not load GCS data or implement translation editing/publishing in this feature.

## Acceptance criteria

- Unauthenticated users see sign-in; an authorized user reaches the shell.
- Server-verified identity and email verification are required. Missing/unverified
  email and other domains are rejected, including lookalike domains.
- A client email claim or Google hosted-domain hint cannot grant access.
- Protected server entry points independently enforce session authorization.
- Sign-out invalidates the application session; canceled/failed sign-in offers
  a safe retry without granting access.
- Tokens stay server-side. Errors and logs do not disclose credentials.

## Proposed implementation boundaries

Routes remain under root `app/`; session/provider integration belongs in
`src/lib/auth/`. Choose the auth library and session persistence, callback URL,
cookie configuration, and expiry behavior before coding. Missing configuration
fails closed when auth is invoked. F02 will determine GCS scopes/consent needs;
F01 must not pretend successful login proves bucket access.

## Verification

Test allowed, unverified, missing, wrong-domain, and lookalike-domain identities;
unauthenticated protected requests; sign-out; provider cancellation and expiry.
Use mocked provider behavior for automated tests. Run lint, typecheck, build,
and relevant tests once the feature and test harness exist.
