"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthorizationError, requireAuthorizedUser } from "@/src/lib/auth/session";
import { bucketName, createObjectStorage } from "@/src/lib/gcs";
import { addKeyWithValue, addLanguage, deleteKeys, importTranslations, readPlatform, saveValue } from "@/src/server/catalog";
import { addSupportedLanguage } from "@/src/server/supported-language";
import { translateFromEnglish } from "@/src/server/translate";
import { createBuild, saveBuildValue } from "@/src/server/builds";
import { withDatabase, withDatabaseAsync } from "@/src/server/database";
import { publishSnapshot } from "@/src/server/publish";
import type { ActionResult } from "@/src/features/catalog/types";
import { InputError, StorageError } from "@/src/features/catalog/validation";

async function guard() {
  try {
    await requireAuthorizedUser();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.status === 403 ? "/sign-in?error=AccessDenied" : "/sign-in");
    }
    throw error;
  }
}

function failure(error: unknown): ActionResult {
  if (error instanceof InputError || error instanceof StorageError) return { ok: false, error: error.message };
  throw error;
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function importLanguageFile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const platform = readPlatform(field(formData, "platform"));
    const locale = field(formData, "locale");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a file to import. Nothing was imported." };
    }
    const contents = await file.text();
    const count = withDatabase((db) => importTranslations(db, platform, locale, file.name, contents));
    revalidatePath("/editor", "layout");
    revalidatePath("/releases", "layout");
    return { ok: true, message: `Imported ${count} translations into ${platform} / ${locale}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function saveTranslation(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const status = withDatabase((db) => saveValue(
      db,
      readPlatform(field(formData, "platform")),
      field(formData, "locale"),
      field(formData, "key"),
      field(formData, "value"),
    ));
    if (status === "saved") {
      revalidatePath("/editor", "layout");
      revalidatePath("/releases", "layout");
    }
    return { ok: true, message: status === "saved" ? "Saved." : "No change to save." };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteSelectedKeys(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const platform = readPlatform(field(formData, "platform"));
    const keys = formData.getAll("key").filter((value): value is string => typeof value === "string");
    const count = withDatabase((db) => deleteKeys(db, platform, keys));
    revalidatePath("/editor", "layout");
    revalidatePath("/releases", "layout");
    return { ok: true, message: `Deleted ${count} ${count === 1 ? "key" : "keys"}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function createLanguage(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const platform = readPlatform(field(formData, "platform"));
    const locale = field(formData, "locale");
    withDatabase((db) => addLanguage(db, platform, locale, field(formData, "label")));
    revalidatePath("/editor", "layout");
    return { ok: true, message: `Added ${locale} to ${platform}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function createKey(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const platform = readPlatform(field(formData, "platform"));
    const key = field(formData, "key");
    const value = field(formData, "value");
    const translate = formData.get("translate") === "on";
    await withDatabaseAsync((db) => addKeyWithValue(db, platform, key, value, translate, translateFromEnglish));
    revalidatePath("/editor", "layout");
    return { ok: true, message: `Added ${key} to ${platform}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function addSupportedLanguageAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const locale = field(formData, "locale");
    const mode = field(formData, "mode") === "import" ? "import" : "translate";
    const uploaded = formData.get("file");
    const file = mode === "import" && uploaded instanceof File
      ? { filename: uploaded.name, text: await uploaded.text() }
      : null;
    const added = await withDatabaseAsync((db) => addSupportedLanguage(db, locale, mode, file, translateFromEnglish));
    revalidatePath("/editor", "layout");
    revalidatePath("/releases", "layout");
    return { ok: true, message: `Added ${locale} to ${added.join(" and ")}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function createSnapshot(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const platform = readPlatform(field(formData, "platform"));
    const id = withDatabase((db) => createBuild(db, platform));
    revalidatePath("/editor");
    return { ok: true, message: `Created build ${id}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function saveSnapshotValue(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const buildId = Number(field(formData, "buildId"));
    if (!Number.isInteger(buildId)) return { ok: false, error: "That build does not exist. Nothing was saved." };
    const status = withDatabase((db) => saveBuildValue(db, buildId, field(formData, "locale"), field(formData, "key"), field(formData, "value")));
    if (status === "saved") revalidatePath("/editor");
    return { ok: true, message: status === "saved" ? "Saved snapshot value." : "No change to save." };
  } catch (error) {
    return failure(error);
  }
}

export async function publishWorkingSet(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const platform = readPlatform(field(formData, "platform"));
    const published = await withDatabaseAsync(async (db) => {
      const buildId = createBuild(db, platform);
      return publishSnapshot(db, createObjectStorage(), { bucket: bucketName(), buildId });
    });
    revalidatePath("/editor");
    return { ok: true, message: `Published ${published.platform} at ${published.updatedTime}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function publishBuild(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await guard();
  try {
    const buildId = Number(field(formData, "buildId"));
    if (!Number.isInteger(buildId)) return { ok: false, error: "That build does not exist." };
    const published = await withDatabaseAsync((db) => publishSnapshot(db, createObjectStorage(), {
      bucket: bucketName(),
      buildId,
    }));
    revalidatePath("/editor");
    return { ok: true, message: `Published ${published.platform} at ${published.updatedTime}.` };
  } catch (error) {
    return failure(error);
  }
}
