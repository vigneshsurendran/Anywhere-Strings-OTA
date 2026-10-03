import { afterEach, describe, expect, it, vi } from "vitest";
import { addAccess, claimFirstAdmin, listAccess, removeAccess, setAccessRole } from "@/src/server/access";
import { openDatabase } from "@/src/server/database";
import { temporaryDatabase } from "../helpers/database";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("access list", () => {
  it("seeds anywhere.co admins and ignores other addresses", () => {
    vi.stubEnv("AUTH_ADMIN_EMAILS", " Admin@Anywhere.co , not-an-email, person@gmail.com ");
    const temp = temporaryDatabase();
    expect(listAccess(temp.db)).toEqual([{ email: "admin@anywhere.co", role: "admin" }]);
    temp.db.close();
    const again = openDatabase(temp.file);
    expect(listAccess(again)).toEqual([{ email: "admin@anywhere.co", role: "admin" }]);
    again.close();
    temp.close();
  });

  it("adds a user, rejects a duplicate or outside email, and keeps the last admin", () => {
    const temp = temporaryDatabase();
    addAccess(temp.db, "Admin@Anywhere.co", "admin");
    addAccess(temp.db, "editor@anywhere.co", "user");
    expect(listAccess(temp.db).map((row) => row.email)).toEqual(["admin@anywhere.co", "editor@anywhere.co"]);
    expect(() => addAccess(temp.db, "editor@anywhere.co", "user")).toThrow(/already listed/);
    expect(() => addAccess(temp.db, "person@gmail.com", "user")).toThrow(/cannot be added/);
    expect(() => setAccessRole(temp.db, "admin@anywhere.co", "user")).toThrow(/at least one admin/);
    expect(() => removeAccess(temp.db, "admin@anywhere.co")).toThrow(/at least one admin/);
    expect(listAccess(temp.db)).toEqual([
      { email: "admin@anywhere.co", role: "admin" },
      { email: "editor@anywhere.co", role: "user" },
    ]);
    removeAccess(temp.db, "editor@anywhere.co");
    expect(listAccess(temp.db)).toEqual([{ email: "admin@anywhere.co", role: "admin" }]);
    const before = temp.db.prepare("SELECT COUNT(*) AS count FROM translation_values").get();
    expect(before).toEqual({ count: 0 });
    temp.close();
  });

  it("makes the first relaxed sign-in an admin only while the list is empty", () => {
    const temp = temporaryDatabase();
    expect(claimFirstAdmin(temp.db, "person@gmail.com")).toBe(true);
    expect(claimFirstAdmin(temp.db, "other@gmail.com")).toBe(false);
    expect(listAccess(temp.db)).toEqual([{ email: "person@gmail.com", role: "admin" }]);
    temp.close();
  });
});
