import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { languageFileBytes, manifestBytes, objectName, publicObjectUrl, sha256 } from "@/src/lib/gcs/files";
import { MemoryStorage } from "@/src/lib/gcs/memory";
import { createBuild } from "@/src/server/builds";
import { saveValue } from "@/src/server/catalog";
import { publishSnapshot } from "@/src/server/publish";
import { temporaryDatabase } from "../helpers/database";

const bucket = "language-ota";
const firstPublished = new Date("2026-09-28T15:04:00.123Z");
const secondPublished = new Date("2026-09-28T16:05:00.456Z");

function seed() {
  const temp = temporaryDatabase();
  temp.db.prepare("INSERT INTO languages (platform, locale) VALUES ('android', 'en'), ('android', 'fr'), ('ios', 'en')").run();
  temp.db.prepare("INSERT INTO translation_keys (platform, key) VALUES ('android', 'hello'), ('android', 'other'), ('ios', 'hello')").run();
  temp.db.prepare(`
    INSERT INTO translation_values (platform, locale, key, value) VALUES
      ('android', 'en', 'hello', 'Hello'),
      ('android', 'fr', 'other', ''),
      ('ios', 'en', 'hello', 'iOS')
  `).run();
  return temp;
}

describe("publish", () => {
  it("writes language objects, then that platform manifest, and freezes the build", async () => {
    const temp = seed();
    const storage = new MemoryStorage();
    storage.objects.set("ios/manifest.json", {
      bytes: Buffer.from("{\"updatedTime\":\"ios\"}\n"),
      generation: 4,
      cacheControl: "no-cache",
    });
    const id = createBuild(temp.db, "android");
    const result = await publishSnapshot(temp.db, storage, { bucket, buildId: id, now: firstPublished });
    expect(result.updatedTime).toBe("2026-09-28T15:04:00.123Z");
    const name = objectName("android", "en", result.updatedTime);
    expect(name).toBe("android/en/2026-09-28T15-04-00.123Z.json");
    const english = storage.objects.get(name);
    const expected = languageFileBytes([{ key: "hello", value: "Hello" }]);
    expect(english?.bytes.toString("utf8")).toBe(expected.toString("utf8"));
    expect(english?.cacheControl).toBeUndefined();
    expect(sha256(expected)).toBe(createHash("sha256").update(expected).digest("hex"));
    const french = storage.objects.get(objectName("android", "fr", result.updatedTime));
    expect(JSON.parse(french!.bytes.toString("utf8"))).toEqual({ strings: { other: "" } });
    const manifest = storage.objects.get("android/manifest.json");
    expect(manifest?.cacheControl).toBe("no-cache");
    expect(JSON.parse(manifest!.bytes.toString("utf8"))).toEqual({
      updatedTime: "2026-09-28T15:04:00.123Z",
      languages: {
        en: { url: publicObjectUrl(bucket, name), checksum: sha256(expected) },
        fr: {
          url: publicObjectUrl(bucket, objectName("android", "fr", result.updatedTime)),
          checksum: sha256(french!.bytes),
        },
      },
    });
    expect(storage.objects.get("ios/manifest.json")?.bytes.toString("utf8")).toBe("{\"updatedTime\":\"ios\"}\n");
    expect(temp.db.prepare("SELECT published_at FROM builds WHERE id = ?").get(id)).toEqual({
      published_at: "2026-09-28T15:04:00.123Z",
    });
    expect(manifestBytes(result.updatedTime, [], bucket).toString("utf8")).toContain("\"languages\": {}");
    temp.close();
  });

  it("publishes an older frozen build with new objects and a new updated time", async () => {
    const temp = seed();
    const storage = new MemoryStorage();
    const older = createBuild(temp.db, "android");
    await publishSnapshot(temp.db, storage, { bucket, buildId: older, now: firstPublished });
    saveValue(temp.db, "android", "en", "hello", "Changed");
    const newer = createBuild(temp.db, "android");
    await publishSnapshot(temp.db, storage, { bucket, buildId: newer, now: secondPublished });
    await publishSnapshot(temp.db, storage, { bucket, buildId: older, now: new Date("2026-09-28T17:06:00.789Z") });
    const manifest = JSON.parse(storage.objects.get("android/manifest.json")!.bytes.toString("utf8")) as {
      updatedTime: string;
      languages: { en: { checksum: string } };
    };
    expect(manifest.updatedTime).toBe("2026-09-28T17:06:00.789Z");
    const bytes = languageFileBytes([{ key: "hello", value: "Hello" }]);
    expect(manifest.languages.en.checksum).toBe(sha256(bytes));
    expect(storage.objects.has("android/en/2026-09-28T17-06-00.789Z.json")).toBe(true);
    temp.close();
  });

  it("leaves the previous manifest and published_at untouched when an upload fails", async () => {
    const temp = seed();
    const storage = new MemoryStorage();
    const previous = Buffer.from("{\"updatedTime\":\"previous\"}\n");
    storage.objects.set("android/manifest.json", { bytes: previous, generation: 2, cacheControl: "no-cache" });
    storage.objects.set("ios/manifest.json", { bytes: Buffer.from("ios"), generation: 1 });
    const id = createBuild(temp.db, "android");
    storage.failOn = (name) => name === "android/manifest.json";
    await expect(publishSnapshot(temp.db, storage, { bucket, buildId: id, now: firstPublished })).rejects.toThrow(/previous manifest/);
    expect(storage.objects.get("android/manifest.json")?.bytes.equals(previous)).toBe(true);
    expect(storage.objects.get("ios/manifest.json")?.bytes.toString("utf8")).toBe("ios");
    expect(temp.db.prepare("SELECT published_at FROM builds WHERE id = ?").get(id)).toEqual({ published_at: null });
    temp.close();
  });

  it("does not mark the build published when the manifest cannot be read back", async () => {
    const temp = seed();
    const storage = new MemoryStorage();
    const id = createBuild(temp.db, "android");
    const originalGet = storage.get.bind(storage);
    storage.get = async (name) => {
      if (name === "android/manifest.json" && storage.objects.has(name)) throw new Error("read failed");
      return originalGet(name);
    };
    await expect(publishSnapshot(temp.db, storage, { bucket, buildId: id, now: firstPublished })).rejects.toThrow(/previous manifest/);
    expect(temp.db.prepare("SELECT published_at FROM builds WHERE id = ?").get(id)).toEqual({ published_at: null });
    temp.close();
  });
});
