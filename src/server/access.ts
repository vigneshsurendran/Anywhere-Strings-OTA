import { isAllowedEmail } from "@/src/lib/auth/policy";
import { InputError } from "@/src/features/catalog/validation";
import type { CatalogDatabase } from "@/src/server/database";

export type AccessRole = "admin" | "user";

export type AccessRow = {
  email: string;
  role: AccessRole;
};

export function listAccess(db: CatalogDatabase): AccessRow[] {
  return db.prepare("SELECT email, role FROM access ORDER BY email").all() as AccessRow[];
}

export function findAccess(db: CatalogDatabase, email: string) {
  return db.prepare("SELECT role FROM access WHERE email = ?").get(email) as { role: AccessRole } | undefined;
}

export function claimFirstAdmin(db: CatalogDatabase, email: string) {
  const apply = db.transaction(() => {
    const count = db.prepare("SELECT COUNT(*) AS count FROM access").get() as { count: number };
    if (count.count > 0) return false;
    db.prepare("INSERT INTO access (email, role, created_at) VALUES (?, 'admin', ?)").run(email, timestamp());
    return true;
  });
  return apply();
}

export function addAccess(db: CatalogDatabase, email: string, role: AccessRole) {
  const normalized = normalizeEmail(email);
  assertRole(role);
  if (!isAllowedEmail(normalized)) throw new InputError("That email cannot be added. Nothing was saved.");
  const existing = findAccess(db, normalized);
  if (existing) throw new InputError("That email is already listed. Nothing was saved.");
  db.prepare("INSERT INTO access (email, role, created_at) VALUES (?, ?, ?)").run(normalized, role, timestamp());
}

export function setAccessRole(db: CatalogDatabase, email: string, role: AccessRole) {
  const normalized = normalizeEmail(email);
  assertRole(role);
  const apply = db.transaction(() => {
    const existing = findAccess(db, normalized);
    if (!existing) throw new InputError("That email is not listed. Nothing was saved.");
    if (existing.role === "admin" && role !== "admin") assertAnotherAdmin(db, normalized);
    db.prepare("UPDATE access SET role = ? WHERE email = ?").run(role, normalized);
  });
  apply();
}

export function removeAccess(db: CatalogDatabase, email: string) {
  const normalized = normalizeEmail(email);
  const apply = db.transaction(() => {
    const existing = findAccess(db, normalized);
    if (!existing) throw new InputError("That email is not listed. Nothing was saved.");
    if (existing.role === "admin") assertAnotherAdmin(db, normalized);
    db.prepare("DELETE FROM access WHERE email = ?").run(normalized);
  });
  apply();
}

function assertAnotherAdmin(db: CatalogDatabase, email: string) {
  const admins = db.prepare("SELECT COUNT(*) AS count FROM access WHERE role = 'admin' AND email != ?").get(email) as { count: number };
  if (admins.count === 0) throw new InputError("Keep at least one admin. Nothing was saved.");
}

function assertRole(role: string): asserts role is AccessRole {
  if (role !== "admin" && role !== "user") throw new InputError("Choose admin or user. Nothing was saved.");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function timestamp() {
  return new Date().toISOString();
}
