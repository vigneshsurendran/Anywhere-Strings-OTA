import { describe, expect, it } from "vitest";
import { parseImportFile } from "@/src/features/import/parse";
import { deleteKeys, importTranslations, listRows } from "@/src/server/catalog";
import { loadEditor } from "@/src/server/editor";
import { temporaryDatabase, valueOf } from "../helpers/database";

const csv = "key,value\nhello,Hello\nempty,\nspaced,  spaced  \nhello,Last\n";
const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="hello">Hello</string>
  <string name="quote">Say &quot;hi&quot;</string>
  <string name="blank"></string>
  <!-- <string name="hidden">no</string> -->
  <string name="hello">Last</string>
</resources>`;
const json = `{
  "strings": {
    "hello": "Hello",
    "empty": "",
    "hello": "Last"
  }
}`;

function importFile(filename: string, text: string, platform: "android" | "ios" = "android", locale = "en") {
  const temp = temporaryDatabase();
  const count = importTranslations(temp.db, platform, locale, filename, text);
  return { temp, count };
}

describe("import", () => {
  it("parses CSV, Android XML, and JSON, keeping the last repeated value and empty strings", () => {
    expect(parseImportFile("en.csv", csv)).toEqual([
      { key: "hello", value: "Last" },
      { key: "empty", value: "" },
      { key: "spaced", value: "  spaced  " },
    ]);
    expect(parseImportFile("strings.xml", xml)).toEqual([
      { key: "hello", value: "Last" },
      { key: "quote", value: "Say \"hi\"" },
      { key: "blank", value: "" },
    ]);
    expect(parseImportFile("en.json", json)).toEqual([
      { key: "hello", value: "Last" },
      { key: "empty", value: "" },
    ]);
    expect(parseImportFile("en.json", '[{"hello":"Hello"},{"empty":""},{"hello":"Last"}]')).toEqual([
      { key: "hello", value: "Last" },
      { key: "empty", value: "" },
    ]);
    expect(parseImportFile("en.json", '[{"key":"hello","value":"Hello"},{"key":"empty","value":""}]')).toEqual([
      { key: "hello", value: "Hello" },
      { key: "empty", value: "" },
    ]);
  });

  it.each([
    ["en.csv", csv],
    ["strings.xml", xml],
    ["en.json", json],
  ])("writes %s only for the chosen platform and locale", (filename, text) => {
    const { temp } = importFile("seed.csv", "key,value\nkeep,Android\n", "android", "fr");
    importTranslations(temp.db, "ios", "en", "seed.csv", "key,value\nhello,iOS\n");
    importTranslations(temp.db, "android", "en", filename, text);
    expect(valueOf(temp.db, "android", "en", "hello")?.value).toBe("Last");
    expect(valueOf(temp.db, "android", "fr", "keep")?.value).toBe("Android");
    expect(valueOf(temp.db, "ios", "en", "hello")?.value).toBe("iOS");
    expect(listRows(temp.db, "android", "en").map((row) => row.key)).toContain("keep");
    temp.close();
  });

  it("replaces one locale and leaves keys missing from the file in place", () => {
    const { temp } = importFile("en.csv", "key,value\nhello,One\nother,Stay\n");
    importTranslations(temp.db, "android", "fr", "fr.csv", "key,value\nhello,French\n");
    importTranslations(temp.db, "android", "en", "en.csv", "key,value\nhello,Two\n");
    expect(valueOf(temp.db, "android", "en", "hello")?.value).toBe("Two");
    expect(valueOf(temp.db, "android", "en", "other")?.value).toBe("Stay");
    expect(valueOf(temp.db, "android", "fr", "hello")?.value).toBe("French");
    temp.close();
  });

  it("writes nothing when the file is invalid", () => {
    const { temp } = importFile("en.csv", "key,value\nhello,Hello\n");
    const before = temp.db.prepare("SELECT COUNT(*) AS count FROM translation_values").get() as { count: number };
    expect(() => importTranslations(temp.db, "android", "de", "bad.json", "{\"strings\":{\"\": \"x\"}}")).toThrow(/Nothing was imported/);
    expect(() => importTranslations(temp.db, "android", "de", "bad.csv", "key,value\n" + `${"k".repeat(501)},x\n`)).toThrow(/Nothing was imported/);
    expect(() => importTranslations(temp.db, "android", "de", "bad.csv", "name,text\nhello,Hello\n")).toThrow(/Nothing was imported/);
    expect(temp.db.prepare("SELECT locale FROM languages ORDER BY locale").all()).toEqual([{ locale: "en" }]);
    expect(temp.db.prepare("SELECT COUNT(*) AS count FROM translation_values").get()).toEqual(before);
    temp.close();
  });

  it("rejects a locale that is not in the catalog before writing", () => {
    const temp = temporaryDatabase();
    expect(() => importTranslations(temp.db, "android", "english", "en.csv", "key,value\nhello,Hello\n")).toThrow(/Nothing was saved/);
    expect(() => importTranslations(temp.db, "android", "pt-BR", "en.csv", "key,value\nhello,Hello\n")).toThrow(/catalog/);
    expect(temp.db.prepare("SELECT COUNT(*) AS count FROM languages").get()).toEqual({ count: 0 });
    temp.close();
  });

  it("adds a missing catalog language with empty values, then applies the file on that platform only", () => {
    const { temp } = importFile("en.csv", "key,value\nhello,Hello\nother,Stay\n");
    importTranslations(temp.db, "android", "de", "de.csv", "key,value\nhello,Hallo\n");
    expect(valueOf(temp.db, "android", "de", "hello")?.value).toBe("Hallo");
    expect(valueOf(temp.db, "android", "de", "other")?.value).toBe("");
    expect(valueOf(temp.db, "android", "en", "hello")?.value).toBe("Hello");
    expect(valueOf(temp.db, "ios", "de", "hello")).toBeUndefined();
    temp.close();
  });

  it("writes a new English key only in English", () => {
    const { temp } = importFile("en.csv", "key,value\nhello,Hello\n");
    importTranslations(temp.db, "android", "fr", "fr.csv", "key,value\nhello,Bonjour\n");
    importTranslations(temp.db, "android", "en", "en.csv", "key,value\nhello,Hello\nnext,Next\n");
    expect(valueOf(temp.db, "android", "en", "next")?.value).toBe("Next");
    expect(valueOf(temp.db, "android", "fr", "hello")?.value).toBe("Bonjour");
    expect(valueOf(temp.db, "android", "fr", "next")).toBeUndefined();
    temp.close();
  });

  it("does not restore other languages when English is imported after every key is deleted", () => {
    const { temp } = importFile("en.csv", "key,value\nhello,Hello\n");
    importTranslations(temp.db, "android", "es", "es.csv", "key,value\nhello,Hola\n");
    deleteKeys(temp.db, "android", ["hello"]);
    expect(temp.db.prepare("SELECT locale FROM languages WHERE platform = 'android'").all()).toEqual([]);
    importTranslations(temp.db, "android", "en", "en.csv", "key,value\nhello,Hello again\n");
    expect(valueOf(temp.db, "android", "en", "hello")?.value).toBe("Hello again");
    expect(temp.db.prepare("SELECT locale FROM languages WHERE platform = 'android' ORDER BY locale").all()).toEqual([{ locale: "en" }]);
    temp.close();
  });

  it("keeps a language that still has strings after a partial delete", () => {
    const { temp } = importFile("en.csv", "key,value\nhello,Hello\nother,Stay\n");
    importTranslations(temp.db, "android", "es", "es.csv", "key,value\nhello,Hola\nother,Otro\n");
    deleteKeys(temp.db, "android", ["hello"]);
    expect(temp.db.prepare("SELECT locale FROM languages WHERE platform = 'android' ORDER BY locale").all()).toEqual([
      { locale: "en" },
      { locale: "es" },
    ]);
    expect(valueOf(temp.db, "android", "es", "other")?.value).toBe("Otro");
    temp.close();
  });

  it("drops leftover empty languages when the editor loads", () => {
    const { temp } = importFile("en.csv", "key,value\nhello,Hello\n");
    temp.db.prepare("INSERT INTO languages (platform, locale, label) VALUES ('android', 'es', 'Spanish'), ('android', 'ja', 'Japanese')").run();
    const editor = loadEditor(temp.db, "android");
    expect(editor.languages.map((language) => language.code)).toEqual(["en"]);
    temp.close();
  });
});
