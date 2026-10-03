import { describe, expect, it } from "vitest";
import { keepsPlaceholders } from "@/src/features/catalog/placeholders";
import { addLanguage } from "@/src/server/catalog";
import { addSupportedLanguage } from "@/src/server/supported-language";
import type { TranslationEntry } from "@/src/server/translate";
import { temporaryDatabase, valueOf } from "../helpers/database";

const csv = "key,value\nhello,Hola\n";

function seedEnglish() {
  const temp = temporaryDatabase();
  temp.db.prepare("INSERT INTO languages (platform, locale, label) VALUES ('android', 'en', 'English'), ('ios', 'en', 'English')").run();
  temp.db.prepare("INSERT INTO translation_keys (platform, key) VALUES ('android', 'hello'), ('android', 'count'), ('ios', 'hello')").run();
  temp.db.prepare(`
    INSERT INTO translation_values (platform, locale, key, value) VALUES
      ('android', 'en', 'hello', 'Hello'),
      ('android', 'en', 'count', 'You have %1$s'),
      ('ios', 'en', 'hello', 'Hi')
  `).run();
  return temp;
}

const identity = async (_locale: string, entries: TranslationEntry[]) => Object.fromEntries(entries.map((entry) => [entry.key, entry.text]));

describe("supported languages", () => {
  it("keeps placeholders in order", () => {
    expect(keepsPlaceholders("You have %1$s and {name}", "Tienes %1$s y {name}")).toBe(true);
    expect(keepsPlaceholders("You have %1$s", "Tienes")).toBe(false);
  });

  it("adds the language on both platforms from each platform's English text", async () => {
    const temp = seedEnglish();
    const translate = async (_locale: string, entries: TranslationEntry[]) => {
      const translated: Record<string, string> = {};
      if (entries.some((entry) => entry.key === "hello" && entry.text === "Hello")) translated.hello = "Hola";
      if (entries.some((entry) => entry.key === "count")) translated.count = "Tienes %1$s";
      return translated;
    };
    await addSupportedLanguage(temp.db, "es", "translate", null, translate);
    expect(valueOf(temp.db, "android", "es", "hello")?.value).toBe("Hola");
    expect(valueOf(temp.db, "android", "es", "count")?.value).toBe("Tienes %1$s");
    expect(valueOf(temp.db, "ios", "es", "hello")?.value).toBe("Hi");
    expect(valueOf(temp.db, "android", "en", "hello")?.value).toBe("Hello");
    temp.close();
  });

  it("fills only the platform that is missing and leaves the stored platform alone", async () => {
    const temp = seedEnglish();
    addLanguage(temp.db, "android", "es", "Spanish");
    temp.db.prepare("UPDATE translation_values SET value = 'Reviewed' WHERE platform = 'android' AND locale = 'es' AND key = 'hello'").run();
    await addSupportedLanguage(temp.db, "es", "translate", null, identity);
    expect(valueOf(temp.db, "android", "es", "hello")?.value).toBe("Reviewed");
    expect(valueOf(temp.db, "ios", "es", "hello")?.value).toBe("Hi");
    temp.close();
  });

  it("keeps English when translation fails or drops a placeholder", async () => {
    const temp = seedEnglish();
    await addSupportedLanguage(temp.db, "de", "translate", null, async () => { throw new Error("translator down"); });
    expect(valueOf(temp.db, "android", "de", "hello")?.value).toBe("Hello");
    expect(valueOf(temp.db, "android", "de", "count")?.value).toBe("You have %1$s");
    temp.close();

    const again = seedEnglish();
    await addSupportedLanguage(again.db, "de", "translate", null, async () => ({ hello: "Hallo", count: "Du hast" }));
    expect(valueOf(again.db, "android", "de", "hello")?.value).toBe("Hallo");
    expect(valueOf(again.db, "android", "de", "count")?.value).toBe("You have %1$s");
    again.close();
  });

  it("replaces only keys in a valid import and writes nothing for an invalid file", async () => {
    const temp = seedEnglish();
    await expect(addSupportedLanguage(temp.db, "es", "import", { filename: "bad.csv", text: "name,text\nhello,Hola\n" }, identity))
      .rejects.toThrow(/Nothing was imported/);
    expect(temp.db.prepare("SELECT locale FROM languages WHERE locale = 'es'").all()).toEqual([]);

    await addSupportedLanguage(temp.db, "es", "import", { filename: "es.csv", text: csv }, identity);
    expect(valueOf(temp.db, "android", "es", "hello")?.value).toBe("Hola");
    expect(valueOf(temp.db, "android", "es", "count")?.value).toBe("You have %1$s");
    expect(valueOf(temp.db, "ios", "es", "hello")?.value).toBe("Hola");
    await expect(addSupportedLanguage(temp.db, "es", "import", { filename: "es.csv", text: csv }, identity))
      .rejects.toThrow(/already stored/);
    expect(valueOf(temp.db, "android", "es", "hello")?.value).toBe("Hola");
    temp.close();
  });

  it("adds the language only on platforms that already have English", async () => {
    const temp = temporaryDatabase();
    temp.db.prepare("INSERT INTO languages (platform, locale, label) VALUES ('android', 'en', 'English')").run();
    temp.db.prepare("INSERT INTO translation_keys (platform, key) VALUES ('android', 'hello')").run();
    temp.db.prepare("INSERT INTO translation_values (platform, locale, key, value) VALUES ('android', 'en', 'hello', 'Hello')").run();
    const added = await addSupportedLanguage(temp.db, "fr", "translate", null, identity);
    expect(added).toEqual(["android"]);
    expect(valueOf(temp.db, "android", "fr", "hello")?.value).toBe("Hello");
    expect(temp.db.prepare("SELECT locale FROM languages WHERE platform = 'ios'").all()).toEqual([]);
    temp.close();
  });

  it("names the platform that still needs English when the language is already stored on the other", async () => {
    const temp = temporaryDatabase();
    temp.db.prepare("INSERT INTO languages (platform, locale, label) VALUES ('android', 'en', 'English'), ('android', 'es', 'Spanish')").run();
    temp.db.prepare("INSERT INTO translation_keys (platform, key) VALUES ('android', 'hello')").run();
    temp.db.prepare("INSERT INTO translation_values (platform, locale, key, value) VALUES ('android', 'en', 'hello', 'Hello'), ('android', 'es', 'hello', 'Hola')").run();
    await expect(addSupportedLanguage(temp.db, "es", "translate", null, identity)).rejects.toThrow(/Add English to iOS/);
    expect(valueOf(temp.db, "android", "es", "hello")?.value).toBe("Hola");
    temp.close();
  });

  it("writes nothing when English is not stored", async () => {
    const temp = temporaryDatabase();
    await expect(addSupportedLanguage(temp.db, "es", "translate", null, identity)).rejects.toThrow(/English/);
    expect(temp.db.prepare("SELECT COUNT(*) AS count FROM languages").get()).toEqual({ count: 0 });
    temp.close();
  });

  it("does not change an existing release", async () => {
    const temp = seedEnglish();
    temp.db.prepare(`
      INSERT INTO releases (platform, version, name, created_at, created_by, is_production)
      VALUES ('android', 1, 'Current', '2026-01-01T00:00:00.000Z', 'person@anywhere.co', 1)
    `).run();
    await addSupportedLanguage(temp.db, "fr", "translate", null, identity);
    expect(temp.db.prepare("SELECT name, is_production FROM releases").get()).toEqual({ name: "Current", is_production: 1 });
    expect(temp.db.prepare("SELECT COUNT(*) AS count FROM release_files").get()).toEqual({ count: 0 });
    temp.close();
  });
});
