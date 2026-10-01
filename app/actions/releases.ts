"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthorizationError, requireAuthorizedUser } from "@/src/lib/auth/session";
import { bucketName, createObjectStorage } from "@/src/lib/gcs";
import type { ActionResult } from "@/src/features/catalog/types";
import { InputError, StorageError, isPlatform } from "@/src/features/catalog/validation";
import { withDatabase, withDatabaseAsync } from "@/src/server/database";
import { createRelease, renameRelease, setReleaseProduction } from "@/src/server/releases";

async function guard() {
  const user = await requireAuthorizedUser().catch((error: unknown) => {
    if (error instanceof AuthorizationError) {
      redirect(error.status === 403 ? "/sign-in?error=AccessDenied" : "/sign-in");
    }
    throw error;
  });
  return user;
}

function failure(error: unknown): ActionResult {
  if (error instanceof InputError || error instanceof StorageError) return { ok: false, error: error.message };
  throw error;
}

function refresh() {
  revalidatePath("/editor", "layout");
  revalidatePath("/releases", "layout");
}

export async function createReleaseAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await guard();
  try {
    const platform = formData.get("platform");
    if (!isPlatform(platform)) return { ok: false, error: "Choose Android or iOS." };
    const release = await withDatabaseAsync((db) => createRelease(db, createObjectStorage(), {
      platform,
      name: typeof formData.get("name") === "string" ? String(formData.get("name")) : "",
      createdBy: user.email,
    }));
    refresh();
    return { ok: true, message: `Created ${release.platform} version ${release.version}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function renameReleaseAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return { ok: false, error: "That release does not exist." };
    const name = typeof formData.get("name") === "string" ? String(formData.get("name")) : "";
    withDatabase((db) => renameRelease(db, id, name));
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setProductionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await guard();
  try {
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return { ok: false, error: "That release does not exist." };
    const release = await withDatabaseAsync((db) => setReleaseProduction(db, createObjectStorage(), {
      releaseId: id,
      bucket: bucketName(),
      releasedBy: user.email,
    }));
    refresh();
    return { ok: true, message: `${release.platform} version ${release.version} is production.` };
  } catch (error) {
    return failure(error);
  }
}
