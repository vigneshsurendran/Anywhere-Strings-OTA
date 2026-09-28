import type { CatalogDatabase } from "@/src/server/database";
import { catalogLanguage, isCatalogLanguage } from "@/src/features/catalog/languages";
import { keepsPlaceholders } from "@/src/features/catalog/placeholders";
import { parseImportFile } from "@/src/features/import/parse";
import {
  InputError,
  assertAddedKey,
  assertLocale,
  assertStoredValue,
  isPlatform,
  type Platform,
} from "@/src/features/catalog/validation";

export type TranslationRow = {
  key: string;
  value: string | null;
};

type ExistingValue = { value: string };

export function listLanguages(db: CatalogDatabase, platform: Platform) {
  return db.prepare("SELECT locale, label FROM languages WHERE platform = ? ORDER BY locale")
    .all(platform) as { locale: string; label: string }[];
}

export function listRows(db: CatalogDatabase, platform: Platform, locale: string): TranslationRow[] {
  return db.prepare(`
    SELECT k.key AS key, v.value AS value
    FROM translation_keys k
    LEFT JOIN translation_values v
      ON v.platform = k.platform AND v.key = k.key AND v.locale = ?
    WHERE k.platform = ?
    ORDER BY k.key
  `).all(locale, platform) as TranslationRow[];
}

export function importTranslations(db: CatalogDatabase, platform: Platform, locale: string, filename: string, text: string) {
  if (!isCatalogLanguage(locale)) throw new InputError("Choose a language from the catalog. Nothing was saved.");
  const pairs = parseImportFile(filename, text);
  const apply = db.transaction(() => {
    const existing = db.prepare("SELECT locale FROM languages WHERE platform = ? AND locale = ?").get(platform, locale);
    if (!existing) {
      const label = catalogLanguage(locale)?.name ?? "";
      db.prepare("INSERT INTO languages (platform, locale, label) VALUES (?, ?, ?)").run(platform, locale, label);
      const keys = db.prepare("SELECT key FROM translation_keys WHERE platform = ?").all(platform) as { key: string }[];
      const blank = db.prepare("INSERT INTO translation_values (platform, locale, key, value) VALUES (?, ?, ?, ?)");
      for (const key of keys) blank.run(platform, locale, key.key, "");
    }
    const insertKey = db.prepare("INSERT INTO translation_keys (platform, key) VALUES (?, ?) ON CONFLICT DO NOTHING");
    const upsert = db.prepare(`
      INSERT INTO translation_values (platform, locale, key, value)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (platform, locale, key) DO UPDATE SET value = excluded.value
    `);
    const modified = new Date().toISOString();
    for (const pair of pairs) {
      insertKey.run(platform, pair.key);
      upsert.run(platform, locale, pair.key, pair.value);
    }
    markKeysModified(db, platform, pairs.map((pair) => pair.key), modified);
  });
  apply();
  return pairs.length;
}

export function saveValue(db: CatalogDatabase, platform: Platform, locale: string, key: string, value: string) {
  assertStoredValue(value);
  const language = db.prepare("SELECT locale FROM languages WHERE platform = ? AND locale = ?").get(platform, locale);
  const translationKey = db.prepare("SELECT key FROM translation_keys WHERE platform = ? AND key = ?").get(platform, key);
  if (!language || !translationKey) throw new InputError("That language or key is not in the working set. Nothing was saved.");
  const existing = db.prepare("SELECT value FROM translation_values WHERE platform = ? AND locale = ? AND key = ?")
    .get(platform, locale, key) as ExistingValue | undefined;
  if (existing && existing.value === value) return "unchanged" as const;
  db.prepare(`
    INSERT INTO translation_values (platform, locale, key, value)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (platform, locale, key) DO UPDATE SET value = excluded.value
  `).run(platform, locale, key, value);
  markKeysModified(db, platform, [key], new Date().toISOString());
  return "saved" as const;
}

export function addLanguage(db: CatalogDatabase, platform: Platform, locale: string, label = "") {
  assertLocale(locale);
  const existing = db.prepare("SELECT locale FROM languages WHERE platform = ? AND locale = ?").get(platform, locale);
  if (existing) throw new InputError("That language is already on this platform. Nothing was saved.");
  const keys = db.prepare("SELECT key FROM translation_keys WHERE platform = ? ORDER BY key").all(platform) as { key: string }[];
  const apply = db.transaction(() => {
    db.prepare("INSERT INTO languages (platform, locale, label) VALUES (?, ?, ?)").run(platform, locale, label.trim());
    const insert = db.prepare("INSERT INTO translation_values (platform, locale, key, value) VALUES (?, ?, ?, ?)");
    for (const entry of keys) insert.run(platform, locale, entry.key, "");
  });
  try {
    apply();
  } catch (error) {
    if (isConstraint(error)) throw new InputError("That language is already on this platform. Nothing was saved.");
    throw error;
  }
}

type KeyTranslator = (locale: string, entries: { key: string; text: string }[]) => Promise<Record<string, string>>;

export async function addKeyWithValue(
  db: CatalogDatabase,
  platform: Platform,
  key: string,
  value: string,
  translate: boolean,
  translateText: KeyTranslator,
) {
  assertStoredValue(value);
  assertAddedKey(key);
  const existing = db.prepare("SELECT key FROM translation_keys WHERE platform = ? AND key = ?").get(platform, key);
  if (existing) throw new InputError("That key is already on this platform. Nothing was saved.");
  const locales = db.prepare("SELECT locale FROM languages WHERE platform = ? ORDER BY locale").all(platform) as { locale: string }[];
  const english = locales.find((entry) => entry.locale.toLowerCase() === "en");
  const initial: Record<string, string> = {};
  if (english) {
    initial[english.locale] = value;
    const others = locales.filter((entry) => entry.locale.toLowerCase() !== "en");
    if (translate && value !== "" && others.length > 0) {
      await Promise.all(others.map(async (entry) => {
        let translated = "";
        try {
          const result = await translateText(entry.locale, [{ key, text: value }]);
          translated = result[key] ?? "";
        } catch {
          translated = "";
        }
        initial[entry.locale] = translated.trim() !== "" && keepsPlaceholders(value, translated) ? translated : value;
      }));
    }
  } else {
    for (const entry of locales) initial[entry.locale] = value;
  }
  addKey(db, platform, key, initial);
}

export function addKey(db: CatalogDatabase, platform: Platform, key: string, initial: Record<string, string> = {}) {
  assertAddedKey(key);
  for (const value of Object.values(initial)) assertStoredValue(value);
  const existing = db.prepare("SELECT key FROM translation_keys WHERE platform = ? AND key = ?").get(platform, key);
  if (existing) throw new InputError("That key is already on this platform. Nothing was saved.");
  const locales = db.prepare("SELECT locale FROM languages WHERE platform = ? ORDER BY locale").all(platform) as { locale: string }[];
  const apply = db.transaction(() => {
    db.prepare("INSERT INTO translation_keys (platform, key, updated_at) VALUES (?, ?, ?)").run(platform, key, new Date().toISOString());
    const insert = db.prepare("INSERT INTO translation_values (platform, locale, key, value) VALUES (?, ?, ?, ?)");
    for (const entry of locales) insert.run(platform, entry.locale, key, initial[entry.locale] ?? "");
  });
  try {
    apply();
  } catch (error) {
    if (isConstraint(error)) throw new InputError("That key is already on this platform. Nothing was saved.");
    throw error;
  }
}

export function deleteKeys(db: CatalogDatabase, platform: Platform, keys: string[]) {
  const names = [...new Set(keys.map((key) => key.trim()).filter((key) => key.length > 0))];
  if (names.length === 0) throw new InputError("Choose at least one key. Nothing was deleted.");
  const removeValues = db.prepare("DELETE FROM translation_values WHERE platform = ? AND key = ?");
  const removeKey = db.prepare("DELETE FROM translation_keys WHERE platform = ? AND key = ?");
  const apply = db.transaction(() => {
    for (const key of names) {
      removeValues.run(platform, key);
      removeKey.run(platform, key);
    }
    removeLanguagesWithoutValues(db, platform);
  });
  apply();
  return names.length;
}

export function removeLanguagesWithoutValues(db: CatalogDatabase, platform: Platform) {
  db.prepare(`
    DELETE FROM languages
    WHERE platform = ?
      AND locale NOT IN (SELECT locale FROM translation_values WHERE platform = ?)
  `).run(platform, platform);
}

export function readPlatform(value: unknown): Platform {
  if (!isPlatform(value)) throw new InputError("Choose Android or iOS.");
  return value;
}

export function markKeysModified(db: CatalogDatabase, platform: Platform, keys: Iterable<string>, at: string) {
  const update = db.prepare("UPDATE translation_keys SET updated_at = ? WHERE platform = ? AND key = ?");
  for (const key of keys) update.run(at, platform, key);
}

function isConstraint(error: unknown) {
  return error instanceof Error && "code" in error && String(error.code).startsWith("SQLITE_CONSTRAINT");
}
