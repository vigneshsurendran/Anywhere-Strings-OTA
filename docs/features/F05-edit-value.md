# F05 — Edit a value

Status: implemented. Save sits on the Editor card, as in the Figma. Depends on F04.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

The signed-in user can change a value on the Editor card. Save appears beside
a field only when the typed text differs from the stored value. Saving writes
that one field to `translation_values`. Leaving the field unchanged writes
nothing. An empty string is a stored value. The value is not trimmed or
Unicode-normalized. A value longer than 100000 characters is rejected and the
stored value stays as it was. A failed save keeps the typed text on screen
and shows an error. This write does not create a release and does not touch
Cloud Storage.

## Acceptance criteria

- A signed-out user cannot save a value.
- A committed edit is what the next load of that language shows.
- An empty committed value is stored as an empty string.
- A rejected value leaves the previous stored value in place.
- The other platform, and the other languages of this platform, are unchanged.

## Verification

Test a changed value, an empty value, a too-long value, and an unauthenticated
save. Run the unit tests, lint, the production build, and `tsc --noEmit`.
