import { describe, expect, it } from "vitest";
import { CATALOG_LANGUAGES, isCatalogLanguage } from "@/src/features/catalog/languages";

describe("language catalog", () => {
  it("shows ten popular languages and keeps every other language searchable", () => {
    const popular = CATALOG_LANGUAGES.filter((language) => language.popular).map((language) => language.code);
    expect(popular).toEqual(["en", "es", "pt", "fr", "de", "it", "nl", "zh", "ja", "ko"]);
    expect(CATALOG_LANGUAGES.length).toBeGreaterThan(popular.length);
    expect(isCatalogLanguage("fi")).toBe(true);
    expect(isCatalogLanguage("vi")).toBe(true);
    expect(isCatalogLanguage("pt-PT")).toBe(true);
    expect(isCatalogLanguage("pt-BR")).toBe(false);
    expect(new Set(CATALOG_LANGUAGES.map((language) => language.code)).size).toBe(CATALOG_LANGUAGES.length);
  });
});
