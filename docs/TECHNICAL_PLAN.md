# Language Publisher — Technical Plan

Status: the Figma file is the source of truth for Editor and Releases. See [MVP.md](MVP.md). F15 is a specified product feature whose control is not in the current frames. F07 is not a control on the Editor. F08 is Add key on the Editor; the current frames do not show that button. F09 is not in the product.

## Source fidelity

The prior conversation described `Language_Publisher_TECHNICAL_PLAN.md`, but its
full contents were not available. Confirmed decisions: server-owned publishing,
Google authentication, GCS integration boundaries, original-versus-edited state,
SHA-256, version conflict checks, and language uploads before the manifest.
The operational details below are proposed safeguards and implementation
guidance, to be reconciled with the original plan and actual Android contract.

## Existing scaffold and folder ownership

The inspected project uses Next.js 16.3.6, React 19.2.8, TypeScript, Tailwind CSS 4,
and ESLint. Preserve its root `app/` directory and existing `@/*` → `./*` alias.
Future imports into the new folders therefore use `@/src/...`. Do not create a
competing `src/app/` or move routing during this milestone.

```text
app/                            App Router entry points
docs/                           Product, scope, architecture, feature specs
src/components/common/          Shared UI primitives, added as needed
src/components/publisher/       Catalog UI, added with F04
src/features/                   Working-set and build logic, added as needed
src/lib/auth/                   Google sign-in and the session guard
src/lib/gcs/                    Cloud Storage adapter, added with F10
src/server/                     Authorized database and publish orchestration
tests/unit/                     Vitest tests
```

Add a dependency only when the feature being implemented needs it. Read the
installed Next.js documentation under `node_modules/next/dist/docs/` before
writing framework code.

## Trust boundaries

The browser renders data and submits edit intent. Server entry points validate
the session and authorization for every protected operation, then call
`src/server/` orchestration. GCS access belongs in `src/lib/gcs/` when F10 adds
it. React components must not import it or receive storage credentials. Mark server-only integration
modules appropriately when they are implemented.

Google sign-in must validate provider identity and verified email server-side,
requiring the exact email domain `anywhere.co`. A hosted-domain hint is not the
authorization check. F15 then requires that email to be in the access table.
The role on that row is `admin` or `user`. Choose a maintained OAuth/session library compatible with
the installed Next.js version at F01. Apply its state/CSRF protections and secure
cookie/session handling. Discard provider access, refresh, and ID tokens.
Sign-in requests `openid email profile` only.

Cloud Storage writes belong to F10. Successful domain authentication does not
imply bucket permission. The publish contract, including new object names,
checksums, and manifest-last updates, is [F10](features/F10-publish.md).

## Working set

F02 owns the working-set schema. Later features write through server code. An empty
string is a stored value. The Editor lists All, iOS, or Android. Search, the
exact-match toggle, Filter, and Sort change which cards are shown and do not change
which rows a release includes. The browser cannot supply a checksum, object
path, or file body. F11 stores each release as language-file JSON for one
platform. Creating a release writes those language objects once and does not
change the manifest. Setting production, the Served control, updates only
that platform’s manifest so it points at the chosen release’s existing files.
F13 deletes checked keys from that platform’s working set and leaves releases
untouched. F14 serves the stored release JSON for download. F07 adds one
language to the platform on screen. F08 adds one key on the platform on screen. F15
keeps the access table and is specified in [F15](features/F15-access.md).

## Errors and user recovery

Distinguish sign-in required, access denied, invalid input, and storage failure.
Show actionable messages without credentials or internal provider payloads. A
failed Served update leaves the previous production release in place.

## Environment configuration

`.env.example` contains proposed server-side configuration names only. The
foundation reads none of them and requires no credentials to lint or build.
When implementing integrations, reconcile names with the chosen libraries, then
copy the template to an ignored `.env.local` at the project root.

| Variable | Planned purpose |
| --- | --- |
| APP_URL | Local/deployed application origin; callback path chosen at F01 |
| GOOGLE_CLIENT_ID | Google OAuth application identifier |
| GOOGLE_CLIENT_SECRET | Google OAuth application secret |
| AUTH_SECRET | Session signing/encryption secret; adapt to chosen auth library |
| AUTH_ALLOWED_DOMAIN | Intended exact domain restriction, initially anywhere.co |
| AUTH_ADMIN_EMAILS | Comma-separated verified anywhere.co emails kept as admins by F15. |
| GCS_BUCKET | Cloud Storage bucket name used when publishing. Credentials stay outside this file. |
Do not add `NEXT_PUBLIC_` to secrets or expose Google tokens to client JavaScript.
Do not store service-account JSON or access tokens in the example file. Bucket
settings return with F10. OAuth callback, session storage, and deployment remain
unconfigured; there are no production defaults.

## Verification and milestones

F01–F10 are implemented. Finish a change with the checks below, including
end-to-end tests when the editor flow changes.

Available commands:

```sh
npm test
npm run test:e2e
npm run lint
npm run build
./node_modules/.bin/tsc --noEmit --incremental false
```

The starter layout uses `next/font/google`; its build may require network access
to fetch fonts. Record environmental failures rather than changing the scaffold
solely to obtain a passing check. Run type checking after generated Next.js types
are available. There is no `typecheck` package script. Add tests with the
feature they cover. End-to-end coverage returns when a feature needs it.
