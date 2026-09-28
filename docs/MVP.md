# Anywhere String OTA — MVP

Status: the product screens are the Figma Editor and Releases frames. Live Google sign-in and a real Cloud Storage manifest still need credentials.

## Source of truth

The Figma file `Language Publisher` (`2pvck0cpz7yrMN87e9ANfB`) decides which screens and controls exist. These documents follow that file.

## Included features

| ID | Feature | Where it appears | Specification |
| --- | --- | --- | --- |
| F01 | Google sign-in for a verified Anywhere email | Sign-in gate | [Authentication](features/F01-authentication.md) |
| F02 | SQLite working set | Behind both screens | [Database](features/F02-database.md) |
| F03 | Import a CSV, Android strings file, or JSON language file | Editor, Import | [Import](features/F03-import.md) |
| F04 | Show every language for one platform on each key card | Editor | [Show translations](features/F04-show-translations.md) |
| F05 | Save one changed value | Editor, Save | [Edit a value](features/F05-edit-value.md) |
| F06 | Search keys or values | Editor search | [Search](features/F06-search.md) |
| F07 | Add a language to the platform on screen | Editor | [Add a language](features/F07-add-language.md) |
| F08 | Add a key on the platform on screen | Editor, Add key | [Add a key](features/F08-add-key.md) |
| F11 | Freeze a release and choose which one is served | Releases | [Releases](features/F11-releases.md) |
| F12 | Choose the import language from the catalog | Import dialog | [Import a language](features/F12-import-language.md) |
| F13 | Select keys and delete them from the working set | Editor checkboxes | [Delete keys](features/F13-delete-keys.md) |
| F14 | Download a release as JSON | Releases, Download | [Download a release](features/F14-download-release.md) |
| F15 | Access list of admins and users | Access | [Access](features/F15-access.md) |
| F16 | Supported languages. Add language opens this dialog | Editor | [Supported languages](features/F16-supported-languages.md) |

## Not in the Figma

These are not current product features. Do not add them back unless the Figma changes.

| ID | Removed control | Why |
| --- | --- | --- |
| F09 | Editable build snapshot | Create release freezes the working set. There is no snapshot to edit. |
| F10 | Publish button on the editor | Served, on Releases, is the manifest update. The file format stays in [F10](features/F10-publish.md). |

F15 is a product feature. Its control is specified in that file. The current Figma frames do not show it. F07 is not a control on the Editor. F08 is Add key on the Editor. The current Figma frames do not show that button.

The header includes Sign out. It clears the session and returns to the sign-in page. The session still expires, and the sign-in page remains the gate.

## Future iteration

Not part of these screens. See the [PRD](PRD.md): placeholder validation and conflict merging. Adding a language, including AI translated, is [F16](features/F16-supported-languages.md).

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, ESLint, Auth.js, Vitest, shadcn/ui, SQLite, and Cloud Storage for release files and the production manifest.

## Completion

An authorized user can import, view, edit, search, add a language, add a key, and delete keys on the Editor screen, then create a release, download it, and set it as production on the Releases screen. An admin can manage who is listed on Access. A failed production change leaves the previous manifest in place.
