# Language Publisher — MVP

Status: Milestone 0 foundation only.

## Provenance

Reconstructed from the accessible “Vibe Coding Tools and Steps” conversation on
2026-09-27. The earlier `Language_Publisher_MVP.md` download was named there but
its body was not accessible. This is a working reconstruction, not a verbatim
recovery. See [PRD.md](PRD.md) for source limitations and open product decisions.

## Included features and implementation order

| ID | Feature | Specification |
| --- | --- | --- |
| F01 | Google authentication and verified Anywhere email restriction | [Authentication](features/F01-authentication.md) |
| F02 | Load Android manifest and language data through the server | [Load language data](features/F02-load-language-data.md) |
| F03 | Edit existing translations and derive changed state | [Editor](features/F03-editor.md) |
| F04 | Search and changed-only filtering | [Search](features/F04-search.md) |
| F05 | Review changes and explicitly confirm publishing | [Publish confirmation](features/F05-publish-confirmation.md) |
| F06 | Server-controlled validation, hashing, uploads, and manifest update | [Safe publish](features/F06-safe-publish.md) |

Only implement the feature requested in the current task. F01 is the first
implementation milestone after the foundation; it does not include GCS access.

## Excluded

- Adding keys or languages.
- iOS support.
- Audit history and rollback.
- Automatic translation and placeholder validation.
- Advanced conflict merging.

## Milestone 0 deliverables

- PRD reconstruction, MVP reconstruction, technical plan, and F01–F06 specs.
- Project agent instructions and a secret-free environment template.
- Tracked placeholder folders for common/publisher components, feature logic,
  auth/GCS adapters, server orchestration, unit tests, and end-to-end tests.
- Preserve the existing Next.js scaffold, dependency versions, root `app/`,
  import aliases, lockfile, and starter page.
- Run existing lint/build checks where practical; report environmental failures.

No authentication, editor UI, API routes, GCS integration, dependency installation,
deployment, or live publishing belongs to this milestone.

## Planned stack

Existing: Next.js App Router, React, TypeScript, Tailwind CSS, ESLint.
Planned for later features: shadcn/ui, Google OAuth, GCS, Vitest, Playwright.
The OAuth/session library and storage integration details remain to be selected.
Do not treat planned libraries as installed or configured.

## MVP completion criteria

An authorized user can load Android translations, edit existing values, search
and review all changes, and safely publish changed languages. Reverted values
are not published. Unauthorized, stale, concurrent, and failed publish attempts
are covered by meaningful tests. The existing Android client can consume the
resulting manifest and language files without a format migration being assumed.

These are future acceptance criteria, not claims about Milestone 0 functionality.
