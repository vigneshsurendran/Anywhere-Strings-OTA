import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, configured, redirect } = vi.hoisted(() => ({
  auth: vi.fn(),
  configured: vi.fn(() => true),
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
}));

vi.mock("@/src/lib/auth", () => ({ auth }));
vi.mock("@/src/lib/auth/environment", () => ({ isAuthConfigured: configured }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addAccessAction, removeAccessAction } from "@/app/actions/access";
import { addSupportedLanguageAction } from "@/app/actions/catalog";
import { addAccess } from "@/src/server/access";
import { openDatabase } from "@/src/server/database";

let directory = "";
let file = "";

beforeEach(() => {
  vi.clearAllMocks();
  configured.mockReturnValue(true);
  directory = mkdtempSync(path.join(tmpdir(), "publisher-access-"));
  file = path.join(directory, "publisher.sqlite");
  vi.stubEnv("PUBLISHER_DATABASE_PATH", file);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AUTH_ADMIN_EMAILS", "person@anywhere.co");
  auth.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe("access and supported-language actions", () => {
  it("rejects a signed-out request", async () => {
    const form = new FormData();
    form.set("email", "editor@anywhere.co");
    form.set("role", "user");
    form.set("locale", "es");
    form.set("mode", "translate");
    await expect(addAccessAction(null, form)).rejects.toThrow("REDIRECT:/sign-in");
    await expect(addSupportedLanguageAction(null, form)).rejects.toThrow("REDIRECT:/sign-in");
    const db = openDatabase(file);
    expect(db.prepare("SELECT email FROM access WHERE email = 'editor@anywhere.co'").get()).toBeUndefined();
    expect(db.prepare("SELECT COUNT(*) AS count FROM languages").get()).toEqual({ count: 0 });
    db.close();
  });

  it("rejects a listed user who is not an admin", async () => {
    const db = openDatabase(file);
    addAccess(db, "editor@anywhere.co", "user");
    db.close();
    auth.mockResolvedValue({
      user: { email: "editor@anywhere.co", emailVerified: true },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    const form = new FormData();
    form.set("email", "other@anywhere.co");
    form.set("role", "user");
    await expect(removeAccessAction(null, form)).rejects.toThrow("REDIRECT:/sign-in?error=AccessDenied");
    const check = openDatabase(file);
    expect(check.prepare("SELECT email FROM access WHERE email = 'editor@anywhere.co'").get()).toEqual({ email: "editor@anywhere.co" });
    check.close();
  });
});