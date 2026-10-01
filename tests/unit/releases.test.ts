import { describe, expect, it } from "vitest";
import { MemoryStorage } from "@/src/lib/gcs/memory";
import { deleteKeys, saveValue } from "@/src/server/catalog";
import { createRelease, listReleases, releaseDownload, renameRelease, setReleaseProduction } from "@/src/server/releases";
import { temporaryDatabase, valueOf } from "../helpers/database";

const bucket = "language-ota";
const created = new Date("2026-09-29T12:00:00.000Z");
const released = new Date("2026-09-29T13:00:00.000Z");

function seed() {
  const temp = temporaryDatabase();
  temp.db.prepare("INSERT INTO languages (platform, locale, label) VALUES ('android', 'en', 'English'), ('android', 'fr', 'French'), ('ios', 'en', 'English')").run();
  temp.db.prepare("INSERT INTO translation_keys (platform, key) VALUES ('android', 'hello'), ('android', 'other'), ('ios', 'hello')").run();
  temp.db.prepare(`
    INSERT INTO translation_values (platform, locale, key, value) VALUES
      ('android', 'en', 'hello', 'Hello'),
      ('android', 'fr', 'hello', ''),
      ('ios', 'en', 'hello', 'iOS')
  `).run();
  return temp;
}

describe("releases", () => {
  it("stores the working set, writes language files, and leaves the manifest alone", async () => {
    const temp = seed();
    const storage = new MemoryStorage();
    const release = await createRelease(temp.db, storage, {
      platform: "android",
      name: "Papercut 29 Sep",
      createdBy: "person@anywhere.co",
      now: created,
    });
    expect(release.version).toBe(1);
    expect(release.createdBy).toBe("person@anywhere.co");
    expect(release.isProduction).toBe(false);
    expect(storage.objects.has("android/manifest.json")).toBe(false);
    expect(JSON.parse(storage.objects.get("android/en/1.json")!.bytes.toString("utf8"))).toEqual({ strings: { hello: "Hello" } });
    expect(JSON.parse(storage.objects.get("android/fr/1.json")!.bytes.toString("utf8"))).toEqual({ strings: { hello: "" } });
    await expect(createRelease(temp.db, storage, {
      platform: "android",
      name: "Again",
      createdBy: "person@anywhere.co",
      now: created,
    })).rejects.toThrow(/matches the latest release/);
    temp.close();
  });

  it("skips language files that already exist in storage", async () => {
    const temp = seed();
    const storage = new MemoryStorage();
    storage.objects.set("android/en/1.json", { bytes: Buffer.from("{}\n"), generation: 1 });
    storage.objects.set("android/en/5.json", { bytes: Buffer.from("{}\n"), generation: 1 });
    storage.objects.set("android/en/", { bytes: Buffer.from(""), generation: 1 });
    const release = await createRelease(temp.db, storage, {
      platform: "android",
      name: "After existing files",
      createdBy: "person@anywhere.co",
      now: created,
    });
    expect(release.version).toBe(6);
    expect(storage.objects.get("android/en/1.json")!.bytes.toString("utf8")).toBe("{}\n");
    expect(JSON.parse(storage.objects.get("android/en/6.json")!.bytes.toString("utf8"))).toEqual({ strings: { hello: "Hello" } });
    expect(storage.objects.has("android/fr/6.json")).toBe(true);
    temp.close();
  });

  it("renames without changing the file or who created it", async () => {
    const temp = seed();
    const storage = new MemoryStorage();
    const release = await createRelease(temp.db, storage, {
      platform: "android",
      name: "First",
      createdBy: "person@anywhere.co",
      now: created,
    });
    const renamed = renameRelease(temp.db, release.id, "Second");
    expect(renamed.name).toBe("Second");
    expect(renamed.createdBy).toBe("person@anywhere.co");
    expect(storage.objects.get("android/en/1.json")!.bytes.toString("utf8")).toContain("Hello");
    temp.close();
  });

  it("sets production from the stored files and can point back at an older release", async () => {
    const temp = seed();
    const storage = new MemoryStorage();
    const first = await createRelease(temp.db, storage, {
      platform: "android",
      name: "First",
      createdBy: "person@anywhere.co",
      now: created,
    });
    saveValue(temp.db, "android", "en", "hello", "Updated");
    const second = await createRelease(temp.db, storage, {
      platform: "android",
      name: "Second",
      createdBy: "person@anywhere.co",
      now: released,
    });
    const live = await setReleaseProduction(temp.db, storage, {
      releaseId: second.id,
      bucket,
      releasedBy: "editor@anywhere.co",
      now: released,
    });
    expect(live.isProduction).toBe(true);
    expect(live.releasedBy).toBe("editor@anywhere.co");
    const manifest = JSON.parse(storage.objects.get("android/manifest.json")!.bytes.toString("utf8")) as {
      languages: Record<string, { url: string }>;
    };
    expect(manifest.languages.en.url).toContain("/android/en/2.json");
    const restored = await setReleaseProduction(temp.db, storage, {
      releaseId: first.id,
      bucket,
      releasedBy: "editor@anywhere.co",
      now: new Date("2026-09-29T14:00:00.000Z"),
    });
    expect(restored.isProduction).toBe(true);
    const previous = listReleases(temp.db).find((item) => item.id === second.id);
    expect(previous?.releasedBy).toBe("editor@anywhere.co");
    expect(previous?.isProduction).toBe(false);
    const current = JSON.parse(storage.objects.get("android/manifest.json")!.bytes.toString("utf8")) as {
      languages: Record<string, { url: string }>;
    };
    expect(current.languages.en.url).toContain("/android/en/1.json");
    expect(storage.objects.has("ios/manifest.json")).toBe(false);
    temp.close();
  });

  it("downloads the frozen bodies after the working set changes", async () => {
    const temp = seed();
    const storage = new MemoryStorage();
    const release = await createRelease(temp.db, storage, {
      platform: "ios",
      name: "",
      createdBy: "person@anywhere.co",
      now: created,
    });
    deleteKeys(temp.db, "ios", ["hello"]);
    const file = releaseDownload(temp.db, release.id);
    expect(file.filename).toBe("ios-v1-en.json");
    expect(JSON.parse(file.bytes.toString("utf8"))).toEqual({ strings: { hello: "iOS" } });
    expect(valueOf(temp.db, "ios", "en", "hello")).toBeUndefined();
    temp.close();
  });
});
