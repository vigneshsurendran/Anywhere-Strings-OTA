# Anywhere String OTA

Internal app for Android and iOS strings. An authorized user can import, view,
edit, search, and delete keys, then create a release, download it, and choose
which release is served. The working set stays in SQLite (`data/publisher.sqlite`,
ignored by Git). Serving updates that platform’s manifest in Cloud Storage.

See [PRD](docs/PRD.md).

## Run locally

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` (ignored by Git).
3. Create a Google OAuth **Web application** client and configure its consent
   screen for the intended users. For local development, add the exact authorized
   redirect URI `http://localhost:3000/api/auth/callback/google`.
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `AUTH_URL` in `.env.local`.
   `AUTH_URL` is the app origin, without a path, query, or credentials.
5. Generate `AUTH_SECRET` with `openssl rand -base64 32` and set it in `.env.local`.
   Use the same secret across instances; changing it invalidates existing cookies.
6. For local sign-in with a personal Google account, set
   `AUTH_ALLOW_ANY_VERIFIED_EMAIL=true` in `.env.local`. That flag is ignored in
   production. Add the same personal address as a Google OAuth **test user**.
7. Set `GCS_BUCKET` to the Cloud Storage bucket used for publish. The process
   needs Application Default Credentials with permission to create objects in
   that bucket. Do not commit a service-account key.
8. Set `AUTH_ADMIN_EMAILS` to the verified @anywhere.co addresses that should
   stay admins. Other accounts can sign in only after an admin adds them on
   Access. AI translation uses the same Application Default Credentials when
   `GOOGLE_CLOUD_PROJECT` is set; otherwise a new language stays in English.
9. Run `npm run dev` and open http://localhost:3000.

Without valid configuration the sign-in page explains that setup is needed,
authentication endpoints return 503, and the shell remains inaccessible.
Do not commit real environment files or credentials.

For production, set `AUTH_URL` to the HTTPS origin and register
`https://YOUR_HOST/api/auth/callback/google` in Google. Production requires HTTPS;
`next start` on HTTP localhost is not a supported production auth deployment.
Ensure the hosting proxy rejects unexpected Host/forwarded-host values. No
`NEXT_PUBLIC_` secrets are needed. `APP_URL` and `AUTH_ALLOWED_DOMAIN` from the
foundation template are no longer used.

## Authentication decisions

- Auth.js `next-auth@5.0.0-beta.32` is pinned for the Next.js App Router and async
  request APIs. It is a prerelease; review updates before deployment. See the
  [official setup guide](https://authjs.dev/getting-started/installation).
- Google OpenID Connect uses `openid email profile`, with PKCE, state, nonce,
  library CSRF protection, and server-side authorization. Email must be verified
  by Google and have the exact `anywhere.co` domain (case-insensitive), unless
  the local `AUTH_ALLOW_ANY_VERIFIED_EMAIL` flag is set. Hosted domain hints,
  browser claims, and lookalike domains cannot grant access. Sign-in does not
  request Cloud Storage access.
- Sessions use Auth.js encrypted HttpOnly, SameSite=Lax cookies, Secure on HTTPS.
  They survive refresh and expire **eight hours after sign-in**, even if read or
  refreshed. Provider tokens are discarded.
- Sign-out clears the current browser's application cookie. Stateless sessions
  do not provide central revocation of copied cookies or other devices; those
  expire at the fixed deadline. Signing out does not sign out of Google.
- `/editor` calls `requireAuthorizedUser()` server-side on each render. Future
  protected server actions, route handlers, and data operations must call this
  guard independently, mapping `AuthorizationError.status` to 401/403 as needed.
  No layout-only or client-only authorization is relied on.
- Provider failures use fixed messages; logs include only Auth.js error types,
  never raw errors or token payloads. A denied account can choose another account.

## Verification

```sh
npm test
npm run test:e2e
npm run lint
npm run build
./node_modules/.bin/tsc --noEmit --incremental false
```

`npm test` runs Vitest unit tests and UI component tests. `npm run test:e2e`
starts the app and runs Playwright against Chromium. End-to-end publish uses
an in-memory storage double (`PUBLISHER_STORAGE=memory`), which is refused in
production. Install the browser once with `npx playwright install chromium`.
The starter's Google fonts are preserved, so builds need font-download access.

Before deployment, use configured Google credentials to verify:

- A verified Anywhere account reaches `/editor`, including after refresh.
- A personal/non-Anywhere account sees access denied and can retry.
- Canceling Google consent displays a retry message.
- A private window opening `/editor` redirects to sign-in.
- Sign-out followed by refresh/direct `/editor` access requires sign-in.
- Session JSON and browser storage contain no Google provider tokens.

Feature specifications: [MVP](docs/MVP.md), [technical plan](docs/TECHNICAL_PLAN.md),
and `docs/features/`.
