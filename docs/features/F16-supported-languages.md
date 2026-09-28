# F16 — Supported languages

Status: implemented. Depends on F02, F03, and F04. The Add language canvas is Figma page `Add language` (`14:3`) in `Language Publisher` (`2pvck0cpz7yrMN87e9ANfB`).
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

Each key card shows the languages stored for that platform. Add language, in the Editor toolbar, opens this dialog. There is no separate language list.

[F07](F07-add-language.md) is the older typed-locale action. It is not shown on the Editor. This dialog writes the chosen language for both platforms, starting from English.

1. A language picker. It offers catalog languages from F12 that are not stored yet. Before a search, it shows the ten popular languages that are still missing. Search matches a missing language by name or code across the whole catalog, including every ISO 639-1 language outside those ten. A language already stored on both Android and iOS is absent.
2. Import, or AI translated. AI translated is selected when the dialog opens.

Confirming Add writes that language on each platform that already has English (`en`) and does not yet have the language. Android keys start as Android’s English text. iOS keys start as iOS’s English text. A platform with no English is left unchanged. A language already stored on a platform is not written again there.

Import applies one CSV, Android strings file, or JSON file. Keys in the file replace the English text. Keys absent from the file stay in English. An invalid file adds no language and changes no values. F03’s file rules still apply.

AI translated fills from that platform’s English text. A key the translator does not return stays in English. Placeholders such as `%1$s` and `{name}` stay as written. Running Add again on a language that is already stored does not replace reviewed translations.

A key added to English after this language exists is copied into the new language as the English text. Later edits to English do not flow into the other language.

Add changes the working copy only. The phone does not change until a release for that platform is created and served. The served manifest lists every language in that release. The settings menu starts from that list and shows a language only when remote config also turns it on. Remote config is not a control in this app. Serving Android does not serve iOS.

The Editor Import button remains the way to update a language that is already supported.

## Acceptance criteria

- A signed-out user cannot add a language.
- Each key card shows the languages stored for its platform.
- Add opens the dialog with AI translated selected.
- Language selection is one reusable component. Every place that chooses a catalog language uses it.
- Before a search, the picker shows only the popular languages from F12 that are not already stored.
- Search shows every missing catalog language whose name or code matches, including languages outside the popular ten.
- A language already stored on both platforms does not appear.
- Confirming Add creates the language on each platform that already has English and does not yet have it. A platform with no English stays unchanged.
- Import replaces only the keys present in a valid file. An invalid file writes nothing.
- An untranslated key, or a failed translation, stays in English.
- Adding a language does not change either manifest.
- A language already stored on both platforms cannot be added again.

## Verification

Test a language added to both platforms, a language that already exists on one platform, an invalid import, a second add of the same language, and an unauthenticated request. Run the unit tests, lint, the production build, and `tsc --noEmit`.
