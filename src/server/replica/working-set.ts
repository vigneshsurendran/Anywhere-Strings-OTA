import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { accessSync, existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";

export const REPLICA_OBJECT = "_publisher/working-set.sqlite";

export type ReplicaObject = {
  bytes: Buffer;
  generation: number;
};

export type ReplicaStore = {
  read(): Promise<ReplicaObject | null>;
  write(bytes: Buffer, generation: number): Promise<number>;
};

type ReplicaEnv = Record<string, string | undefined>;

export function replicaConfig(env: ReplicaEnv, cwd = process.cwd()) {
  if (env.PUBLISHER_REPLICA !== "gcs") return null;
  const bucket = (env.PUBLISHER_STATE_BUCKET || env.GCS_BUCKET || "").trim();
  if (!bucket) throw new Error("PUBLISHER_REPLICA=gcs requires GCS_BUCKET.");
  const filePath = env.PUBLISHER_DATABASE_PATH || path.join(cwd, "data", "publisher.sqlite");
  return { bucket, filePath };
}

export async function restoreWorkingSet(filePath: string, store: ReplicaStore) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const generationPath = generationFile(filePath);
  if (existsSync(filePath)) {
    if (!existsSync(generationPath)) {
      const remote = await store.read();
      await writeFile(generationPath, String(remote?.generation ?? 0), "utf8");
    }
    return "kept" as const;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const remote = await store.read();
    if (!remote) {
      await writeFile(generationPath, "0", "utf8");
      return "absent" as const;
    }
    try {
      const generation = await store.write(remote.bytes, remote.generation);
      await writeFile(filePath, remote.bytes);
      await writeFile(generationPath, String(generation), "utf8");
      return "restored" as const;
    } catch (error) {
      if (!isConflict(error)) throw error;
      if (attempt === 4) throw new Error("Could not restore the working set.");
    }
  }
  throw new Error("Could not restore the working set.");
}

export async function backupWorkingSet(filePath: string, store: ReplicaStore) {
  if (!existsSync(filePath)) return "skipped" as const;
  const generationPath = generationFile(filePath);
  const generation = Number(existsSync(generationPath) ? await readFile(generationPath, "utf8") : "0");
  const bytes = await snapshotDatabase(filePath);
  try {
    const nextGeneration = await store.write(bytes, Number.isFinite(generation) ? generation : 0);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(generationPath, String(nextGeneration), "utf8");
    return "stored" as const;
  } catch (error) {
    if (isConflict(error)) return "stale" as const;
    throw error;
  }
}

export function gcsReplicaStore(bucketName: string): ReplicaStore {
  return {
    async read() {
      const file = await replicaFile(bucketName);
      try {
        const [exists] = await file.exists();
        if (!exists) return null;
        const [bytes] = await file.download();
        const [metadata] = await file.getMetadata();
        return { bytes: Buffer.from(bytes), generation: Number(metadata.generation ?? 0) };
      } catch (error) {
        throw storageFailure("restore", error);
      }
    },
    async write(bytes, generation) {
      const file = await replicaFile(bucketName);
      try {
        await file.save(bytes, {
          resumable: false,
          contentType: "application/vnd.sqlite3",
          metadata: { cacheControl: "no-store" },
          preconditionOpts: { ifGenerationMatch: generation },
        });
        const [metadata] = await file.getMetadata();
        return Number(metadata.generation ?? 0);
      } catch (error) {
        if (isConflict(error)) throw error;
        throw storageFailure("backup", error);
      }
    },
  };
}

function generationFile(filePath: string) {
  return `${filePath}.generation`;
}

async function snapshotDatabase(filePath: string) {
  accessSync(filePath);
  const db = new Database(filePath, { readonly: true, fileMustExist: true });
  const destination = path.join(tmpdir(), `publisher-backup-${process.pid}-${Date.now()}.sqlite`);
  try {
    await db.backup(destination);
    return await readFile(destination);
  } finally {
    db.close();
    await rm(destination, { force: true });
  }
}

async function replicaFile(bucketName: string) {
  const { Storage } = await import("@google-cloud/storage");
  return new Storage().bucket(bucketName).file(REPLICA_OBJECT);
}

function isConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && Number(error.code) === 412);
}

function storageFailure(action: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`Cloud Storage ${action} failed:`, code);
  return new Error(`Could not ${action} the working set.`);
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  const command = process.argv[2];
  const config = replicaConfig({ ...process.env });
  if (!config) process.exit(0);
  const store = gcsReplicaStore(config.bucket);
  const run = command === "restore"
    ? restoreWorkingSet(config.filePath, store)
    : command === "backup"
      ? backupWorkingSet(config.filePath, store)
      : null;
  if (!run) {
    console.error("Expected restore or backup.");
    process.exit(1);
  }
  run.then((result) => {
    console.log(`Working set ${command}: ${result}.`);
    process.exit(0);
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Working set replica failed.");
    process.exit(1);
  });
}
