import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS languages (
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  locale TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (platform, locale)
);

CREATE TABLE IF NOT EXISTS translation_keys (
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  key TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (platform, key)
);

CREATE TABLE IF NOT EXISTS translation_values (
  platform TEXT NOT NULL,
  locale TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (platform, locale, key),
  FOREIGN KEY (platform, locale) REFERENCES languages (platform, locale),
  FOREIGN KEY (platform, key) REFERENCES translation_keys (platform, key)
);

CREATE TABLE IF NOT EXISTS builds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS build_values (
  build_id INTEGER NOT NULL REFERENCES builds (id),
  locale TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (build_id, locale, key)
);

CREATE TABLE IF NOT EXISTS releases (
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

CREATE TABLE IF NOT EXISTS release_files (
  release_id INTEGER NOT NULL REFERENCES releases (id),
  locale TEXT NOT NULL,
  body TEXT NOT NULL,
  checksum TEXT NOT NULL,
  object_name TEXT NOT NULL,
  PRIMARY KEY (release_id, locale)
);

CREATE TABLE IF NOT EXISTS access (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TEXT NOT NULL
);
`;

export type CatalogDatabase = Database.Database;

export function databasePath() {
  return process.env.PUBLISHER_DATABASE_PATH ?? path.join(process.cwd(), "data", "publisher.sqlite");
}

export function openDatabase(filePath = databasePath()) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  const columns = db.prepare("PRAGMA table_info(languages)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "label")) {
    db.exec("ALTER TABLE languages ADD COLUMN label TEXT NOT NULL DEFAULT ''");
  }
  const keyColumns = db.prepare("PRAGMA table_info(translation_keys)").all() as { name: string }[];
  if (!keyColumns.some((column) => column.name === "updated_at")) {
    db.exec("ALTER TABLE translation_keys ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
  }
  seedAdminEmails(db);
  return db;
}

function seedAdminEmails(db: Database.Database) {
  const insert = db.prepare(`
    INSERT INTO access (email, role, created_at) VALUES (?, 'admin', ?)
    ON CONFLICT(email) DO UPDATE SET role = 'admin'
  `);
  const now = new Date().toISOString();
  for (const part of (process.env.AUTH_ADMIN_EMAILS ?? "").split(",")) {
    const email = part.trim().toLowerCase();
    if (!/^[^@\s]+@anywhere\.co$/i.test(email)) continue;
    insert.run(email, now);
  }
}

export function withDatabase<T>(fn: (db: CatalogDatabase) => T, filePath = databasePath()): T {
  const db = openDatabase(filePath);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

export async function withDatabaseAsync<T>(fn: (db: CatalogDatabase) => Promise<T>, filePath = databasePath()): Promise<T> {
  const db = openDatabase(filePath);
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}
