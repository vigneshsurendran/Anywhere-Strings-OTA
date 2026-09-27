# F03 — Editor

Status: specification only. Depends on F02.
Read [MVP](../MVP.md) and [technical plan](../TECHNICAL_PLAN.md).
Presentation and recovery details below are proposed, not recovered UI designs.

## Objective and scope

Edit existing Android translation values while preserving the original snapshot.
Do not add keys/languages, generate translations, validate placeholders, or publish.

## Proposed interaction

Show existing keys and editable translation values with clear language labels.
Choose the table/language-selection layout when sample dataset sizes are known.
Expose changed values/counts derived from state. Keep controls keyboard accessible
and label inputs with their key and language. Define English/reference-language
editability and empty-value policy from the existing data contract before coding.

## Acceptance criteria

- Existing allowed keys/locales remain the only editable entries.
- Keep original and edited values separately. A value is changed exactly when it
  differs from its original; reverting removes it from the change set.
- Do not silently trim whitespace, normalize Unicode, or alter escaped content.
- Editing one translation preserves every other value and metadata field.
- Re-rendering, language selection, and later filters preserve all current edits.
- Invalid or incomplete loaded data cannot be edited.
- Unsaved navigation/reload handling must be decided explicitly; persistent draft
  storage is not assumed by this foundation.

## Verification

Test edits and reverts, unchanged values, multiple languages, Unicode, multiline
and whitespace values, and the agreed empty-value policy. Check keyboard editing
and independent cells. Run lint, typecheck, build, and relevant tests when ready.
