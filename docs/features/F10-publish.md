# F10 — Publish

Status: the manifest contract Served uses. The Editor has no Publish button. Depends on F11.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

Served, on Releases, is the action. It points one platform’s manifest at
language files already stored for that release. Those objects use
`{platform}/{locale}/{version}.json`, as F11 specifies. Creating a release
writes the language files. Served writes the manifest after that, and does
not write the language files again.

Android and iOS each have their own manifest: `android/manifest.json` and
`ios/manifest.json`. Serving one platform leaves the other manifest unchanged.

The manifest is updated last, with the loaded generation as the precondition.
The app then reads the manifest back. The database marks that release as
production only after the read-back matches. A failed update leaves the
previous manifest and the previous production release in place.

`updatedTime` is UTC, `YYYY-MM-DDTHH:mm:ss.sssZ`, generated when Served runs,
including when an older release is served again. The manifest object is
uploaded with `Cache-Control: no-cache`.

Each language file is `{ "strings": { "<key>": "<value>" } }`, serialized as
`JSON.stringify(value, null, 2) + "\n"`. The checksum is the SHA-256 hex of
those exact bytes.

```json
{
  "updatedTime": "2026-09-28T15:04:00.123Z",
  "languages": {
    "en": {
      "url": "https://storage.googleapis.com/language-ota/android/en/1.json",
      "checksum": "…"
    }
  }
}
```

The browser cannot supply a checksum, object path, or file body. The bucket
name is `GCS_BUCKET`. Writes use Application Default Credentials.
`PUBLISHER_STORAGE=memory` is a non-production test double. Sign-in stays on
`openid email profile`.

The SDK requests the manifest on every check, compares `updatedTime` as an
exact string, and on a difference downloads the URLs in the manifest and
checks each checksum. It does not list the bucket. A language missing from
the new manifest is deleted on the device. A language that is still listed,
and whose download fails, keeps the stored copy.

## Acceptance criteria

- A signed-out user cannot change which release is served.
- Served updates that platform’s manifest to the chosen release’s existing files.
- Serving Android leaves the iOS manifest unchanged.
- A failed update leaves the previous manifest and the previous production release in place.
- The browser cannot supply a checksum, object path, or file body.

## Verification

Test serving a release, serving an older release again, a failed update, and
an Android change that leaves the iOS manifest unchanged. Run the unit tests,
lint, the production build, and `tsc --noEmit`.
