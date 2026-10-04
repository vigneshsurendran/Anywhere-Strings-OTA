import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  REPLICA_OBJECT,
  backupWorkingSet,
  replicaConfig,
  restoreWorkingSet,
  type ReplicaStore,
} from "@/src/server/replica/working-set";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("working set replica", () => {
  it("keeps the replica object outside the language prefixes", () => {
    expect(REPLICA_OBJECT).toBe("_publisher/working-set.sqlite");
    expect(REPLICA_OBJECT.startsWith("android/")).toBe(false);
    expect(REPLICA_OBJECT.startsWith("ios/")).toBe(false);
  });

  it("stays off unless production asks for a Cloud Storage copy", () => {
    expect(replicaConfig({})).toBeNull();
    expect(replicaConfig({ PUBLISHER_REPLICA: "gcs", GCS_BUCKET: "language-ota" }, "/app")).toEqual({
      bucket: "language-ota",
      filePath: "/app/data/publisher.sqlite",
    });
    expect(replicaConfig({
      PUBLISHER_REPLICA: "gcs",
      GCS_BUCKET: "language-ota",
      PUBLISHER_DATABASE_PATH: "/data/publisher.sqlite",
    })?.filePath).toBe("/data/publisher.sqlite");
    expect(() => replicaConfig({ PUBLISHER_REPLICA: "gcs" })).toThrow(/GCS_BUCKET/);
  });

  it("restores a missing database and then refuses a stale overwrite", async () => {
    const directory = tempDirectory();
    const filePath = path.join(directory, "publisher.sqlite");
    const store = memoryStore();

    await expect(restoreWorkingSet(filePath, store)).resolves.toBe("absent");
    writeCatalog(filePath, "Hello");
    await expect(backupWorkingSet(filePath, store)).resolves.toBe("stored");

    const otherDirectory = tempDirectory();
    const otherPath = path.join(otherDirectory, "publisher.sqlite");
    await expect(restoreWorkingSet(otherPath, store)).resolves.toBe("restored");
    expect(readCatalog(otherPath)).toBe("Hello");

    writeCatalog(filePath, "Stale");
    await expect(backupWorkingSet(filePath, store)).resolves.toBe("stale");
    expect(readCatalog(otherPath)).toBe("Hello");
    await expect(backupWorkingSet(otherPath, store)).resolves.toBe("stored");
    expect(textOf(store)).toContain("Hello");
  });

  it("keeps a database that is already on disk", async () => {
    const directory = tempDirectory();
    const filePath = path.join(directory, "publisher.sqlite");
    writeCatalog(filePath, "Local");
    const store = memoryStore({ bytes: Buffer.from("remote"), generation: 4 });

    await expect(restoreWorkingSet(filePath, store)).resolves.toBe("kept");
    expect(readCatalog(filePath)).toBe("Local");
    expect(await readFile(`${filePath}.generation`, "utf8")).toBe("4");
  });

  it("skips a backup when the database has not been created", async () => {
    const store = memoryStore();
    await expect(backupWorkingSet(path.join(tempDirectory(), "missing.sqlite"), store)).resolves.toBe("skipped");
    expect(store.current).toBeNull();
  });
});

function tempDirectory() {
  const directory = mkdtempSync(path.join(tmpdir(), "publisher-replica-"));
  directories.push(directory);
  return directory;
}

function writeCatalog(filePath: string, value: string) {
  const db = new Database(filePath);
  db.exec("CREATE TABLE IF NOT EXISTS sample (value TEXT)");
  db.prepare("DELETE FROM sample").run();
  db.prepare("INSERT INTO sample (value) VALUES (?)").run(value);
  db.close();
}

function readCatalog(filePath: string) {
  const db = new Database(filePath, { readonly: true });
  try {
    return db.prepare("SELECT value FROM sample").pluck().get() as string;
  } finally {
    db.close();
  }
}

function memoryStore(initial: { bytes: Buffer; generation: number } | null = null) {
  const state: { current: { bytes: Buffer; generation: number } | null } = {
    current: initial ? { bytes: Buffer.from(initial.bytes), generation: initial.generation } : null,
  };
  const store: ReplicaStore & { current: typeof state.current } = {
    get current() {
      return state.current;
    },
    async read() {
      return state.current
        ? { bytes: Buffer.from(state.current.bytes), generation: state.current.generation }
        : null;
    },
    async write(bytes, generation) {
      const currentGeneration = state.current?.generation ?? 0;
      if (currentGeneration !== generation) {
        const error = new Error("conflict") as Error & { code: number };
        error.code = 412;
        throw error;
      }
      state.current = { bytes: Buffer.from(bytes), generation: currentGeneration + 1 };
      return state.current.generation;
    },
  };
  return store;
}

function textOf(store: { current: { bytes: Buffer } | null }) {
  return store.current ? store.current.bytes.toString("utf8") : "";
}
