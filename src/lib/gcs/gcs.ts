import "server-only";
import { Storage } from "@google-cloud/storage";
import { StorageError } from "@/src/features/catalog/validation";
import type { ObjectStorage, PutOptions } from "@/src/lib/gcs/types";

const STORAGE_FAILURE = "Cloud Storage did not accept the publish. The previous manifest is still in place.";

export function createGcsStorage(bucketName: string): ObjectStorage {
  const bucket = new Storage().bucket(bucketName);
  return {
    async get(name) {
      try {
        const file = bucket.file(name);
        const [exists] = await file.exists();
        if (!exists) return null;
        const [bytes] = await file.download();
        const [metadata] = await file.getMetadata();
        return {
          bytes: Buffer.from(bytes),
          generation: Number(metadata.generation ?? 0),
          cacheControl: metadata.cacheControl,
          contentType: metadata.contentType,
        };
      } catch (error) {
        throw storageFailure(error);
      }
    },
    async list(prefix) {
      try {
        const [files] = await bucket.getFiles({ prefix });
        return files.map((file) => file.name);
      } catch (error) {
        throw storageFailure(error);
      }
    },
    async put(name, bytes, options: PutOptions) {
      try {
        await bucket.file(name).save(bytes, {
          resumable: false,
          contentType: options.contentType,
          metadata: options.cacheControl ? { cacheControl: options.cacheControl } : undefined,
          preconditionOpts: options.ifGenerationMatch === undefined
            ? undefined
            : { ifGenerationMatch: options.ifGenerationMatch },
        });
      } catch (error) {
        throw storageFailure(error);
      }
    },
  };
}

function storageFailure(error: unknown): StorageError {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error("Cloud Storage error:", code);
  return new StorageError(STORAGE_FAILURE);
}
