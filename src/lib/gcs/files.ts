import { createHash } from "node:crypto";
import type { Platform } from "@/src/features/catalog/validation";

export type LanguageFile = {
  locale: string;
  name: string;
  bytes: Buffer;
  checksum: string;
};

export function languageFileBytes(entries: { key: string; value: string }[]) {
  const strings: Record<string, string> = {};
  for (const entry of [...entries].sort((left, right) => left.key.localeCompare(right.key))) {
    strings[entry.key] = entry.value;
  }
  return Buffer.from(`${JSON.stringify({ strings }, null, 2)}\n`, "utf8");
}

export function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function objectName(platform: Platform, locale: string, updatedTime: string) {
  return `${platform}/${locale}/${updatedTime.replaceAll(":", "-")}.json`;
}

export function manifestName(platform: Platform) {
  return `${platform}/manifest.json`;
}

export function publicObjectUrl(bucket: string, name: string) {
  return `https://storage.googleapis.com/${bucket}/${name}`;
}

export function languageFiles(platform: Platform, updatedTime: string, rows: { locale: string; key: string; value: string }[]): LanguageFile[] {
  const byLocale = new Map<string, { key: string; value: string }[]>();
  for (const row of rows) {
    const entries = byLocale.get(row.locale) ?? [];
    entries.push({ key: row.key, value: row.value });
    byLocale.set(row.locale, entries);
  }
  return [...byLocale.keys()].sort((left, right) => left.localeCompare(right)).map((locale) => {
    const bytes = languageFileBytes(byLocale.get(locale) ?? []);
    return { locale, name: objectName(platform, locale, updatedTime), bytes, checksum: sha256(bytes) };
  });
}

export function manifestBytes(updatedTime: string, files: LanguageFile[], bucket: string) {
  const languages: Record<string, { url: string; checksum: string }> = {};
  for (const file of files) {
    languages[file.locale] = { url: publicObjectUrl(bucket, file.name), checksum: file.checksum };
  }
  return Buffer.from(`${JSON.stringify({ updatedTime, languages }, null, 2)}\n`, "utf8");
}

export function objectNameFromPublicUrl(bucket: string, url: string) {
  const prefix = `https://storage.googleapis.com/${bucket}/`;
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
}
