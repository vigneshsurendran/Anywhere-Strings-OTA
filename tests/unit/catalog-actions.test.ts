import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, configured, redirect, revalidatePath } = vi.hoisted(() => ({
  auth: vi.fn(),
  configured: vi.fn(() => true),
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("@/src/lib/auth", () => ({ auth }));
vi.mock("@/src/lib/auth/environment", () => ({ isAuthConfigured: configured }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createBuild } from "@/src/server/builds";
import { importTranslations } from "@/src/server/catalog";
import { openDatabase } from "@/src/server/database";
import { resetMemoryStorage, sharedMemoryStorage } from "@/src/lib/gcs/memory";
import {
  createKey,
  createLanguage,
  createSnapshot,
  importLanguageFile,
  publishBuild,
  saveTranslation,
} from "@/app/actions/catalog";

let directory = "";
let file = "";

function allow() {
  auth.mockResolvedValue({
    user: { email: "person@anywhere.co", emailVerified: true },
    expires: new Date(Date.now() + 60_000).toISOString(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  configured.mockReturnValue(true);
  directory = mkdtempSync(path.join(tmpdir(), "publisher-actions-"));
  file = path.join(directory, "publisher.sqlite");
  vi.stubEnv("PUBLISHER_DATABASE_PATH", file);
  vi.stubEnv("PUBLISHER_STORAGE", "memory");
  vi.stubEnv("GCS_BUCKET", "language-ota");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AUTH_ADMIN_EMAILS", "person@anywhere.co");
  resetMemoryStorage();
  auth.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe("catalog actions", () => {
  it("rejects a signed-out import, save, language, key, build, and publish", async () => {
    const form = new FormData();
    form.set("platform", "android");
    form.set("locale", "en");
    form.set("file", new File(["key,value\nhello,Hello\n"], "en.csv", { type: "text/csv" }));
    await expect(importLanguageFile(null, form)).rejects.toThrow("REDIRECT:/sign-in");
    await expect(saveTranslation(null, form)).rejects.toThrow("REDIRECT:/sign-in");
    await expect(createLanguage(null, form)).rejects.toThrow("REDIRECT:/sign-in");
    await expect(createKey(null, form)).rejects.toThrow("REDIRECT:/sign-in");
    await expect(createSnapshot(null, form)).rejects.toThrow("REDIRECT:/sign-in");
    await expect(publishBuild(null, form)).rejects.toThrow("REDIRECT:/sign-in");
    const db = openDatabase(file);
    expect(db.prepare("SELECT COUNT(*) AS count FROM languages").get()).toEqual({ count: 0 });
    db.close();
  });

  it("imports through the authorized action and ignores a browser checksum on publish", async () => {
    allow();
    const form = new FormData();
    form.set("platform", "android");
    form.set("locale", "en");
    form.set("file", new File(["key,value\nhello,Hello\n"], "en.csv", { type: "text/csv" }));
    await expect(importLanguageFile(null, form)).resolves.toMatchObject({ ok: true });
    const db = openDatabase(file);
    const buildId = createBuild(db, "android");
    db.close();
    const publishForm = new FormData();
    publishForm.set("buildId", String(buildId));
    publishForm.set("checksum", "deadbeef");
    publishForm.set("objectPath", "android/evil.json");
    publishForm.set("body", "{\"strings\":{\"hacked\":\"yes\"}}");
    const result = await publishBuild(null, publishForm);
    expect(result.ok).toBe(true);
    const stored = [...sharedMemoryStorage().objects.keys()];
    expect(stored).not.toContain("android/evil.json");
    const language = [...sharedMemoryStorage().objects.values()].find((entry) => entry.bytes.toString("utf8").includes("hello"));
    expect(language?.bytes.toString("utf8")).toContain("Hello");
    expect(language?.bytes.toString("utf8")).not.toContain("hacked");
    expect(revalidatePath).toHaveBeenCalledWith("/editor");
  });

  it("saves an edited value for an authorized user", async () => {
    allow();
    const db = openDatabase(file);
    importTranslations(db, "android", "en", "en.csv", "key,value\nhello,Hello\n");
    db.close();
    const form = new FormData();
    form.set("platform", "android");
    form.set("locale", "en");
    form.set("key", "hello");
    form.set("value", "Updated");
    await expect(saveTranslation(null, form)).resolves.toEqual({ ok: true, message: "Saved." });
    const check = openDatabase(file);
    expect(check.prepare("SELECT value FROM translation_values").get()).toEqual({ value: "Updated" });
    check.close();
  });
});
