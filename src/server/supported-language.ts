import { parseImportFile, type TranslationPair } from "@/src/features/import/parse";
import { markKeysModified } from "@/src/server/catalog";
import { keepsPlaceholders } from "@/src/features/catalog/placeholders";
import { catalogLanguage, isCatalogLanguage } from "@/src/features/catalog/languages";
import { InputError, type Platform } from "@/src/features/catalog/validation";
import type { TranslationEntry } from "@/src/server/translate";
import type { CatalogDatabase } from "@/src/server/database";

export type SupportedMode = "translate" | "import";

type LanguageFile = {
  filename: string;
  text: string;
};

const PLATFORMS: Platform[] = ["android", "ios"];

export async function addSupportedLanguage(
  db: CatalogDatabase,
  locale: string,
  mode: SupportedMode,
  file: LanguageFile | null,
  translate: (locale: string, entries: TranslationEntry[]) => Promise<Record<string, string>>,
) {
  if (!isCatalogLanguage(locale) || locale === "en") {
    throw new InputError("Choose a language that is not already stored. Nothing was saved.");
  }
  const missing = PLATFORMS.filter((platform) => !hasLanguage(db, platform, locale));
  if (missing.length === 0) throw new InputError("That language is already stored. Nothing was saved.");
  const ready = missing.filter((platform) => hasLanguage(db, platform, "en"));
  if (ready.length === 0) {
    const names = missing.map(platformName).join(" and ");
    throw new InputError(`Add English to ${names} before adding this language there. Nothing was saved.`);
  }

  const pairs = mode === "import" ? readImport(file) : null;
  const drafts = new Map<Platform, { key: string; value: string }[]>();
  for (const platform of ready) {
    const english = englishValues(db, platform);
    drafts.set(platform, [...english.entries()].map(([key, value]) => ({ key, value })));
  }
  if (mode === "translate") {
    for (const platform of ready) {
      const rows = drafts.get(platform) ?? [];
      let translated: Record<string, string> = {};
      try {
        translated = await translate(locale, rows.map((row) => ({ key: row.key, text: row.value })));
      } catch {
        translated = {};
      }
      for (const row of rows) {
        const next = translated[row.key];
        if (typeof next === "string" && next.trim() !== "" && keepsPlaceholders(row.value, next)) row.value = next;
      }
    }
  }

  const label = catalogLanguage(locale)?.name ?? "";
  const modified = new Date().toISOString();
  const apply = db.transaction(() => {
    for (const platform of ready) {
      if (hasLanguage(db, platform, locale)) throw new InputError("That language is already stored. Nothing was saved.");
      db.prepare("INSERT INTO languages (platform, locale, label) VALUES (?, ?, ?)").run(platform, locale, label);
      const insert = db.prepare("INSERT INTO translation_values (platform, locale, key, value) VALUES (?, ?, ?, ?)");
      const keys = new Set<string>();
      for (const row of drafts.get(platform) ?? []) {
        insert.run(platform, locale, row.key, row.value);
        keys.add(row.key);
      }
      if (pairs) {
        applyFile(db, platform, locale, pairs);
        for (const pair of pairs) keys.add(pair.key);
      }
      markKeysModified(db, platform, keys, modified);
    }
  });
  apply();
  return ready;
}

function platformName(platform: Platform) {
  return platform === "android" ? "Android" : "iOS";
}

function readImport(file: LanguageFile | null) {
  if (!file || file.text.trim() === "") throw new InputError("Choose a file to import. Nothing was saved.");
  return parseImportFile(file.filename, file.text);
}

function applyFile(db: CatalogDatabase, platform: Platform, locale: string, pairs: TranslationPair[]) {
  const insertKey = db.prepare("INSERT INTO translation_keys (platform, key) VALUES (?, ?) ON CONFLICT DO NOTHING");
  const upsert = db.prepare(`
    INSERT INTO translation_values (platform, locale, key, value)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (platform, locale, key) DO UPDATE SET value = excluded.value
  `);
  for (const pair of pairs) {
    insertKey.run(platform, pair.key);
    upsert.run(platform, locale, pair.key, pair.value);
  }
}

function hasLanguage(db: CatalogDatabase, platform: Platform, locale: string) {
  return Boolean(db.prepare("SELECT locale FROM languages WHERE platform = ? AND locale = ? COLLATE NOCASE").get(platform, locale));
}

function englishValues(db: CatalogDatabase, platform: Platform) {
  const keys = db.prepare("SELECT key FROM translation_keys WHERE platform = ? ORDER BY key").all(platform) as { key: string }[];
  const stored = db.prepare(`
    SELECT key, value FROM translation_values
    WHERE platform = ? AND locale = 'en' COLLATE NOCASE
  `).all(platform) as { key: string; value: string }[];
  const values = new Map(stored.map((row) => [row.key, row.value]));
  return new Map(keys.map((row) => [row.key, values.get(row.key) ?? ""]));
}
