# F04 — Search

Status: specification only. Depends on F03.
Read [MVP](../MVP.md) and [technical plan](../TECHNICAL_PLAN.md).
Search and changed-only filtering are confirmed scope; the matching rules below
are proposed defaults to reconcile with the original MVP before implementation.

## Objective and proposed behavior

Help users locate existing translations and inspect changes without mutating
editor data. Use case-insensitive substring search across keys and current values
of the languages displayed by the editor. Empty search matches all entries.
Combine search and changed-only filtering with AND semantics. A changed row is
one with at least one edited value differing from its original in the editor's
dataset; identify which language changed even if its column is currently hidden.

## Acceptance criteria

- Typing/clearing a query and toggling changed-only never modify or discard edits.
- Search uses current edited values, and changed state updates after each edit.
- Reverting the last changed value removes the row from changed-only results.
- Provide a clear empty-results state and a way to clear filters.
- Publish counts and the publish payload include all changes, including hidden
  rows/languages. Filtering is a view operation only.
- Do not introduce regex, fuzzy matching, or a separate search service.

## Verification

Test key/value matches, case differences, empty/no-match queries, changed filter
composition, revert behavior, hidden edits, and preservation of Unicode values.
Record the search-language scope in tests once the F03 layout is settled.
