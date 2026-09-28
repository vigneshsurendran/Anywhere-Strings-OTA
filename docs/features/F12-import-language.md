# F12 — Choose a language while importing

Status: implemented. The Import dialog chooses a catalog language. Depends on F03.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

F16 adds a missing language to both platforms from English. The Editor’s Add language button opens that dialog. [F07](F07-add-language.md)
can still add a typed locale with empty values and no file, and it is not a control on the Editor.
This spec is the catalog that the F16 picker and this Import field use. The
locale on Import is chosen from that catalog, not typed.

Each catalog language has a name and a code. A code that is not in this
catalog cannot be added. The file does not choose the language.

The catalog is every ISO 639-1 language, plus Portuguese (Portugal) (`pt-PT`).
These ten are the popular languages. F16 shows them before a search:

| Name | Code |
| --- | --- |
| English | `en` |
| Spanish | `es` |
| Portuguese | `pt` |
| French | `fr` |
| German | `de` |
| Italian | `it` |
| Dutch | `nl` |
| Chinese | `zh` |
| Japanese | `ja` |
| Korean | `ko` |

Every other catalog language is reached by search, including Portuguese (Portugal) (`pt-PT`) and the rest of ISO 639-1. A search matches the full catalog, not only these ten.

Choosing a language that is already on that platform imports into it. F03
still applies: the file updates that locale only, keys missing from the file
stay, an empty value is stored, and an invalid file writes nothing.

Choosing a language that is not on that platform yet adds it, then applies
the file. The new language gets an empty string for every key that already
exists on that platform. Values in the file replace those empty strings for
the keys they contain. The other platform is unchanged. Nothing is copied
from another language. The write does not touch Cloud Storage or any release.

## Acceptance criteria

- A signed-out user cannot import or add a language.
- Choosing a language uses the reusable language selection from F16. The choice is one of the catalog languages above, labeled with its name and code.
- Importing a language that already exists on the platform updates only that locale.
- Importing a language that is missing adds it on that platform, with an empty value for every existing key, then applies the file.
- The same code can be added to the other platform as a separate language.
- A file that F03 rejects adds no language and changes no values.
- The bucket and existing releases are not read or written.

## Verification

Test an import into an existing language, an import that adds a catalog
language, a rejected file that leaves the platform unchanged, and an
unauthenticated request. Run the unit tests, lint, the production build, and
`tsc --noEmit`.
