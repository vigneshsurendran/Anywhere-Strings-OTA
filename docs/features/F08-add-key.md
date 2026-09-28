# F08 — Add a key

Status: implemented. Depends on F02 and F04.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

Add key, in the Editor toolbar, opens this dialog for the platform chosen in the platform menu. All uses the platform last chosen there, or Android until one is chosen. Import can still create keys from a file.

The key matches `^[A-Za-z][A-Za-z0-9_.-]{0,199}$`. It starts with a letter and uses only letters, numbers, dots, underscores, or hyphens, up to 200 characters. The key is stored as typed. It is not trimmed. Import may still accept a different key, including one up to 500 characters, under [F03](F03-import.md). This dialog does not widen that import rule, and import does not have to satisfy this pattern.

The dialog asks for a value under the key. AI translation is checked when the dialog opens.

Confirming Add writes that platform only:

- Insert one `translation_keys` row.
- When English is stored, the value is saved as English. With AI translation on, each other language receives a translation of that English text. A language the translator does not return, or a translation that drops a placeholder, keeps the English text. With AI translation off, those other languages are empty.
- When English is not stored, AI translation stays off and the value is saved for every language already on that platform.
- A platform with no languages still gains the key. The value is not stored. A language added later receives an empty value for this key.

The other platform keeps its own keys. A key of the same name there is a separate row and is not created by this add.

A key already stored on this platform is rejected. An invalid key is rejected. Either rejection writes nothing.

Add changes the working set only. Existing releases and Cloud Storage stay as they are. The new key is included the next time a release is created for this platform. [F13](F13-delete-keys.md) can delete it later.

## Acceptance criteria

- A signed-out user cannot add a key.
- Add key opens a dialog for the platform on screen. Import can still create keys from a file.
- A valid new key appears on that platform. With English stored and AI translation off, English has the entered value and the other languages are empty. With AI translation on, the other languages are translations of that English value.
- A key added before any language exists is stored, and a language added afterward has an empty value for it.
- A duplicate key or an invalid key leaves the working set unchanged.
- The other platform does not gain the key.
- Existing releases and the bucket are unchanged.

## Verification

Test a key added beside existing languages, a key added when the platform has no language, a following language that receives an empty value, a duplicate, an invalid key, a cross-platform name that stays absent, and an unauthenticated request. Run the unit tests, lint, the production build, and `tsc --noEmit`.
