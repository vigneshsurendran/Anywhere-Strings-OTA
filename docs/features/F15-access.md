# F15 — Access

Status: implemented. Depends on F01 and F02.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

Google sign-in still requires a verified email, as in [F01](F01-authentication.md). F15 adds a second check: that email must have a row in the access table. The role on the row is `admin` or `user`. A hosted-domain hint, a client claim, and a verified Anywhere address with no row do not grant access.

Both roles can use Editor and Releases: import, edit, search, delete, add a language, add a key, create a release, download, and set a release as served. Only an admin can open Access and change who is listed.

Access is a third destination in the header, after Editor and Releases. The header shows it to an admin. A person with the `user` role does not see it. Opening `/access` directly without an admin row is access denied.

The page lists each email and its role. The admin can add an email, change a role, or remove a row. Add asks for the email and a role. The role defaults to `user`. The email is stored in lowercase. A duplicate email is rejected and writes nothing. An email that fails the same domain rule as sign-in is rejected and writes nothing.

The last admin cannot be removed or changed to `user`. That request writes nothing.

`AUTH_ADMIN_EMAILS` is a comma-separated list of verified `@anywhere.co` addresses. Opening the database sets each valid address to `admin`. Those rows stay admins on later opens. Blank entries are ignored. An entry that is not an `@anywhere.co` email is ignored. An empty list does not delete existing rows.

When `AUTH_ALLOW_ANY_VERIFIED_EMAIL` is on and the access table has no rows, the first successful local sign-in is stored as `admin`. That path does not run in production. Production with no access rows and no valid `AUTH_ADMIN_EMAILS` denies every account.

Every protected server operation reads the access row itself. The browser cannot supply the role. Removing a person or changing a role takes effect on the next request, including while the existing session cookie has not yet expired. Errors name the problem and do not include credentials or provider payloads.

```sql
CREATE TABLE access (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TEXT NOT NULL
);
```

Access changes the access table only. The working set, releases, and Cloud Storage stay as they are.

## Acceptance criteria

- A signed-out user cannot open Access or change the list.
- A verified Anywhere account with no access row is denied, including after a previously valid session.
- An admin sees Access in the header and can add, change, and remove rows.
- A user can use Editor and Releases and cannot open Access or change the list.
- A duplicate email or an email outside the sign-in domain writes nothing.
- The last admin cannot be removed or changed to `user`.
- Addresses in `AUTH_ADMIN_EMAILS` are admins after the database opens.
- Editor and Releases data, existing releases, and the bucket are unchanged by an access change.

## Verification

Test an allowed admin, a listed user, a verified Anywhere account with no row, a duplicate add, an invalid email, removal of the last admin, a seeded admin address, and an unauthenticated request. Run the unit tests, lint, the production build, and `tsc --noEmit`.
