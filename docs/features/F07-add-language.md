# F07 — Add a language

Status: implemented. Depends on F02 and F04.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

The Editor no longer opens this dialog. Add language in the toolbar opens the [F16](F16-supported-languages.md) dialog. This typed-locale action remains on the server for a platform-only empty language, and it is not a control on the Editor.

The locale matches `^[A-Za-z]{2,3}(?:[_-][A-Za-z0-9]{2,8})*$`, the same rule Import uses. Examples that pass are `en` and `pt-BR`.

Confirming Add writes that platform only:

- Insert one `languages` row for the platform and locale.
- Insert one `translation_values` row for every key already stored on that platform. Each value is an empty string.
- A platform with no keys still gains the language row. A key added later receives an empty value for this language.

The same locale may be added to the other platform as a separate language. That second add does not copy values across platforms.

A locale already stored on this platform is rejected. An invalid locale is rejected. Either rejection writes nothing.

This dialog does not copy English, translate, or import a file. [F16](F16-supported-languages.md) remains the both-platforms flow that starts from English and offers Import or AI translated. Import can still create a language when its file is applied to a locale that is missing, as [F03](F03-import.md) specifies.

Add changes the working set only. Existing releases and Cloud Storage stay as they are. The new language is included the next time a release is created for this platform.

## Acceptance criteria

- A signed-out user cannot add a language.
- The Editor toolbar does not open this dialog. Add language there opens F16.
- A valid new locale appears on every key card for that platform, with an empty value.
- The same locale can be added to the other platform without copying values.
- A duplicate locale or an invalid locale leaves the working set unchanged.
- Android and iOS rows that share a key name stay separate.
- Existing releases and the bucket are unchanged.

## Verification

Test a language added beside existing keys, a language added when the platform has no keys, the same locale on the other platform, a duplicate, an invalid locale, and an unauthenticated request. Run the unit tests, lint, the production build, and `tsc --noEmit`.
