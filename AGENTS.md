# Anywhere String OTA — Agent Instructions

## Project and current milestone

Internal web application for publishing Android and iOS language files to
Google Cloud Storage. The product name is Anywhere String OTA. The Figma file `Language Publisher`
(`2pvck0cpz7yrMN87e9ANfB`) is the source of truth for the Editor and Releases
frames. F15 adds Access, and F08 adds Add key. Those frames do not show
either control; follow their feature specs. The Editor platform menu is All,
iOS, or Android, and All is the default. Search includes an exact-match
toggle and a case-sensitive Aa toggle, and Filter and Sort sit beside Select all. There is no supported-language
chip row. Live Google sign-in and a real bucket manifest still need
credentials. Do not add any other screen or control that is not in that file.

## Before making changes

Read `docs/MVP.md`, `docs/TECHNICAL_PLAN.md`, and the relevant file under
`docs/features/`. Consult `docs/PRD.md` for product context and provenance.
These documents were reconstructed from partial conversation history; do not
treat unresolved schemas or proposed details as confirmed production contracts.
Inspect the existing code and installed Next.js guides before modifying it.

## Architecture and scope

- Preserve the root `app/` and `@/*` → `./*` alias. New modules live under `src/`
  and can be imported as `@/src/...`; do not create a competing `src/app/`.
- Existing stack: Next.js, React, TypeScript, Tailwind CSS, ESLint, Auth.js,
  Vitest. Add SQLite with F02 and Cloud Storage with F10. Install only as needed.
- Keep auth integration in `src/lib/auth/`. Database access belongs in server
  code. GCS access returns in `src/lib/gcs/` at F10, with orchestration in
  `src/server/`. No direct GCS access from React UI.
- Authenticate and authorize protected server operations independently of the UI.
- Google sign-in requests `openid email profile` only. Cloud Storage consent is
  part of F10.
- The database is the working set. A release freezes that platform’s saved
  strings. Setting production updates only that platform’s manifest. Never
  trust a browser-provided checksum, storage path, or file body.
- Do not hardcode or commit secrets, expose service-account keys or provider tokens
  to client JavaScript, or log credentials. Keep real environment files ignored.

F01 is Google sign-in. The Editor screen is F03 import, F04 show, F05 edit,
F06 search, F13 delete, and F16 supported languages. Add language opens the
F16 dialog. F08 is Add key on the platform on screen. F07 is not a control on the Editor. The Releases screen is F11 create and serve, and F14 download.
Access is F15. F09 is not in the product. F10 is the manifest file contract used
when a release is served. F16 adds a catalog language to both platforms.
Still excluded: automatic translation, placeholder validation, and advanced
conflict merging.

## Workflow and verification

Explain the implementation approach, implement only the requested scope, review
the diff, and report unresolved assumptions and risks. Run:

```sh
npm run lint
npm run build
./node_modules/.bin/tsc --noEmit --incremental false
```

Run relevant unit/E2E tests when available. There is no test or typecheck package
script yet; do not claim empty test folders provide coverage. Add meaningful tests
alongside behavior, not placeholder assertions. Report environment failures
accurately; do not alter the starter app just to mask a build-network problem.

When a requested feature is complete and those checks pass, commit that feature
before starting the next one. Keep the commit to that feature: no secrets,
environment files, or unrelated changes. If the diff contradicts
`docs/TECHNICAL_PLAN.md` or locks a decision the plan still leaves open, stop
and ask instead of committing.

Retain the generated Next.js guidance below.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
