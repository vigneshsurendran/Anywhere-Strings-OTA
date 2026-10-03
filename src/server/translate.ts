import "server-only";
import { GoogleAuth } from "google-auth-library";
import { keepsPlaceholders, maskPlaceholders, unmaskPlaceholders } from "@/src/features/catalog/placeholders";

export type TranslationEntry = {
  key: string;
  text: string;
};

type TranslateResponse = {
  translations?: { translatedText?: string }[];
};

export async function translateFromEnglish(locale: string, entries: TranslationEntry[]): Promise<Record<string, string>> {
  const pending = entries.filter((entry) => entry.text !== "");
  if (pending.length === 0) return {};
  try {
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || await auth.getProjectId();
    if (!projectId) return {};
    const translated: Record<string, string> = {};
    for (let index = 0; index < pending.length; index += 80) {
      const chunk = pending.slice(index, index + 80);
      const masked = chunk.map((entry) => maskPlaceholders(entry.text));
      const response = await client.request<TranslateResponse>({
        url: `https://translation.googleapis.com/v3/projects/${projectId}/locations/global:translateText`,
        method: "POST",
        data: {
          contents: masked.map((item) => item.masked),
          sourceLanguageCode: "en",
          targetLanguageCode: locale,
          mimeType: "text/plain",
        },
      });
      const translations = response.data.translations ?? [];
      chunk.forEach((entry, entryIndex) => {
        const value = translations[entryIndex]?.translatedText;
        if (typeof value !== "string" || value.trim() === "") return;
        const restored = unmaskPlaceholders(value, masked[entryIndex]?.tokens ?? []);
        if (restored !== null && keepsPlaceholders(entry.text, restored)) translated[entry.key] = restored;
      });
    }
    return translated;
  } catch {
    return {};
  }
}
