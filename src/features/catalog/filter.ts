import type { EditorRow } from "@/src/features/catalog/types";

export type FilterableRow = {
  key: string;
  value: string | null;
};

const cellSeparator = "\0";

// Search compares the query as entered. It does not trim stored values.
export function filterRows<T extends FilterableRow>(rows: T[], query: string): T[] {
  if (query === "") return rows;
  const needle = query.toLowerCase();
  return rows.filter((row) => {
    const value = row.value ?? "";
    return row.key.toLowerCase().includes(needle) || value.toLowerCase().includes(needle);
  });
}

export type IndexedEditorRow = {
  row: EditorRow;
  keyText: string;
  valueText: string[];
};

export function editorCellId(key: string, code: string) {
  return `${key}${cellSeparator}${code}`;
}

export function readEditorCellId(id: string) {
  const split = id.indexOf(cellSeparator);
  if (split <= 0) return null;
  return { key: id.slice(0, split), code: id.slice(split + cellSeparator.length) };
}

// Lowercase the catalog once. Search then checks this index instead of every stored value.
export function indexEditorRows(rows: EditorRow[], languages: readonly { code: string }[]): IndexedEditorRow[] {
  return rows.map((row) => ({
    row,
    keyText: row.key.toLowerCase(),
    valueText: languages.map((language) => (row.values[language.code] ?? "").toLowerCase()),
  }));
}

export type MatchMode = "contains" | "exact";

export function filterEditorRows(
  rows: EditorRow[],
  indexed: readonly IndexedEditorRow[],
  languages: readonly { code: string }[],
  query: string,
  drafts: Readonly<Record<string, string>>,
  mode: MatchMode = "contains",
  caseSensitive = false,
): EditorRow[] {
  if (query === "") return rows;
  if (mode === "exact") {
    return rows.filter((row) => sameText(row.key, query, caseSensitive) || languages.some((language) => sameText(cellText(row, language.code, drafts), query, caseSensitive)));
  }
  if (caseSensitive) {
    return rows.filter((row) => row.key.includes(query) || languages.some((language) => cellText(row, language.code, drafts).includes(query)));
  }
  const needle = query.toLowerCase();
  const matches: EditorRow[] = [];
  for (const entry of indexed) {
    if (entry.keyText.includes(needle) || valueMatches(entry, languages, needle, drafts)) {
      matches.push(entry.row);
    }
  }
  return matches;
}

export function hasEmptyValue(
  row: EditorRow,
  languages: readonly { code: string }[],
  drafts: Readonly<Record<string, string>>,
) {
  return languages.some((language) => cellText(row, language.code, drafts) === "");
}

export function hasUnsavedValue(
  row: EditorRow,
  languages: readonly { code: string }[],
  drafts: Readonly<Record<string, string>>,
) {
  return languages.some((language) => {
    const id = editorCellId(row.key, language.code);
    return id in drafts && drafts[id] !== (row.values[language.code] ?? "");
  });
}

export function compareKeys(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function compareModified(left: string, right: string) {
  if (left === right) return 0;
  if (left === "") return 1;
  if (right === "") return -1;
  return right.localeCompare(left);
}

function sameText(left: string, right: string, caseSensitive: boolean) {
  return caseSensitive ? left === right : left.toLowerCase() === right.toLowerCase();
}

function cellText(row: EditorRow, code: string, drafts: Readonly<Record<string, string>>) {
  const id = editorCellId(row.key, code);
  return id in drafts ? drafts[id] : (row.values[code] ?? "");
}

function valueMatches(
  entry: IndexedEditorRow,
  languages: readonly { code: string }[],
  needle: string,
  drafts: Readonly<Record<string, string>>,
) {
  for (let index = 0; index < languages.length; index += 1) {
    const code = languages[index].code;
    const id = editorCellId(entry.row.key, code);
    const text = id in drafts ? drafts[id].toLowerCase() : entry.valueText[index];
    if (text.includes(needle)) return true;
  }
  return false;
}
