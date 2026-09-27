# Language Publisher — Agent Instructions

## Project and current milestone

Internal web application for publishing Android OTA language files to Google
Cloud Storage. Milestone 0 contains documentation and folder placeholders only.
Do not implement product features until requested. Implement one requested
feature at a time; F01 authentication comes first.

## Before making changes

Read `docs/MVP.md`, `docs/TECHNICAL_PLAN.md`, and the relevant file under
`docs/features/`. Consult `docs/PRD.md` for product context and provenance.
These documents were reconstructed from partial conversation history; do not
treat unresolved schemas or proposed details as confirmed production contracts.
Inspect the existing code and installed Next.js guides before modifying it.

## Architecture and scope

- Preserve the root `app/` and `@/*` → `./*` alias. New modules live under `src/`
  and can be imported as `@/src/...`; do not create a competing `src/app/`.
- Existing stack: Next.js, React, TypeScript, Tailwind CSS, ESLint. Planned later:
  shadcn/ui, Google OAuth, GCS, Vitest, Playwright. Install only as needed.
- Keep auth integration in `src/lib/auth/`, GCS access in `src/lib/gcs/`, and
  authorized orchestration in `src/server/`. No direct GCS access from React UI.
- Authenticate and authorize protected server operations independently of the UI.
- Publishing is server-controlled: validate authentication and manifest revision,
  derive changed languages, build complete files, serialize, hash exact upload
  bytes with SHA-256, upload languages, and commit the manifest last.
- Never trust a browser-provided checksum, storage path, or original snapshot.
- Preserve active release files until a conditional manifest commit succeeds;
  resolve the storage/client contract before implementing F06. Manifest-last
  ordering alone does not make overwriting active language files safe.
- Derive changed state from original value versus edited value; reverting clears
  the change. Avoid independent dirty flags that can diverge from actual values.
- Do not hardcode or commit secrets, expose service-account keys or provider tokens
  to client JavaScript, or log credentials. Keep real environment files ignored.

MVP includes Google authentication, Android language loading, existing translation
editing, search, changed filter, publish confirmation, and safe publishing.
Excluded: adding keys/languages, iOS, audit history, rollback, automatic translation,
placeholder validation, and advanced conflict merging.

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

Retain the generated Next.js guidance below.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
