import { StorageError } from "@/src/features/catalog/validation";
import type { ObjectStorage, PutOptions, StoredObject } from "@/src/lib/gcs/types";

type MemoryEntry = StoredObject;

export class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, MemoryEntry>();
  failOn: ((name: string) => boolean) | null = null;
  failReads = false;

  async get(name: string) {
    if (this.failReads) throw new StorageError("Cloud Storage did not accept the publish. The previous manifest is still in place.");
    const entry = this.objects.get(name);
    return entry ? { ...entry, bytes: Buffer.from(entry.bytes) } : null;
  }

  async list(prefix: string) {
    if (this.failReads) throw new StorageError("Cloud Storage did not accept the publish. The previous manifest is still in place.");
    return [...this.objects.keys()].filter((name) => name.startsWith(prefix));
  }

  async put(name: string, bytes: Buffer, options: PutOptions) {
    if (this.failOn?.(name)) {
      throw new StorageError("Cloud Storage did not accept the publish. The previous manifest is still in place.");
    }
    const current = this.objects.get(name);
    const generation = current?.generation ?? 0;
    if (options.ifGenerationMatch !== undefined && options.ifGenerationMatch !== generation) {
      throw new StorageError("Cloud Storage did not accept the publish. The previous manifest is still in place.");
    }
    this.objects.set(name, {
      bytes: Buffer.from(bytes),
      generation: generation + 1,
      cacheControl: options.cacheControl,
      contentType: options.contentType,
    });
  }
}

let memory: MemoryStorage | null = null;

export function sharedMemoryStorage() {
  memory ??= new MemoryStorage();
  return memory;
}

export function resetMemoryStorage() {
  memory = new MemoryStorage();
  return memory;
}
