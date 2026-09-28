import "server-only";
import { StorageError } from "@/src/features/catalog/validation";
import { createGcsStorage } from "@/src/lib/gcs/gcs";
import { sharedMemoryStorage } from "@/src/lib/gcs/memory";
import type { ObjectStorage } from "@/src/lib/gcs/types";

export function bucketName() {
  const bucket = process.env.GCS_BUCKET?.trim();
  if (!bucket) throw new StorageError("Cloud Storage is not configured. Set GCS_BUCKET and try the publish again.");
  return bucket;
}

export function createObjectStorage(): ObjectStorage {
  if (process.env.PUBLISHER_STORAGE === "memory") {
    if (process.env.NODE_ENV === "production") {
      throw new StorageError("Cloud Storage is not configured. Set GCS_BUCKET and try the publish again.");
    }
    return sharedMemoryStorage();
  }
  return createGcsStorage(bucketName());
}
