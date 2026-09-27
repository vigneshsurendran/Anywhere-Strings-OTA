# F05 — Publish Confirmation

Status: specification only. Depends on F03/F04; actual writes depend on F06.
Read [MVP](../MVP.md) and [technical plan](../TECHNICAL_PLAN.md).
The confirmation step is confirmed scope; presentation details are proposed.

## Objective and scope

Let users inspect all pending changes and explicitly confirm before publishing.
List affected languages, translation identifiers, and original/current values,
including edits hidden by search or filters. Define counts explicitly as changed
translation cells and affected languages to avoid confusing rows with values.

## Acceptance criteria

- No-change state cannot initiate publishing.
- Cancel closes confirmation and preserves edits with no storage side effects.
- Confirmation reflects the exact edit set submitted. If edits change while it
  is open, refresh the review and require confirmation of the new set.
- Duplicate confirmation is disabled while a publish request is pending.
- Keyboard focus enters and leaves the dialog predictably; controls are labeled.
- On failure, retain edits and show recovery guidance; on confirmed success,
  establish the committed baseline through the F06 integration.
- Do not compute an authoritative checksum or perform GCS calls in the browser.

## Dependency boundary and verification

F05 may use a mocked publish boundary in tests, but must not expose a production
button that claims successful publishing before F06 exists. Test cancel/no-op,
hidden edits, changing review data, double-submit prevention, focus behavior, and
success/failure states. Storage safety belongs to the server-side F06 tests.
