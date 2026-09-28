export type StoredObject = {
  bytes: Buffer;
  generation: number;
  cacheControl?: string;
  contentType?: string;
};

export type PutOptions = {
  contentType: string;
  cacheControl?: string;
  ifGenerationMatch?: number;
};

export interface ObjectStorage {
  get(name: string): Promise<StoredObject | null>;
  list(prefix: string): Promise<string[]>;
  put(name: string, bytes: Buffer, options: PutOptions): Promise<void>;
}
