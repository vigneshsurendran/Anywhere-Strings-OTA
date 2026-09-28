# F14 — Download a release

Status: implemented. Download is the last column on the Releases frame. Depends on F11 and F03.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

Each release row has Download. The download is the JSON frozen on that
release, not the current working set and not a new copy read from the bucket.
The server reads `release_files.body`. The browser cannot supply the file body.

Each language file is the import shape, `{ "strings": { "<key>": "<value>" } }`,
including empty strings. A release with one language downloads that file as
`{platform}-v{version}-{locale}.json`. A release with more than one language
downloads `{platform}-v{version}.zip`. The zip contains one `{locale}.json`
per language, each in that same import shape, so a deleted key can be
restored by importing the file through F12.

Download does not change the working set, the release name or JSON, which
release is production, or any bucket object.

## Acceptance criteria

- A signed-out user cannot download a release.
- Download returns the stored release bodies, including keys that have since been deleted from the working set.
- A one-language release downloads one `.json` file that F03 accepts.
- A multi-language release downloads a `.zip` of those `.json` files.
- Download does not change the working set, the release, production, or the bucket.

## Verification

Test a one-language download, a multi-language zip whose files match the
stored bodies, a download after those keys were deleted from the working set,
and an unauthenticated request. Run the unit tests, lint, the production
build, and `tsc --noEmit`.
