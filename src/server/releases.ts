import { languageFileBytes, manifestBytes, manifestName, sha256, type LanguageFile } from "@/src/lib/gcs/files";
import type { ObjectStorage } from "@/src/lib/gcs/types";
import { zipBytes } from "@/src/features/releases/archive";
import { InputError, StorageError, type Platform } from "@/src/features/catalog/validation";
import { listLanguages } from "@/src/server/catalog";
import type { ReleaseRecord } from "@/src/features/releases/types";
import type { CatalogDatabase } from "@/src/server/database";

const STORAGE_FAILURE = "Cloud Storage did not accept the publish. The previous manifest is still in place.";
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type { ReleaseRecord };

type ReleaseFile = {
  locale: string;
  body: string;
  checksum: string;
  objectName: string;
};

type DraftFile = {
  locale: string;
  body: string;
  checksum: string;
  bytes: Buffer;
};

export function listReleases(db: CatalogDatabase): ReleaseRecord[] {
  return db.prepare(`
    SELECT id, platform, version, name, created_at, created_by, released_at, released_by, is_production
    FROM releases
    ORDER BY created_at DESC, version DESC, id DESC
  `).all().map(readRelease);
}

export async function createRelease(db: CatalogDatabase, storage: ObjectStorage, input: {
  platform: Platform;
  name: string;
  createdBy: string;
  now?: Date;
}) {
  const createdAt = timestamp(input.now);
  const drafts = workingSetFiles(db, input.platform);
  if (drafts.length === 0) throw new InputError("This platform has no languages. Nothing was released.");
  const latest = latestRelease(db, input.platform);
  if (latest && sameBodies(drafts, listFiles(db, latest.id))) {
    throw new InputError("This working set matches the latest release. Nothing was released.");
  }
  const existingNames = await storage.list(`${input.platform}/`);
  const version = nextVersion(input.platform, latest?.version ?? 0, existingNames);
  const files = drafts.map((file) => ({
    ...file,
    objectName: `${input.platform}/${file.locale}/${version}.json`,
  }));
  for (const file of files) {
    await storage.put(file.objectName, file.bytes, {
      contentType: "application/json",
      ifGenerationMatch: 0,
    });
  }
  const insert = db.prepare(`
    INSERT INTO releases (platform, version, name, created_at, created_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertFile = db.prepare(`
    INSERT INTO release_files (release_id, locale, body, checksum, object_name)
    VALUES (?, ?, ?, ?, ?)
  `);
  const id = db.transaction(() => {
    const result = insert.run(input.platform, version, input.name.trim(), createdAt, input.createdBy);
    const releaseId = Number(result.lastInsertRowid);
    for (const file of files) insertFile.run(releaseId, file.locale, file.body, file.checksum, file.objectName);
    return releaseId;
  })();
  const created = getRelease(db, id);
  if (!created) throw new InputError("That release does not exist.");
  return created;
}

export function renameRelease(db: CatalogDatabase, id: number, name: string) {
  const existing = getRelease(db, id);
  if (!existing) throw new InputError("That release does not exist.");
  db.prepare("UPDATE releases SET name = ? WHERE id = ?").run(name.trim(), id);
  return getRelease(db, id) as ReleaseRecord;
}

export async function setReleaseProduction(db: CatalogDatabase, storage: ObjectStorage, input: {
  releaseId: number;
  bucket: string;
  releasedBy: string;
  now?: Date;
}) {
  const release = getRelease(db, input.releaseId);
  if (!release) throw new InputError("That release does not exist.");
  const updatedTime = timestamp(input.now);
  const files = listFiles(db, release.id);
  const manifest = manifestName(release.platform);
  const current = await storage.get(manifest);
  const languageFiles: LanguageFile[] = files.map((file) => ({
    locale: file.locale,
    name: file.objectName,
    bytes: Buffer.from(file.body, "utf8"),
    checksum: file.checksum,
  }));
  try {
    await storage.put(manifest, manifestBytes(updatedTime, languageFiles, input.bucket), {
      contentType: "application/json",
      cacheControl: "no-cache",
      ifGenerationMatch: current?.generation ?? 0,
    });
    const readBack = await storage.get(manifest);
    const confirmed = readBack ? JSON.parse(readBack.bytes.toString("utf8")) as { updatedTime?: string } : null;
    if (!readBack || confirmed?.updatedTime !== updatedTime) throw new StorageError(STORAGE_FAILURE);
  } catch (error) {
    if (error instanceof StorageError) throw error;
    throw new StorageError(STORAGE_FAILURE);
  }
  db.transaction(() => {
    db.prepare("UPDATE releases SET is_production = 0 WHERE platform = ?").run(release.platform);
    db.prepare("UPDATE releases SET is_production = 1, released_at = ?, released_by = ? WHERE id = ?")
      .run(updatedTime, input.releasedBy, release.id);
  })();
  return getRelease(db, release.id) as ReleaseRecord;
}

export function releaseDownload(db: CatalogDatabase, id: number) {
  const release = getRelease(db, id);
  if (!release) throw new InputError("That release does not exist.");
  const files = listFiles(db, id).sort((left, right) => left.locale.localeCompare(right.locale));
  if (files.length === 1) {
    const file = files[0];
    return {
      filename: `${release.platform}-v${release.version}-${file.locale}.json`,
      contentType: "application/json",
      bytes: Buffer.from(file.body, "utf8"),
    };
  }
  return {
    filename: `${release.platform}-v${release.version}.zip`,
    contentType: "application/zip",
    bytes: zipBytes(files.map((file) => ({ name: `${file.locale}.json`, body: file.body }))),
  };
}

function workingSetFiles(db: CatalogDatabase, platform: Platform): DraftFile[] {
  const languages = listLanguages(db, platform);
  const stored = db.prepare("SELECT locale, key, value FROM translation_values WHERE platform = ?")
    .all(platform) as { locale: string; key: string; value: string }[];
  return languages.map((language) => {
    const entries = stored.filter((row) => row.locale === language.locale).map((row) => ({ key: row.key, value: row.value }));
    const bytes = languageFileBytes(entries);
    return { locale: language.locale, body: bytes.toString("utf8"), checksum: sha256(bytes), bytes };
  });
}

function nextVersion(platform: Platform, latestDatabaseVersion: number, names: string[]) {
  const pattern = new RegExp(`^${platform}/[^/]+/(\\d+)\\.json$`);
  let highest = latestDatabaseVersion;
  for (const name of names) {
    const match = pattern.exec(name);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

function latestRelease(db: CatalogDatabase, platform: Platform) {
  const row = db.prepare(`
    SELECT id, platform, version, name, created_at, created_by, released_at, released_by, is_production
    FROM releases WHERE platform = ? ORDER BY version DESC LIMIT 1
  `).get(platform);
  return row ? readRelease(row) : null;
}

function getRelease(db: CatalogDatabase, id: number) {
  const row = db.prepare(`
    SELECT id, platform, version, name, created_at, created_by, released_at, released_by, is_production
    FROM releases WHERE id = ?
  `).get(id);
  return row ? readRelease(row) : null;
}

function listFiles(db: CatalogDatabase, releaseId: number): ReleaseFile[] {
  return db.prepare(`
    SELECT locale, body, checksum, object_name FROM release_files WHERE release_id = ? ORDER BY locale
  `).all(releaseId).map((row) => {
    const record = row as { locale: string; body: string; checksum: string; object_name: string };
    return { locale: record.locale, body: record.body, checksum: record.checksum, objectName: record.object_name };
  });
}

function sameBodies(drafts: DraftFile[], stored: ReleaseFile[]) {
  if (drafts.length !== stored.length) return false;
  const saved = new Map(stored.map((file) => [file.locale, file.body]));
  return drafts.every((file) => saved.get(file.locale) === file.body);
}

function readRelease(row: unknown): ReleaseRecord {
  const record = row as {
    id: number;
    platform: Platform;
    version: number;
    name: string;
    created_at: string;
    created_by: string;
    released_at: string | null;
    released_by: string | null;
    is_production: number;
  };
  return {
    id: record.id,
    platform: record.platform,
    version: record.version,
    name: record.name,
    createdAt: record.created_at,
    createdBy: record.created_by,
    releasedAt: record.released_at,
    releasedBy: record.released_by,
    isProduction: record.is_production === 1,
  };
}

function timestamp(now?: Date) {
  const value = (now ?? new Date()).toISOString();
  if (!TIMESTAMP.test(value)) throw new StorageError(STORAGE_FAILURE);
  return value;
}
