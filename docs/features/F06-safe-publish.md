# F06 — Safe Publish

Status: specification only. Depends on F01–F05 and a verified storage contract.
Read [MVP](../MVP.md) and [technical plan](../TECHNICAL_PLAN.md).
Server-owned publishing and manifest-last ordering are recovered requirements;
the transaction protocol below is a proposed implementation requirement.

## Objective

Publish complete changed-language JSON files through an authenticated server
operation without losing concurrent changes or exposing a partially prepared
release. Do not implement advanced merging, rollback, or audit-history features.

## Required contract decisions

Verify actual manifest schema, version/checksum encoding, language paths, and the
Android reader's handling of object references. Resolve the technical plan's
immutable-object proposal before coding. If the client requires overwriting fixed
paths, manifest-last ordering alone does not guarantee safe publishing; an
alternative proven protocol is required. Do not silently change the client format.

## Server responsibilities

1. Validate session, domain authorization, storage access, input size/shape, and
   allowed locales/keys. Resolve storage paths from trusted server configuration.
2. Validate the loaded manifest revision against authoritative storage and recover
   the baseline. Reject stale sessions without writes or automatic merging.
3. Derive actual changed languages from validated edits. A no-op makes no writes.
4. Build complete language objects, preserving untouched translations/metadata.
5. Serialize once and compute SHA-256 from the exact uploaded UTF-8 bytes; ignore
   any browser-supplied checksum or purported final file.
6. Upload every changed language while preserving the currently published release.
   Abort the manifest commit if any required upload fails.
7. Update the manifest last using a conditional atomic commit against the baseline
   storage revision. Preserve unchanged language references and metadata.
8. Confirm the commit, then return the committed release for the new UI baseline.

## Failure and concurrency acceptance criteria

- Two publishers starting from one revision cannot both commit conflicting releases.
- Prepared files from concurrent attempts cannot overwrite each other or files
  referenced by the current manifest.
- Upload/manifest failure does not corrupt the active release; retain local edits.
- Version conflicts require reload and user review. Do not silently drop edits.
- After a timeout with uncertain commit outcome, inspect the authoritative release
  before retrying; do not report success or blindly duplicate writes.
- Prevent duplicate submits in the UI and define server retry/idempotency behavior;
  UI disabling alone is not concurrency control.
- Unreferenced upload cleanup is an operational follow-up, never a reason to delete
  files that might be referenced by a committed manifest.

## Verification

Test authorization, malformed input, unknown keys/locales, no-op and reverted
edits, complete-file preservation, and exact-byte SHA-256. Simulate stale versions,
two simultaneous publishers, one failed language upload, manifest rejection,
expired credentials, and an ambiguous post-commit timeout. Assert that every
visible manifest always points to available matching language bytes. Cover the
review-to-publish workflow end-to-end using isolated fixtures/mocked storage.
