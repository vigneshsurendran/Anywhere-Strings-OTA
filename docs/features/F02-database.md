# F02 — Database

Status: implemented. Node 20 does not provide `node:sqlite`, so the server uses `better-sqlite3`. The catalog file remains `data/publisher.sqlite`.
Read [MVP](../MVP.md), [PRD](../PRD.md), and [technical plan](../TECHNICAL_PLAN.md).

## Decisions

The working set lives in a SQLite file, `data/publisher.sqlite`, ignored by
Git. Server code opens it. The browser never receives a database path or a
raw SQL result that includes anything beyond the catalog rows a later screen
asks for.

The schema below is the working copy behind the Editor. Releases are a separate pair of tables, added with F11. There is no build snapshot in the product.

```sql
CREATE TABLE languages (
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  locale TEXT NOT NULL,
  PRIMARY KEY (platform, locale)
);

CREATE TABLE translation_keys (
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  key TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (platform, key)
);

CREATE TABLE translation_values (
  platform TEXT NOT NULL,
  locale TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (platform, locale, key),
  FOREIGN KEY (platform, locale) REFERENCES languages (platform, locale),
  FOREIGN KEY (platform, key) REFERENCES translation_keys (platform, key)
);
```

`updated_at` is the latest saved change for that key, stored as UTC text. Opening an older catalog adds the column when it is missing. Keys already stored start with an empty time.

An empty string is a stored value. A missing `translation_values` row means
that key is absent from that language. The same key name on Android and iOS
is two rows. Opening the database creates the file and the tables when they
are absent. Opening the database does not read or write Cloud Storage.

## Acceptance criteria

- The server can open the database and create the three tables.
- A second open does not destroy existing rows.
- The file is not committed.
- Opening the database does not write to Cloud Storage.

## Verification

Test schema creation on a temporary file, a second open that keeps inserted
rows, and the empty-string value. Run the unit tests, lint, the production
build, and `tsc --noEmit`.
