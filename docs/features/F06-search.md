# F06 — Search

Status: implemented. The Editor search field matches the Figma. Depends on F04.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

Search filters the key cards on screen. The query matches the key or any
language value on that card, including a value typed but not yet saved,
case-insensitively, as entered. Aa makes that search case sensitive. Exact
match, the quotation-mark control, keeps a card only when the key or a
whole translation equals the query, so a longer value that merely contains
the query is left out. The two controls combine. The count inside the field is the number of
matching cards. Filter can keep cards with an empty value, or cards with an
unsaved edit. Sort orders the cards by key name, A–Z or Z–A, or by last
modified, newest first. Last modified is the latest saved change on that key.
A key with no saved change stays after keys that have one. Select all
applies to every match, including cards that are not mounted while the list
is scrolled. Clearing the query shows the full list again. Search does not
write the database and does not change the platform menu.

## Acceptance criteria

- A query shows only cards whose key or any language value contains that text.
- Exact match shows a card only when the key or a whole translation equals the query.
- Case sensitive keeps the query’s letter case. It applies with or without exact match.
- Empty values and Unsaved each narrow the same list. Sort orders it by key name or by last modified.
- Clearing the query restores the cards that the platform menu and filter still include.
- A search does not change any stored value.

## Verification

Test a key match, a value match, a non-match, and clearing the query. Run the
unit tests, lint, the production build, and `tsc --noEmit`.
