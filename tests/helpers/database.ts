import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDatabase, type CatalogDatabase } from "@/src/server/database";

export function temporaryDatabase() {
  const directory = mkdtempSync(path.join(tmpdir(), "publisher-"));
  const file = path.join(directory, "publisher.sqlite");
  const db = openDatabase(file);
  return {
    file,
    db,
    close() {
      try {
        db.close();
      } catch {
        // The caller may already have closed this connection.
      }
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export function valueOf(db: CatalogDatabase, platform: string, locale: string, key: string) {
  return db.prepare("SELECT value FROM translation_values WHERE platform = ? AND locale = ? AND key = ?")
    .get(platform, locale, key) as { value: string } | undefined;
}
