import type { CatalogDatabase } from "@/src/server/database";
import { getBuild, listBuildValues, markBuildPublished } from "@/src/server/builds";
import { InputError, StorageError } from "@/src/features/catalog/validation";
import {
  languageFiles,
  manifestBytes,
  manifestName,
  objectNameFromPublicUrl,
} from "@/src/lib/gcs/files";
import type { ObjectStorage } from "@/src/lib/gcs/types";

const STORAGE_FAILURE = "Cloud Storage did not accept the publish. The previous manifest is still in place.";

export async function publishSnapshot(db: CatalogDatabase, storage: ObjectStorage, input: {
  bucket: string;
  buildId: number;
  now?: Date;
}) {
  const build = getBuild(db, input.buildId);
  if (!build) throw new InputError("That build does not exist.");
  const updatedTime = (input.now ?? new Date()).toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updatedTime)) {
    throw new StorageError(STORAGE_FAILURE);
  }
  const rows = listBuildValues(db, build.id);
  const files = languageFiles(build.platform, updatedTime, rows);
  const manifest = manifestName(build.platform);
  const current = await storage.get(manifest);
  const reserved = new Set<string>();
  if (current) {
    try {
      const parsed = JSON.parse(current.bytes.toString("utf8")) as { languages?: Record<string, { url?: string }> };
      for (const language of Object.values(parsed.languages ?? {})) {
        if (typeof language?.url !== "string") continue;
        const name = objectNameFromPublicUrl(input.bucket, language.url);
        if (name) reserved.add(name);
      }
    } catch {
      throw new StorageError(STORAGE_FAILURE);
    }
  }
  try {
    for (const file of files) {
      if (reserved.has(file.name)) throw new StorageError(STORAGE_FAILURE);
      await storage.put(file.name, file.bytes, {
        contentType: "application/json",
        ifGenerationMatch: 0,
      });
    }
    const body = manifestBytes(updatedTime, files, input.bucket);
    await storage.put(manifest, body, {
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
  markBuildPublished(db, build.id, updatedTime);
  return { updatedTime, platform: build.platform };
}
