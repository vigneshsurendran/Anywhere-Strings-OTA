"use client";

import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useActionState } from "react";
import { ChevronDown, Loader2, Quote, Search, X } from "lucide-react";
import { blockDismiss, PendingButton } from "@/src/components/common/pending-button";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { FormMessage } from "@/src/components/publisher/import-form";
import { ImportForm } from "@/src/components/publisher/import-form";
import { LanguageSelect } from "@/src/components/publisher/language-select";
import { PlatformIcon } from "@/src/components/publisher/platform-icon";
import { compareKeys, compareModified, editorCellId, filterEditorRows, hasEmptyValue, hasUnsavedValue, indexEditorRows, readEditorCellId } from "@/src/features/catalog/filter";
import { CATALOG_LANGUAGES } from "@/src/features/catalog/languages";
import { languageLabel } from "@/src/features/catalog/language-label";
import type { ActionResult, EditorLanguage, EditorRow } from "@/src/features/catalog/types";
import type { Platform } from "@/src/features/catalog/validation";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";

type Catalog = { languages: EditorLanguage[]; rows: EditorRow[] };
type Scope = "all" | Platform;
type ValueFilter = "all" | "empty" | "unsaved";
type KeySort = "az" | "za" | "modified";
type Card = { platform: Platform; row: EditorRow; languages: EditorLanguage[] };

export function EditorScreen({
  platform,
  onPlatform,
  catalogs,
  importAction,
  saveAction,
  deleteAction,
  addKeyAction,
  addSupportedAction,
  onUnsavedCount,
  active = true,
}: {
  platform: Platform;
  onPlatform: (platform: Platform) => void;
  catalogs: Record<Platform, Catalog>;
  importAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  saveAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  deleteAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  addKeyAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  addSupportedAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  onUnsavedCount?: (count: number) => void;
  active?: boolean;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [exact, setExact] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [valueFilter, setValueFilter] = useState<ValueFilter>("all");
  const [sort, setSort] = useState<KeySort>("az");
  const actionPlatform: Platform = scope === "all" ? platform : scope;
  const [selectedByPlatform, setSelectedByPlatform] = useState<Record<Platform, string[]>>({ android: [], ios: [] });
  const [drafts, setDrafts] = useState<Record<Platform, Record<string, string>>>({ android: {}, ios: {} });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keySession, setKeySession] = useState(0);
  const [supportedOpen, setSupportedOpen] = useState(false);
  const [supportedSession, setSupportedSession] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const rowMaps = useMemo(() => ({
    android: new Map(catalogs.android.rows.map((row) => [row.key, row])),
    ios: new Map(catalogs.ios.rows.map((row) => [row.key, row])),
  }), [catalogs.android.rows, catalogs.ios.rows]);
  const visible = useMemo(() => {
    const entries = scope === "all" ? (["android", "ios"] as const) : ([scope] as const);
    const cards: Card[] = [];
    for (const entry of entries) {
      const languages = catalogs[entry].languages;
      if (languages.length === 0) continue;
      const source = catalogs[entry].rows;
      const indexed = indexEditorRows(source, languages);
      let rows = filterEditorRows(source, indexed, languages, deferredQuery, drafts[entry], exact ? "exact" : "contains", caseSensitive);
      if (valueFilter === "empty") rows = rows.filter((row) => hasEmptyValue(row, languages, drafts[entry]));
      if (valueFilter === "unsaved") rows = rows.filter((row) => hasUnsavedValue(row, languages, drafts[entry]));
      for (const row of rows) cards.push({ platform: entry, row, languages });
    }
    cards.sort((left, right) => {
      if (sort === "modified") {
        const byTime = compareModified(left.row.updatedAt ?? "", right.row.updatedAt ?? "");
        if (byTime !== 0) return byTime;
      }
      const byKey = compareKeys(left.row.key, right.row.key);
      if (byKey !== 0) return sort === "za" ? -byKey : byKey;
      return left.platform.localeCompare(right.platform);
    });
    return cards;
  }, [caseSensitive, catalogs, deferredQuery, drafts, exact, scope, sort, valueFilter]);
  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of visible) counts.set(card.row.key, (counts.get(card.row.key) ?? 0) + 1);
    return counts;
  }, [visible]);
  const allVisibleSelected = visible.length > 0 && visible.every((card) => selectedByPlatform[card.platform].includes(card.row.key));
  const someVisibleSelected = visible.some((card) => selectedByPlatform[card.platform].includes(card.row.key));
  const deleteTargets = useMemo(() => {
    const entries = scope === "all" ? (["android", "ios"] as const) : ([scope] as const);
    return entries.flatMap((entry) => selectedByPlatform[entry].map((key) => ({ platform: entry, key })));
  }, [scope, selectedByPlatform]);
  const languageCodes = useMemo(() => ({
    android: new Set(catalogs.android.languages.map((language) => language.code)),
    ios: new Set(catalogs.ios.languages.map((language) => language.code)),
  }), [catalogs.android.languages, catalogs.ios.languages]);
  const unsavedCount = useMemo(() => {
    let total = 0;
    for (const entry of ["android", "ios"] as const) {
      for (const [id, value] of Object.entries(drafts[entry])) {
        const stored = storedCellValue(id, rowMaps[entry], languageCodes[entry]);
        if (stored !== null && value !== stored) total += 1;
      }
    }
    return total;
  }, [drafts, languageCodes, rowMaps]);
  const prunedDrafts = pruneDrafts(drafts, rowMaps, languageCodes);
  if (prunedDrafts !== drafts) setDrafts(prunedDrafts);
  const [scrollMargin, setScrollMargin] = useState(0);
  const deleteShown = deleteTargets.length > 0;
  const scopePlatforms = scope === "all" ? (["android", "ios"] as const) : ([scope] as const);
  const scopeHasLanguages = scopePlatforms.some((entry) => catalogs[entry].languages.length > 0);
  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node || !active) return;
    const measure = () => {
      if (node.getClientRects().length === 0) return;
      const next = node.getBoundingClientRect().top + window.scrollY;
      setScrollMargin((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [active, deleteShown, scopeHasLanguages, visible.length]);
  const virtualizer = useWindowVirtualizer({
    count: scopeHasLanguages ? visible.length : 0,
    estimateSize: (index) => Math.max(72, (visible[index]?.languages.length ?? 1) * 52),
    overscan: 8,
    gap: 12,
    scrollMargin,
    initialRect: { width: 1280, height: 900 },
    getItemKey: (index) => {
      const card = visible[index];
      return card ? `${card.platform}:${card.row.key}` : `row-${index}`;
    },
    measureElement: (element) => {
      const height = element.getBoundingClientRect().height;
      const index = Number(element.getAttribute("data-index"));
      return height > 0 ? height : Math.max(72, (visible[index]?.languages.length ?? 1) * 52);
    },
  });

  useEffect(() => {
    onUnsavedCount?.(unsavedCount);
  }, [onUnsavedCount, unsavedCount]);

  function chooseScope(next: Scope) {
    setScope(next);
    if (next !== "all") onPlatform(next);
  }

  function toggleVisible() {
    setSelectedByPlatform((current) => {
      const next = { android: [...current.android], ios: [...current.ios] };
      for (const card of visible) {
        const list = next[card.platform];
        const index = list.indexOf(card.row.key);
        if (allVisibleSelected) {
          if (index >= 0) list.splice(index, 1);
        } else if (index < 0) {
          list.push(card.row.key);
        }
      }
      return next;
    });
  }

  const toggleKey = useCallback((entry: Platform, key: string) => {
    setSelectedByPlatform((current) => {
      const currentKeys = current[entry];
      const next = currentKeys.includes(key) ? currentKeys.filter((item) => item !== key) : [...currentKeys, key];
      return { ...current, [entry]: next };
    });
  }, []);

  const changeDraft = useCallback((entry: Platform, id: string, value: string) => {
    setDrafts((current) => ({ ...current, [entry]: { ...current[entry], [id]: value } }));
    setErrors((current) => ({ ...current, [`${entry}:${id}`]: "" }));
  }, []);

  const commit = useCallback(async (entry: Platform, key: string, code: string) => {
    const id = editorCellId(key, code);
    const draft = drafts[entry][id];
    if (draft === undefined) return;
    const stored = rowMaps[entry].get(key)?.values[code] ?? "";
    if (draft === stored) return;
    const formData = new FormData();
    formData.set("platform", entry);
    formData.set("locale", code);
    formData.set("key", key);
    formData.set("value", draft);
    const saving = `${entry}:${id}`;
    setSavingId(saving);
    const result = await saveAction(null, formData);
    setSavingId(null);
    if (!result.ok) {
      setErrors((current) => ({ ...current, [saving]: result.error ?? "The value was not saved." }));
      return;
    }
    setErrors((current) => ({ ...current, [saving]: "" }));
  }, [drafts, rowMaps, saveAction]);

  const supportedChoices = useMemo(() => {
    const codes = (entries: EditorLanguage[]) => new Set(entries.map((language) => language.code.toLowerCase()));
    const stored = { android: codes(catalogs.android.languages), ios: codes(catalogs.ios.languages) };
    const withEnglish = (["android", "ios"] as const).filter((platform) => stored[platform].has("en"));
    return {
      needsEnglish: withEnglish.length === 0,
      languages: CATALOG_LANGUAGES.filter((language) => {
        const code = language.code.toLowerCase();
        return code !== "en" && withEnglish.some((platform) => !stored[platform].has(code));
      }),
    };
  }, [catalogs.android.languages, catalogs.ios.languages]);
  const virtualRows = virtualizer.getVirtualItems();
  const actionLanguages = catalogs[actionPlatform].languages;
  const narrowed = deferredQuery !== "" || valueFilter !== "all";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-primary">Editor</h1>
        <span className="flex-1" />
        <ToolbarSelect label="Platform" value={scope} onChange={(value) => chooseScope(value as Scope)}>
          <option value="all">All</option>
          <option value="ios">iOS</option>
          <option value="android">Android</option>
        </ToolbarSelect>
        <Button type="button" variant="outline" size="sm" className="border-[#e5e5e5] bg-canvas text-primary" onClick={() => { setNotice(null); setImportOpen(true); }}>
          Import
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[#e5e5e5] bg-canvas text-primary"
          onClick={() => {
            setNotice(null);
            setKeySession((current) => current + 1);
            setKeyOpen(true);
          }}
        >
          Add key
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[#e5e5e5] bg-canvas text-primary"
          onClick={() => {
            setSupportedSession((current) => current + 1);
            setSupportedOpen(true);
          }}
        >
          Add language
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 min-w-64 flex-1 items-center gap-2 rounded-md border border-[#e5e5e5] bg-canvas px-2.5 text-primary">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search keys or values"
            aria-label="Search"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <span aria-label="Matching keys" className="rounded-md bg-[#f3f3f3] px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">{visible.length}</span>
          <button
            type="button"
            aria-label="Toggle Exact Match"
            title="Toggle Exact Match"
            aria-pressed={exact}
            onClick={() => setExact((current) => !current)}
            className={`rounded p-0.5 ${exact ? "bg-[#f3f3f3] text-primary" : "text-muted-foreground hover:bg-[#f3f3f3]"}`}
          >
            <Quote className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Case sensitive"
            title="Case sensitive"
            aria-pressed={caseSensitive}
            onClick={() => setCaseSensitive((current) => !current)}
            className={`rounded px-1 text-sm font-medium ${caseSensitive ? "bg-[#f3f3f3] text-primary" : "text-muted-foreground hover:bg-[#f3f3f3]"}`}
          >
            Aa
          </button>
          {query !== "" ? (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="rounded p-0.5 text-muted-foreground hover:bg-accent">
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
        <label className="flex items-center gap-2 text-sm text-primary">
          <input
            type="checkbox"
            className="size-4 accent-ink"
            checked={allVisibleSelected}
            ref={(node) => { if (node) node.indeterminate = someVisibleSelected && !allVisibleSelected; }}
            onChange={toggleVisible}
            aria-label="Select all"
          />
          Select all
        </label>
        <ToolbarSelect label="Filter" value={valueFilter} onChange={(value) => setValueFilter(value as ValueFilter)}>
          <option value="all">Filter</option>
          <option value="empty">Empty values</option>
          <option value="unsaved">Unsaved</option>
        </ToolbarSelect>
        <ToolbarSelect label="Sort" value={sort} onChange={(value) => setSort(value as KeySort)}>
          <option value="az">Sort by key name A-Z</option>
          <option value="za">Sort by key name Z-A</option>
          <option value="modified">Sort by last modified</option>
        </ToolbarSelect>
        {deleteShown ? (
          <Button type="button" size="sm" className="bg-critical text-onPrimary hover:bg-critical/90" onClick={() => setDeleteOpen(true)}>
            {`Delete ${deleteTargets.length}`}
          </Button>
        ) : null}
      </div>
      {!scopeHasLanguages ? (
        <p className="text-sm text-secondary">
          This catalog is empty.
          {scope !== "all" && catalogs[scope === "android" ? "ios" : "android"].languages.length > 0
            ? ` ${scope === "android" ? "iOS" : "Android"} still has saved languages.`
            : null}
        </p>
      ) : (
        <div ref={listRef}>
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualRows.map((virtualRow) => {
              const card = visible[virtualRow.index];
              if (!card) return null;
              const selectLabel = (duplicateKeys.get(card.row.key) ?? 0) > 1
                ? `Select ${card.platform === "android" ? "Android" : "iOS"} ${card.row.key}`
                : `Select ${card.row.key}`;
              return (
                <div
                  key={`${card.platform}:${card.row.key}`}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
                >
                  <KeyCard
                    platform={card.platform}
                    row={card.row}
                    languages={card.languages}
                    showPlatform={scope === "all"}
                    checked={selectedByPlatform[card.platform].includes(card.row.key)}
                    selectLabel={selectLabel}
                    overrides={drafts[card.platform]}
                    errors={errors}
                    savingId={savingId}
                    onToggle={toggleKey}
                    onDraft={changeDraft}
                    onCommit={commit}
                  />
                </div>
              );
            })}
          </div>
          {visible.length === 0 && narrowed ? <p className="text-sm text-secondary">No keys match that search.</p> : null}
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={blockDismiss(importBusy, setImportOpen)}>
        <DialogContent className="sm:max-w-md" showCloseButton={!importBusy}>
          <DialogHeader>
            <DialogTitle>Import</DialogTitle>
            <DialogDescription>
              Import a CSV, Android strings file, or JSON language file into the platform and locale you choose. Values in the file replace saved text for that language.
            </DialogDescription>
          </DialogHeader>
          <ImportForm onBusy={setImportBusy} action={async (state, formData) => {
            const result = await importAction(state, formData);
            if (result.ok) {
              setNotice(result.message ?? "Imported.");
              setImportOpen(false);
            }
            return result;
          }} platform={actionPlatform} embedded />
        </DialogContent>
      </Dialog>
      <AddKeyDialog
        key={`add-key-${keySession}`}
        open={keyOpen}
        onOpenChange={setKeyOpen}
        action={addKeyAction}
        platform={actionPlatform}
        languages={actionLanguages}
        onAdded={(message) => setNotice(message)}
      />
      <SupportedDialog
        key={`add-language-${supportedSession}`}
        open={supportedOpen}
        onOpenChange={setSupportedOpen}
        action={addSupportedAction}
        languages={supportedChoices.languages}
        needsEnglish={supportedChoices.needsEnglish}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        action={deleteAction}
        targets={deleteTargets}
        onDeleted={() => {
          setSelectedByPlatform((current) => {
            if (scope === "all") return { android: [], ios: [] };
            return { ...current, [scope]: [] };
          });
          setDeleteOpen(false);
        }}
      />
    </main>
  );
}

const KeyCard = memo(function KeyCard({
  platform,
  row,
  languages,
  showPlatform,
  checked,
  selectLabel,
  overrides,
  errors,
  savingId,
  onToggle,
  onDraft,
  onCommit,
}: {
  platform: Platform;
  row: EditorRow;
  languages: EditorLanguage[];
  showPlatform: boolean;
  checked: boolean;
  selectLabel: string;
  overrides: Record<string, string>;
  errors: Record<string, string>;
  savingId: string | null;
  onToggle: (platform: Platform, key: string) => void;
  onDraft: (platform: Platform, id: string, value: string) => void;
  onCommit: (platform: Platform, key: string, code: string) => void;
}) {
  return (
    <div data-platform={platform} data-key={row.key} className="grid grid-cols-1 overflow-hidden rounded-[10px] border border-secondary bg-canvas sm:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex items-start gap-2 border-l-4 border-ink bg-canvas-secondary p-3">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-ink"
          checked={checked}
          onChange={() => onToggle(platform, row.key)}
          aria-label={selectLabel}
        />
        <span className="min-w-0">
          <span className="block font-mono text-xs break-all text-primary">{row.key}</span>
          {showPlatform ? (
            <span className="mt-1 block text-secondary" aria-label={platform === "android" ? "Android" : "iOS"} title={platform === "android" ? "Android" : "iOS"}>
              <PlatformIcon platform={platform} />
            </span>
          ) : null}
        </span>
      </div>
      <div>
        {languages.map((language, index) => {
          const id = editorCellId(row.key, language.code);
          const errorId = `${platform}:${id}`;
          const stored = row.values[language.code] ?? "";
          const value = id in overrides ? overrides[id] : stored;
          const label = languageLabel(language.code, language.label);
          return (
            <div key={language.code} className={`flex items-center gap-3 px-3 py-2 ${index % 2 === 0 ? "bg-neutral-secondary" : "bg-canvas"}`}>
              <div data-language={language.code} className="w-44 shrink-0 text-sm font-medium text-secondary">{label}</div>
              <div className="min-w-0 flex-1">
                <Input
                  value={value}
                  aria-label={`${label} value for ${row.key}`}
                  placeholder="Empty"
                  onChange={(event) => onDraft(platform, id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onCommit(platform, row.key, language.code);
                    }
                  }}
                  className="border-secondary bg-canvas text-primary placeholder:text-critical"
                />
                {errors[errorId] ? <p role="alert" className="mt-1 text-sm text-critical">{errors[errorId]}</p> : null}
              </div>
              {value !== stored ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-ink text-onPrimary hover:bg-ink-hover"
                  disabled={savingId === errorId}
                  aria-busy={savingId === errorId || undefined}
                  onClick={() => onCommit(platform, row.key, language.code)}
                >
                  {savingId === errorId ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {savingId === errorId ? "Saving…" : "Save"}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function pruneDrafts(
  drafts: Record<Platform, Record<string, string>>,
  rowMaps: Record<Platform, Map<string, EditorRow>>,
  languageCodes: Record<Platform, Set<string>>,
) {
  let changed = false;
  const next: Record<Platform, Record<string, string>> = { android: {}, ios: {} };
  for (const entry of ["android", "ios"] as const) {
    for (const [id, value] of Object.entries(drafts[entry])) {
      if (storedCellValue(id, rowMaps[entry], languageCodes[entry]) === null) {
        changed = true;
        continue;
      }
      next[entry][id] = value;
    }
  }
  return changed ? next : drafts;
}

function storedCellValue(
  id: string,
  rows: Map<string, EditorRow>,
  codes: Set<string>,
) {
  const cell = readEditorCellId(id);
  if (!cell || !codes.has(cell.code) || !rows.has(cell.key)) return null;
  return rows.get(cell.key)?.values[cell.code] ?? "";
}

function ToolbarSelect({ label, value, onChange, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 appearance-none rounded-md border border-[#e5e5e5] bg-canvas py-1 pr-8 pl-3 text-sm text-primary"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

function AddKeyDialog({ open, onOpenChange, action, platform, languages, onAdded }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  platform: Platform;
  languages: EditorLanguage[];
  onAdded: (message: string) => void;
}) {
  const platformName = platform === "android" ? "Android" : "iOS";
  const otherName = platform === "android" ? "iOS" : "Android";
  const hasEnglish = languages.some((language) => language.code.toLowerCase() === "en");
  const hasOtherLanguages = languages.some((language) => language.code.toLowerCase() !== "en");
  const canTranslate = hasEnglish && hasOtherLanguages;
  const [translate, setTranslate] = useState(true);
  const [state, formAction, pending] = useActionState(async (previous: ActionResult | null, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.ok) {
      onAdded(result.message ?? `Added to ${platformName}.`);
      onOpenChange(false);
    }
    return result;
  }, null);
  const detail = languages.length === 0
    ? "This platform has no languages yet, so only the key is stored."
    : hasEnglish
      ? "The value is saved as English. AI translation fills the other languages. Turn it off to leave those empty."
      : "English is not on this platform, so this value is saved for every language here.";
  return (
    <Dialog open={open} onOpenChange={blockDismiss(pending, onOpenChange)}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Add key</DialogTitle>
          <DialogDescription>
            {`Add this key on ${platformName} only. ${detail} ${otherName} is unchanged, and existing releases stay as they are.`}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <fieldset disabled={pending} className="m-0 grid min-w-0 gap-3 border-0 p-0">
            <input type="hidden" name="platform" value={platform} />
            <label className="grid gap-2 text-sm" htmlFor="new-key">
              Key
              <Input id="new-key" name="key" required autoFocus placeholder="welcome_title" className="border-secondary bg-canvas text-primary" />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="new-key-value">
              Value
              <Input id="new-key-value" name="value" placeholder="Hello" className="border-secondary bg-canvas text-primary" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="translate"
                value="on"
                className="size-4 accent-ink"
                checked={canTranslate && translate}
                disabled={!canTranslate}
                onChange={(event) => setTranslate(event.target.checked)}
              />
              AI translation
            </label>
            <FormMessage state={state} />
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <PendingButton pending={pending} pendingLabel={canTranslate && translate ? "Translating…" : "Adding…"} className="bg-ink text-onPrimary hover:bg-ink-hover">Add</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SupportedDialog({ open, onOpenChange, action, languages, needsEnglish }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  languages: typeof CATALOG_LANGUAGES;
  needsEnglish: boolean;
}) {
  const [mode, setMode] = useState<"translate" | "import">("translate");
  const [state, formAction, pending] = useActionState(async (previous: ActionResult | null, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.ok) {
      setMode("translate");
      onOpenChange(false);
    }
    return result;
  }, null);
  return (
    <Dialog open={open} onOpenChange={blockDismiss(pending, onOpenChange)}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Supported language</DialogTitle>
          <DialogDescription>
            The language is added on each platform that already has English. Its keys start as that platform’s English text.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <fieldset disabled={pending} className="m-0 grid min-w-0 gap-3 border-0 p-0">
            <LanguageSelect key={open ? "open" : "closed"} languages={languages} />
            <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0 text-sm">
              <legend>Source</legend>
              <label className="flex items-center gap-2">
                <input className="m-0" type="radio" name="mode" value="translate" checked={mode === "translate"} onChange={() => setMode("translate")} />
                AI translated
              </label>
              <label className="flex items-center gap-2">
                <input className="m-0" type="radio" name="mode" value="import" checked={mode === "import"} onChange={() => setMode("import")} />
                Import
              </label>
            </fieldset>
            {mode === "import" ? (
              <label className="grid gap-2 text-sm">
                Language file
                <Input name="file" type="file" required accept=".csv,.xml,.json,text/csv,application/json,text/xml,application/xml" className="border-secondary bg-canvas text-primary" />
              </label>
            ) : null}
            {needsEnglish ? <p className="text-sm text-secondary">Add English before adding another language.</p> : null}
            {!needsEnglish && languages.length === 0 ? <p className="text-sm text-secondary">Every catalog language is already stored.</p> : null}
            <FormMessage state={state} />
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <PendingButton pending={pending} pendingLabel={mode === "translate" ? "Translating…" : "Adding…"} className="bg-ink text-onPrimary hover:bg-ink-hover" disabled={needsEnglish || languages.length === 0}>Add</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ open, onOpenChange, action, targets, onDeleted }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  targets: { platform: Platform; key: string }[];
  onDeleted: () => void;
}) {
  const groups = (["android", "ios"] as const).map((entry) => ({
    platform: entry,
    keys: targets.filter((target) => target.platform === entry).map((target) => target.key),
  })).filter((group) => group.keys.length > 0);
  const summary = groups.map((group) => `${group.keys.length} ${group.keys.length === 1 ? "key" : "keys"} from ${group.platform === "android" ? "Android" : "iOS"}`).join(" and ");
  const [state, formAction, pending] = useActionState(async (_previous: ActionResult | null, formData: FormData) => {
    let result: ActionResult = { ok: true, message: "Deleted." };
    for (const entry of ["android", "ios"] as const) {
      const keys = formData.getAll(entry).map(String);
      if (keys.length === 0) continue;
      const payload = new FormData();
      payload.set("platform", entry);
      for (const key of keys) payload.append("key", key);
      result = await action(null, payload);
      if (!result.ok) return result;
    }
    onDeleted();
    return result;
  }, null);
  return (
    <Dialog open={open} onOpenChange={blockDismiss(pending, onOpenChange)}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Delete keys</DialogTitle>
          <DialogDescription>
            {`Delete ${summary}? This removes them from the working set. A language with no strings left is removed, so you can add it again. Existing releases stay as they are.`}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          {groups.flatMap((group) => group.keys.map((key) => (
            <input key={`${group.platform}:${key}`} type="hidden" name={group.platform} value={key} />
          )))}
          <FormMessage state={state} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <PendingButton pending={pending} pendingLabel="Deleting…" className="bg-critical text-onPrimary hover:bg-critical/90">Delete</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
