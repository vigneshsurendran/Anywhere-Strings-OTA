"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthorizationError, requireAdmin } from "@/src/lib/auth/session";
import type { ActionResult } from "@/src/features/catalog/types";
import { InputError } from "@/src/features/catalog/validation";
import { addAccess, removeAccess, setAccessRole, type AccessRole } from "@/src/server/access";
import { withDatabase } from "@/src/server/database";

async function guard() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.status === 403 ? "/sign-in?error=AccessDenied" : "/sign-in");
    }
    throw error;
  }
}

function failure(error: unknown): ActionResult {
  if (error instanceof InputError) return { ok: false, error: error.message };
  throw error;
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readRole(value: string): AccessRole {
  if (value !== "admin" && value !== "user") throw new InputError("Choose admin or user. Nothing was saved.");
  return value;
}

function refresh() {
  revalidatePath("/access", "layout");
  revalidatePath("/editor", "layout");
}

export async function addAccessAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const email = field(formData, "email");
    withDatabase((db) => addAccess(db, email, readRole(field(formData, "role"))));
    refresh();
    return { ok: true, message: `Added ${email.trim().toLowerCase()}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function setAccessRoleAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const email = field(formData, "email");
    const role = readRole(field(formData, "role"));
    withDatabase((db) => setAccessRole(db, email, role));
    refresh();
    return { ok: true, message: `Updated ${email.trim().toLowerCase()}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function removeAccessAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const email = field(formData, "email");
    withDatabase((db) => removeAccess(db, email));
    refresh();
    return { ok: true, message: `Removed ${email.trim().toLowerCase()}.` };
  } catch (error) {
    return failure(error);
  }
}
