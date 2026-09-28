# F04 — Show translations

Status: implemented. The screen matches the Figma Editor frame. Depends on F03.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

The Editor opens on All and lists every saved key. The platform menu chooses
All, iOS, or Android. Each key is a card. The card shows every language of
that platform, with the language name and the value. In All, the card shows that platform’s icon below the key.
A missing value uses the placeholder Empty. An empty
string is a stored value and also shows that placeholder until the field has
text. Choosing a platform does not change the other platform.

When the chosen view has no languages, the screen says the catalog is empty.
All is empty only when both platforms have no languages.
Save, import, and delete are separate features. Showing the list does not
write the database or Cloud Storage.

## Acceptance criteria

- A signed-out user is sent to sign-in.
- All is the default and shows both platforms. Each card shows every language of its platform.
- Android and iOS rows that share a key name stay separate.
- An empty catalog shows the empty state.
- Viewing the cards does not change a value.

## Verification

Test an empty database, one platform with two languages, and a shared key name
on both platforms. Run the unit tests, lint, the production build, and
`tsc --noEmit`.
