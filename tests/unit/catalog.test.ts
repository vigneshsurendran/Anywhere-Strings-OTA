import { describe, expect, it } from "vitest";
import { compareModified, editorCellId, filterEditorRows, filterRows, indexEditorRows } from "@/src/features/catalog/filter";
import { addKey, addKeyWithValue, addLanguage, listLanguages, listRows, saveValue } from "@/src/server/catalog";
import { loadEditor } from "@/src/server/editor";
import { createBuild, listBuildValues, saveBuildValue } from "@/src/server/builds";
import { temporaryDatabase, valueOf } from "../helpers/database";

function seed() {
  const temp = temporaryDatabase();
  temp.db.prepare("INSERT INTO languages (platform, locale) VALUES ('android', 'en'), ('android', 'fr'), ('ios', 'en')").run();
  temp.db.prepare("INSERT INTO translation_keys (platform, key) VALUES ('android', 'hello'), ('android', 'other'), ('ios', 'hello')").run();
  temp.db.prepare(`
    INSERT INTO translation_values (platform, locale, key, value) VALUES
      ('android', 'en', 'hello', 'Hello'),
      ('android', 'fr', 'hello', 'Bonjour'),
      ('ios', 'en', 'hello', 'iOS')
  `).run();
  return temp;
}

describe("show translations", () => {
  it("returns an empty language list for an empty database", () => {
    const temp = temporaryDatabase();
    expect(listLanguages(temp.db, "android")).toEqual([]);
    expect(listRows(temp.db, "android", "en")).toEqual([]);
    temp.close();
  });

  it("lists one platform and language, and shows a missing value separately from an empty string", () => {
    const temp = seed();
    temp.db.prepare("INSERT INTO translation_values (platform, locale, key, value) VALUES ('android', 'en', 'other', '')").run();
    expect(listLanguages(temp.db, "android").map((entry) => entry.locale)).toEqual(["en", "fr"]);
    expect(listRows(temp.db, "android", "en")).toEqual([
      { key: "hello", value: "Hello" },
      { key: "other", value: "" },
    ]);
    expect(listRows(temp.db, "android", "fr")).toEqual([
      { key: "hello", value: "Bonjour" },
      { key: "other", value: null },
    ]);
    expect(listRows(temp.db, "ios", "en")).toEqual([{ key: "hello", value: "iOS" }]);
    const before = valueOf(temp.db, "android", "en", "hello");
    listRows(temp.db, "android", "en");
    expect(valueOf(temp.db, "android", "en", "hello")).toEqual(before);
    temp.close();
  });
});

describe("edit a value", () => {
  it("stores a changed value and an empty string without changing other rows", () => {
    const temp = seed();
    expect(saveValue(temp.db, "android", "en", "hello", "Hello")).toBe("unchanged");
    expect(saveValue(temp.db, "android", "en", "hello", "Updated")).toBe("saved");
    expect(saveValue(temp.db, "android", "fr", "other", "")).toBe("saved");
    expect(valueOf(temp.db, "android", "en", "hello")?.value).toBe("Updated");
    expect(valueOf(temp.db, "android", "fr", "hello")?.value).toBe("Bonjour");
    expect(valueOf(temp.db, "android", "fr", "other")?.value).toBe("");
    expect(valueOf(temp.db, "ios", "en", "hello")?.value).toBe("iOS");
    const saved = loadEditor(temp.db, "android");
    expect(saved.rows.find((row) => row.key === "hello")?.updatedAt).toMatch(/^\d{4}-/);
    expect(saved.rows.find((row) => row.key === "other")?.updatedAt).toMatch(/^\d{4}-/);
    expect(loadEditor(temp.db, "ios").rows.find((row) => row.key === "hello")?.updatedAt).toBe("");
    const again = saved.rows.find((row) => row.key === "hello")?.updatedAt;
    expect(saveValue(temp.db, "android", "en", "hello", "Updated")).toBe("unchanged");
    expect(loadEditor(temp.db, "android").rows.find((row) => row.key === "hello")?.updatedAt).toBe(again);
    temp.close();
  });

  it("rejects a value longer than 100000 characters and leaves the stored value", () => {
    const temp = seed();
    expect(() => saveValue(temp.db, "android", "en", "hello", "x".repeat(100_001))).toThrow(/not changed/);
    expect(valueOf(temp.db, "android", "en", "hello")?.value).toBe("Hello");
    temp.close();
  });
});

describe("search", () => {
  const rows = [
    { key: "Hello", value: "World" },
    { key: "other", value: "  Hello" },
    { key: "missing", value: null as string | null },
  ];

  it("matches a key or value without trimming stored text, and restores the list when cleared", () => {
    expect(filterRows(rows, "hell").map((row) => row.key)).toEqual(["Hello", "other"]);
    expect(filterRows(rows, "world").map((row) => row.key)).toEqual(["Hello"]);
    expect(filterRows(rows, "  hello").map((row) => row.key)).toEqual(["other"]);
    expect(filterRows(rows, "zzz")).toEqual([]);
    expect(filterRows(rows, "")).toEqual(rows);
  });

  it("matches editor keys, stored values, and unsaved drafts without scanning when the query is empty", () => {
    const editorRows = [
      { key: "greeting", values: { en: "Hello", fr: "Bonjour" } },
      { key: "farewell", values: { en: "Goodbye", fr: null } },
    ];
    const languages = [
      { code: "en", label: "English" },
      { code: "fr", label: "French" },
    ];
    const indexed = indexEditorRows(editorRows, languages);
    expect(filterEditorRows(editorRows, indexed, languages, "", {})).toBe(editorRows);
    expect(filterEditorRows(editorRows, indexed, languages, "GOOD", {}).map((row) => row.key)).toEqual(["farewell"]);
    expect(filterEditorRows(editorRows, indexed, languages, "bonjour", {}).map((row) => row.key)).toEqual(["greeting"]);
    const drafts = { [editorCellId("greeting", "fr")]: "Salut" };
    expect(filterEditorRows(editorRows, indexed, languages, "bonjour", drafts)).toEqual([]);
    expect(filterEditorRows(editorRows, indexed, languages, "salut", drafts).map((row) => row.key)).toEqual(["greeting"]);
    expect(filterEditorRows(editorRows, indexed, languages, "good", {}, "exact")).toEqual([]);
    expect(filterEditorRows(editorRows, indexed, languages, "Goodbye", {}, "exact").map((row) => row.key)).toEqual(["farewell"]);
    expect(filterEditorRows(editorRows, indexed, languages, "goodbye", {}, "exact").map((row) => row.key)).toEqual(["farewell"]);
    expect(filterEditorRows(editorRows, indexed, languages, "goodbye", {}, "exact", true)).toEqual([]);
    expect(filterEditorRows(editorRows, indexed, languages, "farewell", {}, "exact").map((row) => row.key)).toEqual(["farewell"]);
    expect(filterEditorRows(editorRows, indexed, languages, "Good", {}, "contains", true).map((row) => row.key)).toEqual(["farewell"]);
    expect(filterEditorRows(editorRows, indexed, languages, "good", {}, "contains", true)).toEqual([]);
    expect(compareModified("2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBeLessThan(0);
    expect(compareModified("", "2026-01-01T00:00:00.000Z")).toBeGreaterThan(0);
    expect(compareModified("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(0);
  });
});

describe("add a language", () => {
  it("adds an empty value for every existing key and allows the same locale on the other platform", () => {
    const temp = seed();
    addLanguage(temp.db, "android", "de");
    expect(listRows(temp.db, "android", "de")).toEqual([
      { key: "hello", value: "" },
      { key: "other", value: "" },
    ]);
    addLanguage(temp.db, "ios", "de");
    expect(valueOf(temp.db, "ios", "de", "hello")?.value).toBe("");
    expect(temp.db.prepare("SELECT key FROM translation_keys WHERE platform = 'ios'").all()).toEqual([{ key: "hello" }]);
    temp.close();
  });

  it("writes nothing for a duplicate or invalid locale", () => {
    const temp = seed();
    const count = () => temp.db.prepare("SELECT COUNT(*) AS count FROM translation_values").get();
    const before = count();
    expect(() => addLanguage(temp.db, "android", "en")).toThrow(/already/);
    expect(() => addLanguage(temp.db, "android", "1")).toThrow(/Nothing was saved/);
    expect(count()).toEqual(before);
    temp.close();
  });
});

describe("add a key", () => {
  it("adds an empty value on every language of that platform only", () => {
    const temp = seed();
    addKey(temp.db, "android", "welcome.title");
    expect(valueOf(temp.db, "android", "en", "welcome.title")?.value).toBe("");
    expect(valueOf(temp.db, "android", "fr", "welcome.title")?.value).toBe("");
    expect(temp.db.prepare("SELECT key FROM translation_keys WHERE platform = 'ios' AND key = 'welcome.title'").get()).toBeUndefined();
    temp.close();
  });

  it("stores a key when the platform has no language yet", () => {
    const temp = temporaryDatabase();
    addKey(temp.db, "ios", "first_key");
    expect(temp.db.prepare("SELECT key FROM translation_keys WHERE platform = 'ios'").all()).toEqual([{ key: "first_key" }]);
    expect(temp.db.prepare("SELECT COUNT(*) AS count FROM translation_values").get()).toEqual({ count: 0 });
    addLanguage(temp.db, "ios", "en");
    expect(valueOf(temp.db, "ios", "en", "first_key")?.value).toBe("");
    temp.close();
  });

  it("saves the English value and translates the other languages", async () => {
    const temp = seed();
    const locales: string[] = [];
    await addKeyWithValue(temp.db, "android", "welcome.title", "Hello", true, async (locale) => {
      locales.push(locale);
      return { "welcome.title": locale === "fr" ? "Bonjour" : "" };
    });
    expect(locales).toEqual(["fr"]);
    expect(valueOf(temp.db, "android", "en", "welcome.title")?.value).toBe("Hello");
    expect(valueOf(temp.db, "android", "fr", "welcome.title")?.value).toBe("Bonjour");
    expect(temp.db.prepare("SELECT key FROM translation_keys WHERE platform = 'ios' AND key = 'welcome.title'").get()).toBeUndefined();
    temp.close();
  });

  it("leaves other languages empty when AI translation is off", async () => {
    const temp = seed();
    const translate = async () => {
      throw new Error("should not translate");
    };
    await addKeyWithValue(temp.db, "android", "welcome.title", "Hello", false, translate);
    expect(valueOf(temp.db, "android", "en", "welcome.title")?.value).toBe("Hello");
    expect(valueOf(temp.db, "android", "fr", "welcome.title")?.value).toBe("");
    temp.close();
  });

  it("keeps the English text when a translation does not come back", async () => {
    const temp = seed();
    await addKeyWithValue(temp.db, "android", "welcome.title", "Hello %1$s", true, async () => ({ "welcome.title": "Bonjour" }));
    expect(valueOf(temp.db, "android", "fr", "welcome.title")?.value).toBe("Hello %1$s");
    temp.close();
  });

  it("copies the value to every language when English is missing", async () => {
    const temp = temporaryDatabase();
    temp.db.prepare("INSERT INTO languages (platform, locale) VALUES ('android', 'es'), ('android', 'fr')").run();
    await addKeyWithValue(temp.db, "android", "welcome_title", "Hola", true, async () => {
      throw new Error("should not translate");
    });
    expect(valueOf(temp.db, "android", "es", "welcome_title")?.value).toBe("Hola");
    expect(valueOf(temp.db, "android", "fr", "welcome_title")?.value).toBe("Hola");
    temp.close();
  });

  it("writes nothing for a duplicate or invalid key", () => {
    const temp = seed();
    const before = temp.db.prepare("SELECT COUNT(*) AS count FROM translation_keys").get();
    expect(() => addKey(temp.db, "android", "hello")).toThrow(/already/);
    expect(() => addKey(temp.db, "android", "1bad")).toThrow(/Nothing was saved/);
    expect(() => addKey(temp.db, "android", `${"a".repeat(201)}`)).toThrow(/Nothing was saved/);
    expect(temp.db.prepare("SELECT COUNT(*) AS count FROM translation_keys").get()).toEqual(before);
    temp.close();
  });
});

describe("build", () => {
  it("copies the platform as it is, then stays unchanged when the working set changes", () => {
    const temp = seed();
    const id = createBuild(temp.db, "android", "2026-09-28T15:04:00.123Z");
    saveValue(temp.db, "android", "en", "hello", "Changed");
    saveValue(temp.db, "android", "fr", "other", "New");
    expect(listBuildValues(temp.db, id)).toEqual([
      { locale: "en", key: "hello", value: "Hello" },
      { locale: "fr", key: "hello", value: "Bonjour" },
    ]);
    expect(saveBuildValue(temp.db, id, "en", "hello", "Snapshot")).toBe("saved");
    expect(valueOf(temp.db, "android", "en", "hello")?.value).toBe("Changed");
    expect(listBuildValues(temp.db, id)).toContainEqual({ locale: "en", key: "hello", value: "Snapshot" });
    temp.close();
  });

  it("rejects an edit after the snapshot is published", () => {
    const temp = seed();
    const id = createBuild(temp.db, "android");
    temp.db.prepare("UPDATE builds SET published_at = '2026-09-28T15:04:00.123Z' WHERE id = ?").run(id);
    expect(() => saveBuildValue(temp.db, id, "en", "hello", "Nope")).toThrow(/no longer be edited/);
    expect(listBuildValues(temp.db, id)[0]?.value).toBe("Hello");
    temp.close();
  });
});
