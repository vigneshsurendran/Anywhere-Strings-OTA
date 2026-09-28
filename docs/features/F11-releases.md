# F11 — Releases

Status: implemented. The screen matches the Figma Releases frame. Depends on F05 and F10.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

A release is its own entity. It is a frozen copy of one platform’s working set,
stored as that platform’s language-file JSON. The working set remains the only
place strings are edited. The release list is where a person chooses which
frozen copy apps download.

The screen is one list with All, Android, and iOS filters. Android and iOS
still have separate releases, separate version numbers, and separate
production choices. An Android release does not include iOS strings, and
setting Android production does not change `ios/manifest.json`.

### What a release stores

Creating a release copies the saved working set for that platform. Each
language becomes one file body, `{ "strings": { "<key>": "<value>" } }`,
serialized as `JSON.stringify(value, null, 2) + "\n"` with keys sorted. Empty
strings are included. A key with no value row for a language is omitted from
that language. The release stores those exact bodies. They are not edited
afterward.

The server assigns the next integer version for that platform. It is one higher than both the latest release in the database and any existing `{platform}/{locale}/{version}.json` object, and it starts at 1 when neither exists. Existing language files are never overwritten.
The version is not editable. The release also has a name. The name may be
empty at creation and is shown as Untitled. Renaming changes only the name.
It does not change the JSON, the version, who created it, who released it,
or any bucket object.

The server records two people, both as the verified email from the signed-in
session. The browser cannot supply either email.

`created_by` is who created the release. It is set at creation and does not
change when the release is renamed or set as production.

`released_by` and `released_at` are who last set that release as production,
and the UTC time of that change. They stay empty until the first successful
production update for that release. They are written only after the manifest
read-back succeeds, together with `is_production`. Pointing production at a
different release does not clear the previous release’s `released_by` or
`released_at`. A failed manifest update leaves them unchanged.

A release is not deleted, and its language files are not removed or
overwritten when a newer release is created. There is no prerelease channel
in this feature.

Unsaved text in the main list is not copied. While a value field differs from
the database, create does not run. The server also refuses when the saved
working set matches the latest release for that platform, or when that
platform has no languages.

### What apps download

Old and new app builds request the same manifest, `android/manifest.json` or
`ios/manifest.json`. They all receive whichever release is currently
production. That is one served release per platform, not a manifest per app
version.

The working set is the source of truth for editing. The production release is
the source of truth for what the SDK downloads. Those stay separate:

- Creating a release writes each language file once, to
  `{platform}/{locale}/{version}.json`. It does not change the manifest, and
  it does not change which release is production.
- Setting production updates only that platform’s manifest. The manifest URLs
  and checksums point at the chosen release’s existing files. `updatedTime`
  is a new UTC timestamp so the SDK refetches. The release JSON is not
  written again. After the manifest read-back succeeds, that release records
  the signed-in user as `released_by` and the same UTC time as `released_at`.
  Older releases stay in the bucket, so production can be pointed back at one
  of them later.
- A failed manifest update leaves the previous manifest, the previous
  production release, and every release’s `released_by` and `released_at`
  in place.

The manifest format, generation precondition, read-back, and checksum stay as
specified in F10. The browser cannot supply a checksum, object path, or file
body. The version and the name are not fields in the manifest.

Because every app that checks in receives the production release, removing a
key from the working set and then creating a release will remove that key
from devices once that release is set as production. The previous release
still exists and can be set back to production.

```sql
CREATE TABLE releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  version INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  released_at TEXT,
  released_by TEXT,
  is_production INTEGER NOT NULL DEFAULT 0 CHECK (is_production IN (0, 1)),
  UNIQUE (platform, version)
);

CREATE TABLE release_files (
  release_id INTEGER NOT NULL REFERENCES releases (id),
  locale TEXT NOT NULL,
  body TEXT NOT NULL,
  checksum TEXT NOT NULL,
  object_name TEXT NOT NULL,
  PRIMARY KEY (release_id, locale)
);
```

`is_production` is 1 for at most one release per platform. It changes only
after the manifest read-back succeeds, at the same time as that release’s
`released_by` and `released_at`.

### List

The table columns are Served, Name, Platform, Version, Created, and Download.
Served is the radio. The production row also shows a Production badge.
Created is the calendar date. The server still records who created the
release and who last set it as production; those names are not columns.
A radio sets production. The list does not edit release strings. Clicking
the name renames it. F14 is the Download button on each row.

## Acceptance criteria

- A signed-out user cannot create a release, rename one, or set production.
- Creating a release stores the language-file JSON, assigns the next version, writes each language object once, and records the signed-in user’s verified email as `created_by`. A browser-supplied email is ignored.
- Creating a release does not change the manifest, the production release, or any `released_by`.
- An identical working set, unsaved text, or a platform with no languages writes no release.
- Renaming changes only the name.
- A release’s JSON and language objects stay as they were when a newer release is created.
- Setting production updates that platform’s manifest to the chosen release’s existing files, marks that release production, and records the signed-in user’s verified email and the UTC time as who released it.
- Setting an older release back to production serves that older JSON, records who set it back, and does not write new language objects or clear who released the release that was production before.
- A failed manifest update leaves the previous production release, and who released each release, in place.
- An Android production change leaves the iOS manifest unchanged.

## Verification

Test a release whose files match the saved
working set and whose creator is the signed-in user, a refused unchanged
release, a rename that leaves the creator and releaser unchanged, setting
production and recording who released it, switching production back to an
older release, and a failed manifest update that leaves the releaser
unchanged.
Run the unit tests, lint, the production build, and `tsc --noEmit`.
