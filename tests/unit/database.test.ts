import { afterEach, describe, expect, it } from "vitest";
import { databasePath, openDatabase } from "@/src/server/database";
import { temporaryDatabase, valueOf } from "../helpers/database";

const opened: { close(): void }[] = [];

afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

describe("working set database", () => {
  it("creates the working-set tables on a new file", () => {
    const temp = temporaryDatabase();
    opened.push(temp);
    const names = temp.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];
    expect(names.map((entry) => entry.name)).toEqual([
      "access",
      "build_values",
      "builds",
      "languages",
      "release_files",
      "releases",
      "translation_keys",
      "translation_values",
    ]);
  });

  it("keeps inserted rows, including an empty string, when opened again", () => {
    const temp = temporaryDatabase();
    temp.db.prepare("INSERT INTO languages (platform, locale) VALUES ('android', 'en')").run();
    temp.db.prepare("INSERT INTO translation_keys (platform, key) VALUES ('android', 'hello')").run();
    temp.db.prepare("INSERT INTO translation_values (platform, locale, key, value) VALUES ('android', 'en', 'hello', '')").run();
    temp.db.close();
    const again = openDatabase(temp.file);
    expect(valueOf(again, "android", "en", "hello")).toEqual({ value: "" });
    again.close();
    temp.close();
  });

  it("adds last-modified time to a catalog created before that column existed", () => {
    const temp = temporaryDatabase();
    opened.push(temp);
    temp.db.prepare("INSERT INTO languages (platform, locale) VALUES ('android', 'en')").run();
    temp.db.prepare("INSERT INTO translation_keys (platform, key, updated_at) VALUES ('android', 'hello', '2026-01-01T00:00:00.000Z')").run();
    temp.db.exec("ALTER TABLE translation_keys DROP COLUMN updated_at");
    temp.db.close();
    const again = openDatabase(temp.file);
    try {
      const columns = again.prepare("PRAGMA table_info(translation_keys)").all() as { name: string }[];
      expect(columns.some((column) => column.name === "updated_at")).toBe(true);
      expect(again.prepare("SELECT updated_at FROM translation_keys WHERE key = 'hello'").get()).toEqual({ updated_at: "" });
    } finally {
      again.close();
    }
  });

  it("stores the catalog under data/publisher.sqlite unless a test path is set", () => {
    expect(databasePath().endsWith("/data/publisher.sqlite")).toBe(true);
  });
});
