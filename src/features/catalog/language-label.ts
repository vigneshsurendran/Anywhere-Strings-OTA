const NAMES: Record<string, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
};

export function languageLabel(code: string, stored = "") {
  const label = stored.trim();
  if (label) return label;
  const base = code.split(/[_-]/)[0]?.toLowerCase() ?? code;
  return NAMES[code.toLowerCase()] ?? NAMES[base] ?? code;
}
