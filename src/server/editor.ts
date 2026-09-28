import { listBuildValues } from "@/src/server/builds";
import { listLanguages, removeLanguagesWithoutValues } from "@/src/server/catalog";
import type { EditorLanguage, EditorRow } from "@/src/features/catalog/types";
import type { CatalogDatabase } from "@/src/server/database";
import type { Platform } from "@/src/features/catalog/validation";

export type { EditorLanguage, EditorRow };

export function loadEditor(db: CatalogDatabase, platform: Platform) {
  removeLanguagesWithoutValues(db, platform);
  const languages: EditorLanguage[] = listLanguages(db, platform).map((entry) => ({
    code: entry.locale,
    label: entry.label,
  }));
  const keyRows = db.prepare("SELECT key, updated_at FROM translation_keys WHERE platform = ? ORDER BY key").all(platform) as {
    key: string;
    updated_at: string;
  }[];
  const stored = db.prepare("SELECT locale, key, value FROM translation_values WHERE platform = ?").all(platform) as {
    locale: string;
    key: string;
    value: string;
  }[];
  const valuesByKey = new Map<string, Record<string, string | null>>();
  for (const entry of keyRows) valuesByKey.set(entry.key, {});
  for (const entry of stored) {
    const row = valuesByKey.get(entry.key);
    if (row) row[entry.locale] = entry.value;
  }
  const updatedAt = new Map(keyRows.map((entry) => [entry.key, entry.updated_at]));
  const rows: EditorRow[] = [...valuesByKey.entries()].map(([key, values]) => ({
    key,
    values,
    updatedAt: updatedAt.get(key) ?? "",
  }));
  const published = latestPublished(db, platform);
  return { languages, rows, publishedLocales: published.locales, publishedValues: published.values };
}

function latestPublished(db: CatalogDatabase, platform: Platform) {
  const build = db.prepare(`
    SELECT id FROM builds
    WHERE platform = ? AND published_at IS NOT NULL
    ORDER BY published_at DESC, id DESC
    LIMIT 1
  `).get(platform) as { id: number } | undefined;
  if (!build) return { locales: [] as string[], values: {} as Record<string, Record<string, string>> };
  const snapshot = listBuildValues(db, build.id);
  const values: Record<string, Record<string, string>> = {};
  for (const row of snapshot) (values[row.key] ??= {})[row.locale] = row.value;
  return { locales: [...new Set(snapshot.map((row) => row.locale))].sort(), values };
}
