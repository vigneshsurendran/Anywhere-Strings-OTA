import { InputError, MAX_IMPORT_KEY_LENGTH, MAX_VALUE_LENGTH } from "@/src/features/catalog/validation";

export type TranslationPair = {
  key: string;
  value: string;
};

const INVALID_FILE = "Choose a CSV file with a key,value header, an Android strings.xml file, or a JSON language file. Nothing was imported.";
const REJECTED_CONTENT = "That file has a blank key, a key longer than 500 characters, or a value longer than 100000 characters. Nothing was imported.";

export function parseImportFile(filename: string, text: string): TranslationPair[] {
  const kind = fileKind(filename, text);
  const pairs = kind === "csv" ? parseCsvFile(text) : kind === "xml" ? parseAndroidStrings(text) : parseJsonLanguage(text);
  return collapsePairs(pairs);
}

function fileKind(filename: string, text: string): "csv" | "xml" | "json" {
  const extension = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (extension === ".csv") return "csv";
  if (extension === ".xml") return "xml";
  if (extension === ".json") return "json";
  const start = text.trimStart();
  if (start.startsWith("{")) return "json";
  if (start.startsWith("<")) return "xml";
  if (start.startsWith("key,value")) return "csv";
  throw new InputError(INVALID_FILE);
}

function collapsePairs(pairs: TranslationPair[]): TranslationPair[] {
  const byKey = new Map<string, TranslationPair>();
  for (const pair of pairs) byKey.set(pair.key, pair);
  return [...byKey.values()];
}

function assertPair(key: string, value: string) {
  if (key.trim() === "" || key.length > MAX_IMPORT_KEY_LENGTH || value.length > MAX_VALUE_LENGTH) {
    throw new InputError(REJECTED_CONTENT);
  }
}

function parseCsvFile(text: string): TranslationPair[] {
  let rows: string[][];
  try {
    rows = parseCsv(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new InputError(INVALID_FILE);
  }
  if (rows.length === 0 || rows[0].length !== 2 || rows[0][0] !== "key" || rows[0][1] !== "value") {
    throw new InputError(INVALID_FILE);
  }
  return rows.slice(1).map((row) => {
    if (row.length !== 2) throw new InputError(INVALID_FILE);
    assertPair(row[0], row[1]);
    return { key: row[0], value: row[1] };
  });
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === "\"") {
        if (text[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("Unclosed quotes");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseAndroidStrings(text: string): TranslationPair[] {
  const source = text.replace(/<!--[\s\S]*?-->/g, "");
  if (!source.includes("<string")) throw new InputError(INVALID_FILE);
  const pairs: TranslationPair[] = [];
  const pattern = /<string\b([^>]*?)\/>|<string\b([^>]*)>([\s\S]*?)<\/string>/g;
  for (const match of source.matchAll(pattern)) {
    const attributes = match[1] || match[2] || "";
    const name = attributes.match(/\bname\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    const key = name?.[1] ?? name?.[2];
    if (key === undefined) throw new InputError(INVALID_FILE);
    const value = match[1] !== undefined ? "" : decodeXml(match[3] ?? "");
    assertPair(key, value);
    pairs.push({ key, value });
  }
  if (pairs.length === 0) throw new InputError(INVALID_FILE);
  return pairs;
}

function decodeXml(value: string): string {
  const withCdata = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return withCdata
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

function parseJsonLanguage(text: string): TranslationPair[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InputError(INVALID_FILE);
  }
  if (Array.isArray(parsed)) return parsed.flatMap(pairsFromArrayItem);
  if (!parsed || typeof parsed !== "object") throw new InputError(INVALID_FILE);
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "strings")) throw new InputError(INVALID_FILE);
  if (!record.strings || typeof record.strings !== "object" || Array.isArray(record.strings)) throw new InputError(INVALID_FILE);
  return stringEntries(record.strings as Record<string, unknown>);
}

function pairsFromArrayItem(item: unknown): TranslationPair[] {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new InputError(INVALID_FILE);
  const record = item as Record<string, unknown>;
  const names = Object.keys(record);
  if (names.length === 2 && typeof record.key === "string" && typeof record.value === "string" && names.includes("key") && names.includes("value")) {
    assertPair(record.key, record.value);
    return [{ key: record.key, value: record.value }];
  }
  if (names.length === 0) throw new InputError(INVALID_FILE);
  return stringEntries(record);
}

function stringEntries(record: Record<string, unknown>): TranslationPair[] {
  return Object.entries(record).map(([key, value]) => {
    if (typeof value !== "string") throw new InputError(INVALID_FILE);
    assertPair(key, value);
    return { key, value };
  });
}
