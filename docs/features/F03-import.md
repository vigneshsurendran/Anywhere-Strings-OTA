# F03 — Import

Status: implemented. Depends on F02.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

An authorized user imports one file into the working set. The form sets the
platform, `android` or `ios`, and one locale. The file does not choose the
platform. The import writes the database and does not touch Cloud Storage.

Accepted files:

- CSV with a header row `key,value`.
- Android `strings.xml`: each `string` element’s `name` is the key and its
  text is the value.
- A JSON language file `{ "strings": { "<key>": "<value>" } }`, or an array of pairs such as `[ { "<key>": "<value>" } ]`. An array item may also be `{ "key": "<key>", "value": "<value>" }`.

For each pair, create the language and the key when they are missing, and set
the value for that platform and locale. A repeated key in one file keeps the
last value. Keys absent from the file stay as they are. An empty value is
stored as an empty string. Values are not trimmed. A key longer than 500
characters, a value longer than 100000 characters, or a blank key is rejected
and that file is not applied. The locale matches
`^[A-Za-z]{2,3}(?:[_-][A-Za-z0-9]{2,8})*$`.

The Editor Import button opens this form. Applying a file to a locale that is
missing still creates that language, as this spec describes. [F07](F07-add-language.md)
is the separate dialog that adds a language with empty values and no file.
[F12](F12-import-language.md) chooses the locale from the catalog.

## Acceptance criteria

- A signed-out user cannot import.
- Each accepted file type adds rows for the chosen platform and locale only.
- An iOS import does not change Android rows that share a key name.
- A second import of the same key replaces that locale’s value and leaves
  other locales alone.
- Keys missing from the file remain in the database.
- An invalid file writes nothing.
- The bucket is not read or written.

## Verification

Test all three file types, a repeated key, an empty value, a cross-platform
key, a rejected file, and an unauthenticated request. Run the unit tests,
lint, the production build, and `tsc --noEmit`.
