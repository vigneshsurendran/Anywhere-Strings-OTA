import type { CatalogDatabase } from "@/src/server/database";
import { InputError, assertStoredValue, type Platform } from "@/src/features/catalog/validation";

export type BuildSummary = {
  id: number;
  platform: Platform;
  createdAt: string;
  publishedAt: string | null;
};

export type BuildValueRow = {
  locale: string;
  key: string;
  value: string;
};

type BuildRecord = {
  id: number;
  platform: Platform;
  created_at: string;
  published_at: string | null;
};

export function createBuild(db: CatalogDatabase, platform: Platform, createdAt = new Date().toISOString()) {
  const apply = db.transaction(() => {
    const result = db.prepare("INSERT INTO builds (platform, created_at, published_at) VALUES (?, ?, NULL)")
      .run(platform, createdAt);
    const id = Number(result.lastInsertRowid);
    const rows = db.prepare("SELECT locale, key, value FROM translation_values WHERE platform = ?").all(platform) as BuildValueRow[];
    const insert = db.prepare("INSERT INTO build_values (build_id, locale, key, value) VALUES (?, ?, ?, ?)");
    for (const row of rows) insert.run(id, row.locale, row.key, row.value);
    return id;
  });
  return apply();
}

export function listBuilds(db: CatalogDatabase, platform: Platform): BuildSummary[] {
  const rows = db.prepare(`
    SELECT id, platform, created_at, published_at
    FROM builds
    WHERE platform = ?
    ORDER BY id DESC
  `).all(platform) as BuildRecord[];
  return rows.map(toSummary);
}

export function getBuild(db: CatalogDatabase, id: number): BuildSummary | null {
  const row = db.prepare("SELECT id, platform, created_at, published_at FROM builds WHERE id = ?").get(id) as BuildRecord | undefined;
  return row ? toSummary(row) : null;
}

export function listBuildValues(db: CatalogDatabase, buildId: number): BuildValueRow[] {
  return db.prepare(`
    SELECT locale, key, value
    FROM build_values
    WHERE build_id = ?
    ORDER BY locale, key
  `).all(buildId) as BuildValueRow[];
}

export function saveBuildValue(db: CatalogDatabase, buildId: number, locale: string, key: string, value: string) {
  assertStoredValue(value);
  const build = db.prepare("SELECT published_at FROM builds WHERE id = ?").get(buildId) as { published_at: string | null } | undefined;
  if (!build) throw new InputError("That build does not exist. Nothing was saved.");
  if (build.published_at) throw new InputError("That build is published and can no longer be edited.");
  const existing = db.prepare("SELECT value FROM build_values WHERE build_id = ? AND locale = ? AND key = ?")
    .get(buildId, locale, key) as { value: string } | undefined;
  if (!existing) throw new InputError("That snapshot entry does not exist. Nothing was saved.");
  if (existing.value === value) return "unchanged" as const;
  db.prepare("UPDATE build_values SET value = ? WHERE build_id = ? AND locale = ? AND key = ?")
    .run(value, buildId, locale, key);
  return "saved" as const;
}

export function markBuildPublished(db: CatalogDatabase, buildId: number, publishedAt: string) {
  db.prepare("UPDATE builds SET published_at = ? WHERE id = ?").run(publishedAt, buildId);
}

function toSummary(row: BuildRecord): BuildSummary {
  return {
    id: row.id,
    platform: row.platform,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}
