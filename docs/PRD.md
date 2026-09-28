# Anywhere String OTA

Anywhere String OTA is the internal app where Anywhere staff edit Android and iOS strings and publish them for the mobile SDKs.

## Problem

Mobile SDKs download language files from Google Cloud Storage. Staff need one place to change those strings, freeze a release, and choose which release each platform serves.

Staff edit a working copy. A release is a frozen copy of one platform’s saved strings. The production release is the copy the SDKs read.

## Users

Anywhere staff who sign in with a verified @anywhere.co Google account and are listed in Access. An admin manages that list. A user can edit and publish. Sign-in is the gate in front of the app.

## Editor

The editor opens on All, which lists every saved key. The platform menu can narrow that list to iOS or Android. A key stored on both platforms is two cards, and each card shows that platform’s icon.

- Add language chooses a missing language, then Import or AI translated. AI translated is the default. The language is written for Android and iOS.
- Import adds a CSV, Android strings file, or JSON language file for the platform in the menu. All uses the platform last chosen there, or Android until one is chosen.
- Add key creates one key on that same platform. The value is saved as English. AI translation is on by default and fills the other languages. Turning it off leaves those languages empty. Import can still create keys from a file.
- Each key is one card. Every language for that platform appears on the card.
- Search matches a key or a value. Aa makes the search case sensitive. Exact match keeps a card only when the key or a translation equals the whole query, and drops values that only contain it. The count inside the field is the number of matching cards. Filter can limit the list to empty values or unsaved edits. Sort orders the cards by key name or by last modified.
- Checked keys can be deleted. Existing releases stay as they were.
- Save writes one changed value. An empty value shows the placeholder Empty.



## Releases

- Create release freezes the saved strings for one platform. The release already being served stays in place.
- Create release stays unavailable while a value is unsaved.
- The list filters to All, Android, or iOS.
- Each row shows the name, platform, version, created date, Download, and Served.
- Download returns the language files frozen on that release.
- Served chooses an existing release for that platform. The other platform stays as it is.
- If that change fails, the previous production release stays in place.



## Future iteration

Automatic translation with help of AI, placeholder validation, and conflict merging, Enabling language from OTA.