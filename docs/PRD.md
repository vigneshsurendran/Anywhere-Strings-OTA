# Language Publisher — Product Requirements

Status: reconstructed draft for Milestone 0; product features are not implemented.

## Source and authority

The original PRD was not available in the local project or the accessible history of
the ChatGPT conversation “Vibe Coding Tools and Steps”
(`6ab8d3cb-2e34-83e8-a24d-6f310d059171`, retrieved 2026-09-27).
That history names previously generated MVP and technical-plan downloads, but does
not expose their complete contents or downloadable attachments. This document
records the requirements visible in that history; it is not a copy of the original
PRD. Reconcile it with the original documents when available. Unconfirmed design
details are explicitly identified below and in the technical plan.

## Problem and intended users

Language Publisher is an internal web application for authorized Anywhere staff
to edit existing Android OTA translations and publish language JSON files to
Google Cloud Storage (GCS). The workflow must preserve unchanged translations and
avoid announcing a release before its language files are ready.

## Confirmed workflow

1. Sign in with Google using a verified `@anywhere.co` email address.
2. Load Android language data and its manifest.
3. Edit existing translations; preserve original values for change detection.
4. Search and filter to changed translations.
5. Review changes in a publish confirmation step.
6. Publish through the server, which validates access and manifest version, builds
   complete changed-language files, serializes them, computes SHA-256, uploads
   those files, and updates the manifest last.

The browser submits edits, never an authoritative checksum or final publish file.
Returning a value to its original value removes it from the change set.

## MVP scope

See [MVP.md](MVP.md) for scope and [TECHNICAL_PLAN.md](TECHNICAL_PLAN.md)
for implementation boundaries. Features are specified independently under
`docs/features/` and implemented in order, only when requested.

Excluded: adding keys, adding languages, iOS, audit history, rollback, automatic
translation, placeholder validation, and advanced conflict merging.

## Proposed acceptance and reliability requirements

- Unauthorized or unverified users cannot load or publish data.
- Loading or publishing failures are visible and retain recoverable local edits.
- A stale edit session cannot silently overwrite a newer published manifest.
- A failed upload cannot expose an incomplete release to Android clients.
- Publish success is shown only after the manifest commit is confirmed.
- Search, filters, and confirmation do not modify translations.
- No OAuth tokens, service-account keys, or other secrets are exposed in the UI,
  committed to Git, or included in logs.

These acceptance details elaborate the confirmed workflow; they must be checked
against the original PRD before affected feature implementation.

## Decisions still required

- Actual manifest and language JSON examples, object paths, version fields,
  locale identifiers, checksum encoding, and Android reader behavior.
- Whether English/reference values are editable and how missing or empty values
  are represented; do not assume these are interchangeable.
- GCS bucket/environment, user IAM permissions, OAuth consent/scopes, and token
  refresh/session requirements.
- A publish protocol compatible with the Android client that preserves old
  releases during upload failure or concurrent publishing.
- Deployment target, data-size limits, and any additional authorization policy.

No numerical success targets or deployment commitments were recovered.
