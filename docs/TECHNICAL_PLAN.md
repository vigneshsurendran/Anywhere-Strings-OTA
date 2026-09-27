# Language Publisher — Technical Plan

Status: reconstructed working plan; no product implementation in Milestone 0.

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
app/                            Existing App Router entry points
docs/                           Product, scope, architecture, feature specs
src/components/common/          Shared UI primitives, added as needed
src/components/publisher/       Translation editor and publish UI
src/features/language-publisher/ Domain models, pure change/search logic, state
src/lib/auth/                   Server-side authentication/session integration
src/lib/gcs/                    Server-side GCS adapter and object operations
src/server/                     Authorized load/publish orchestration
tests/unit/                     Future Vitest tests
tests/e2e/                      Future Playwright tests
```

Folders initially contain `.gitkeep` only. No library API or test harness is
implied. Add shadcn/ui, auth/GCS dependencies, Vitest, and Playwright only when a
requested implementation needs them. Read the installed Next.js documentation
under `node_modules/next/dist/docs/` before writing framework code.

## Trust boundaries

The browser renders data and submits edit intent. Server entry points validate
the session and authorization for every protected operation, then call
`src/server/` orchestration. GCS access stays in `src/lib/gcs/`; React components
must not import it or receive storage credentials. Mark server-only integration
modules appropriately when they are implemented.

Google sign-in must validate provider identity and verified email server-side,
requiring the exact email domain `anywhere.co`. A hosted-domain hint is not the
authorization check. Choose a maintained OAuth/session library compatible with
the installed Next.js version at F01. Apply its state/CSRF protections and secure
cookie/session handling. Keep provider access/refresh tokens server-side.

The earlier discussion refers to using the user's Google credentials for GCS.
Treat delegated user access as the intended direction, pending confirmation of
OAuth scopes, consent, IAM, and refresh behavior at F02. Successful domain
authentication does not imply bucket permission. Do not silently substitute a
shared service account or broaden storage access.

## Data contract — unresolved until F02

Obtain representative existing manifest and language objects before defining
wire types. Confirm locale/key representation, reference language, editable
fields, empty/missing values, object paths, version semantics, and checksum
encoding. Preserve unmodified fields. Do not invent production JSON examples.

Retain an immutable original snapshot and its manifest version/storage revision.
The server must be able to recover or verify that exact baseline when publishing;
a browser-provided original snapshot is not authoritative. Object revisions
should retain their exact representation rather than losing numeric precision.
Validate that all required language reads belong to one coherent release before
making the snapshot editable. A partial load must not become publishable.

## Editor state and search

Store original values separately from current edited values. Derive changed
cells, keys, and languages by comparing original and current values; reverting a
value clears its change. Do not trim or normalize translations without a product
decision. Keep search, selected language, and changed-only filters as presentation
state. Filtering must not discard edits or restrict the publish change set.
The exact editor layout and search fields are proposed in F03/F04.

## Proposed publish protocol

1. Accept a bounded, validated edit set and a baseline revision. Do not trust
   caller-provided paths, bucket names, checksums, or complete replacement files.
2. Revalidate authentication and storage authorization. Recover the authoritative
   baseline; reject stale or unavailable baselines and unsupported keys/locales.
3. Derive actual changes server-side. A no-op performs no storage writes.
4. Apply edits to complete baseline language objects, preserving unchanged data.
   Serialize each changed-language file once and hash the exact UTF-8 bytes to be
   uploaded. Confirm checksum encoding and serialization expectations with the
   Android reader.
5. Upload all changed language objects. Do not advance the manifest if any upload
   fails. Preserve the prior release's readable objects throughout this step.
6. Commit the manifest last with an atomic storage revision precondition against
   the loaded manifest revision. A pre-read version comparison alone is not an
   adequate concurrent-writer guard. Preserve unchanged language references.
7. Report success only after commit is confirmed. Reload the committed snapshot
   to establish a new editing baseline; retain edits on failure.

**Important unresolved storage contract:** uploading over the current language
paths can invalidate the old manifest even when the new manifest is never
written. The proposed solution is immutable release-specific language objects
referenced by a conditionally updated manifest. Verify that the Android reader
supports such references before implementing F06. If it requires fixed paths,
design and validate an alternative with equivalent guarantees first. Upload
ordering by itself is not a transaction.

Concurrent publishers must not overwrite each other's prepared language objects;
only one may commit against a given manifest revision. Losing attempts can leave
unreferenced objects; cleanup/retention policy is a later operational decision.
An ambiguous network result after manifest submission requires checking the
actual committed release before retrying. Do not blindly republish. Advanced
merge and rollback UI remain outside MVP.

## Errors and user recovery

Distinguish sign-in required, access denied, invalid data/input, stale snapshot,
storage failure, and uncertain publish outcome. Show actionable messages without
credentials or internal provider payloads. Preserve edits during failed loads
or publishes where possible. A conflict requires a fresh snapshot and user review;
do not silently overwrite or discard local work.

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
| GCS_BUCKET_NAME | Authorized Android language bucket |
| GCS_MANIFEST_OBJECT | Exact manifest object path; must come from existing data |

Do not add `NEXT_PUBLIC_` to secrets or expose Google tokens to client JavaScript.
Do not store service-account JSON or access tokens in the example file. Bucket,
manifest path, OAuth callback, session storage, scopes, and deployment remain
unconfigured; there are no production defaults.

## Verification and milestones

Milestone 0: documents and tracked empty folders; preserve starter behavior.
Then implement F01 → F02 → F03 → F04 → F05 → F06 independently. Finish with
end-to-end verification before deployment planning.

Available commands:

```sh
npm run lint
npm run build
./node_modules/.bin/tsc --noEmit --incremental false
```

The starter layout uses `next/font/google`; its build may require network access
to fetch fonts. Record environmental failures rather than changing the scaffold
solely to obtain a passing check. Run type checking after generated Next.js types
are available. There is no `typecheck` or `test` package script yet.

Future Vitest coverage: authorization decisions, schema validation, equality and
reverts, search/filter composition, complete-file generation, exact-byte hashing,
no-op publishing, stale/concurrent writers, failed uploads, and uncertain commits.
Future Playwright coverage: sign-in/denial, load/edit/search, confirmation/cancel,
successful publish and failure recovery. Mock external services by default; any
live integration verification must use an explicitly configured non-production
bucket and valid credentials. Do not add placeholder passing tests at Milestone 0.
