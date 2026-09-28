# F13 — Select and delete keys

Status: implemented. Select all, the key checkbox, and Delete match the Editor frame. Depends on F04.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

Each key on the editor list has a checkbox. The checkbox selects that key on
the platform currently shown. It does not select the same key name on the
other platform.

Select all checks every key in the current list. Search narrows that list, so
Select all checks or clears only the keys the search is showing. A check on a
key hidden by a later search stays checked.

Delete is available when at least one key is checked. It asks for
confirmation and names how many keys will be removed from that platform.
Confirming deletes those keys and every language value stored for them on
that platform. Unsaved text in those fields is discarded. Cancel leaves the
working set as it was.

Deletion changes the working set only. Existing releases, their JSON, and
Cloud Storage stay as they are. The other platform keeps a key of the same
name. The next release created after the delete simply does not include the
removed keys. A deleted key can come back by downloading a release that still
has it and importing that file (F14 and F12).

## Acceptance criteria

- A signed-out user cannot delete keys.
- Each key row has a checkbox, and Select all checks the keys currently shown.
- Confirming delete removes the checked keys and their values from that platform only.
- Cancel, or a request with no checked keys, writes nothing.
- An Android delete leaves the iOS key of the same name in place.
- Existing releases and the bucket are unchanged.

## Verification

Test select all with and without a search, a confirmed delete, a cancelled
delete, a cross-platform key that remains, and an unauthenticated request.
Run the unit tests, lint, the production build, and `tsc --noEmit`.
