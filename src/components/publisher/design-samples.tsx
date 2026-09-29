"use client";

import { useState } from "react";
import { PlatformIcon } from "@/src/components/publisher/platform-icon";
import { Badge } from "@/src/components/ui/badge";
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
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

type PageId = "editor" | "releases";
type Platform = "android" | "ios";
type ReleaseFilter = "all" | Platform;
type Language = { code: string; label: string };
type Cells = Record<string, Record<string, string>>;
type Release = { platform: Platform; version: number; name: string; createdAt: string };
type Catalog = { saved: Cells; drafts: Cells };

const LANGUAGES: Language[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "pt", label: "Portuguese" },
  { code: "pt-PT", label: "Portuguese (Portugal)" },
  { code: "es", label: "Spanish" },
];

const LANGUAGE_CATALOG: Language[] = [
  ...LANGUAGES,
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
];

const STRINGS: Cells = {
  yes_change: { en: "YES, CHANGE", fr: "", pt: "SIM, ALTERAR", "pt-PT": "SIM, ALTERAR", es: "Sí, cambiar" },
  working_hours_working_hours: { en: "Working hours", fr: "", pt: "Horário de expediente", "pt-PT": "Horário de expediente", es: "Horario laboral" },
  activity_added_title: { en: "Added", fr: "Ajouté", pt: "Adicionado", "pt-PT": "Adicionado", es: "Añadido" },
  more_listing_your_brand_item: { en: "Your brand", fr: "Votre marque", pt: "A sua marca", "pt-PT": "A sua marca", es: "Tu marca" },
  calendar_common_today: { en: "Today", fr: "Aujourd'hui", pt: "Hoje", "pt-PT": "Hoje", es: "Hoy" },
  more_listing_payments_item: { en: "Payments", fr: "Paiements", pt: "Pagamentos", "pt-PT": "Pagamentos", es: "Pagos" },
  container_login_screen_login_btn_text: { en: "Log in", fr: "Connexion", pt: "Iniciar sessão", "pt-PT": "Iniciar sessão", es: "Iniciar sesión" },
  booking_page_confirmation_title: { en: "You're booked", fr: "Réservé", pt: "Reserva confirmada", "pt-PT": "Reserva confirmada", es: "Reserva confirmada" },
};

const KEYS = Object.keys(STRINGS);

const START_RELEASES: Release[] = [
  { platform: "android", version: 3, name: "Papercut 29 Sep", createdAt: "29 Sep 2026" },
  { platform: "ios", version: 2, name: "Papercut 29 Sep", createdAt: "29 Sep 2026" },
  { platform: "android", version: 2, name: "Papercut 26 Aug", createdAt: "26 Aug 2026" },
  { platform: "android", version: 1, name: "Initial import", createdAt: "17 Jun 2026" },
  { platform: "ios", version: 1, name: "Initial import", createdAt: "17 Jun 2026" },
];

function copyCells(source: Cells): Cells {
  const next: Cells = {};
  for (const key of KEYS) next[key] = { ...source[key] };
  return next;
}

function catalog(): Catalog {
  return { saved: copyCells(STRINGS), drafts: copyCells(STRINGS) };
}

function languageFile(code: string): string {
  const strings: Record<string, string> = {};
  for (const key of [...KEYS].sort()) strings[key] = STRINGS[key]?.[code] ?? "";
  return `${JSON.stringify({ strings }, null, 2)}\n`;
}

function downloadRelease(item: Release) {
  const files = LANGUAGES.map((language) => ({ name: `${language.code}.json`, body: languageFile(language.code) }));
  const blob = files.length === 1 ? new Blob([files[0].body], { type: "application/json" }) : zipBlob(files);
  const filename = files.length === 1 ? `${item.platform}-v${item.version}-${files[0].name}` : `${item.platform}-v${item.version}.zip`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipBlob(files: { name: string; body: string }[]): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.body);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    parts.push(local);
    const entry = new Uint8Array(46 + name.length);
    const entryView = new DataView(entry.buffer);
    entryView.setUint32(0, 0x02014b50, true);
    entryView.setUint16(4, 20, true);
    entryView.setUint16(6, 20, true);
    entryView.setUint32(16, checksum, true);
    entryView.setUint32(20, data.length, true);
    entryView.setUint32(24, data.length, true);
    entryView.setUint16(28, name.length, true);
    entryView.setUint32(42, offset, true);
    entry.set(name, 46);
    central.push(entry);
    offset += local.length;
  }
  const directory = new Uint8Array(central.reduce((total, entry) => total + entry.length, 0));
  let cursor = 0;
  for (const entry of central) {
    directory.set(entry, cursor);
    cursor += entry.length;
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, directory.length, true);
  endView.setUint32(16, offset, true);
  const chunks = [...parts, directory, end];
  const archive = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let written = 0;
  for (const chunk of chunks) {
    archive.set(chunk, written);
    written += chunk.length;
  }
  return new Blob([archive.buffer], { type: "application/zip" });
}

export function DesignSamples() {
  const [page, setPage] = useState<PageId>("editor");
  const [editorPlatform, setEditorPlatform] = useState<Platform>("android");
  const [catalogs, setCatalogs] = useState<Record<Platform, Catalog>>(() => ({
    android: {
      saved: copyCells(STRINGS),
      drafts: {
        ...copyCells(STRINGS),
        more_listing_your_brand_item: { ...STRINGS.more_listing_your_brand_item, en: "Your branding" },
      },
    },
    ios: catalog(),
  }));
  const [query, setQuery] = useState("");
  const [keysByPlatform, setKeysByPlatform] = useState<Record<Platform, string[]>>({ android: KEYS, ios: [...KEYS] });
  const [languagesByPlatform, setLanguagesByPlatform] = useState<Record<Platform, Language[]>>({ android: LANGUAGES, ios: [...LANGUAGES] });
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [releasePlatform, setReleasePlatform] = useState<Platform>("android");
  const [releaseName, setReleaseName] = useState("");
  const [releases, setReleases] = useState(START_RELEASES);
  const [filter, setFilter] = useState<ReleaseFilter>("all");
  const [production, setProduction] = useState<Record<Platform, number>>({ android: 3, ios: 2 });
  const [pending, setPending] = useState<Release | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);

  const current = catalogs[editorPlatform];
  const languages = languagesByPlatform[editorPlatform];
  const platformKeys = keysByPlatform[editorPlatform];
  const visibleKeys = platformKeys.filter((key) => {
    if (query === "") return true;
    const needle = query.toLowerCase();
    if (key.toLowerCase().includes(needle)) return true;
    return languages.some((language) => (current.drafts[key]?.[language.code] ?? "").toLowerCase().includes(needle));
  });
  const shownReleases = releases.filter((item) => filter === "all" || item.platform === filter);
  const unsavedCount = platformKeys.reduce((total, key) => (
    total + languages.filter((language) => (current.drafts[key]?.[language.code] ?? "") !== (current.saved[key]?.[language.code] ?? "")).length
  ), 0);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selected.includes(key));
  const someVisibleSelected = visibleKeys.some((key) => selected.includes(key));

  function edit(key: string, code: string, value: string) {
    setCatalogs((currentCatalogs) => {
      const platformCatalog = currentCatalogs[editorPlatform];
      return {
        ...currentCatalogs,
        [editorPlatform]: {
          ...platformCatalog,
          drafts: {
            ...platformCatalog.drafts,
            [key]: { ...platformCatalog.drafts[key], [code]: value },
          },
        },
      };
    });
  }

  function save(key: string, code: string) {
    setCatalogs((currentCatalogs) => {
      const platformCatalog = currentCatalogs[editorPlatform];
      return {
        ...currentCatalogs,
        [editorPlatform]: {
          ...platformCatalog,
          saved: {
            ...platformCatalog.saved,
            [key]: {
              ...platformCatalog.saved[key],
              [code]: platformCatalog.drafts[key]?.[code] ?? "",
            },
          },
        },
      };
    });
  }

  function switchPlatform(platform: Platform) {
    setEditorPlatform(platform);
    setSelected([]);
  }

  function toggleKey(key: string) {
    setSelected((currentKeys) => currentKeys.includes(key) ? currentKeys.filter((item) => item !== key) : [...currentKeys, key]);
  }

  function toggleVisible() {
    setSelected((currentKeys) => {
      if (allVisibleSelected) return currentKeys.filter((key) => !visibleKeys.includes(key));
      return [...new Set([...currentKeys, ...visibleKeys])];
    });
  }

  function deleteSelected() {
    const removing = new Set(selected);
    setKeysByPlatform((currentKeys) => ({
      ...currentKeys,
      [editorPlatform]: currentKeys[editorPlatform].filter((key) => !removing.has(key)),
    }));
    setCatalogs((currentCatalogs) => {
      const platformCatalog = currentCatalogs[editorPlatform];
      const strip = (cells: Cells): Cells => {
        const next: Cells = {};
        for (const key of Object.keys(cells)) if (!removing.has(key)) next[key] = cells[key];
        return next;
      };
      return {
        ...currentCatalogs,
        [editorPlatform]: { saved: strip(platformCatalog.saved), drafts: strip(platformCatalog.drafts) },
      };
    });
    setSelected([]);
    setDeleteOpen(false);
  }

  function importLanguage(platform: Platform, code: string) {
    const language = LANGUAGE_CATALOG.find((item) => item.code === code);
    if (!language) return;
    setLanguagesByPlatform((currentLanguages) => {
      if (currentLanguages[platform].some((item) => item.code === code)) return currentLanguages;
      return { ...currentLanguages, [platform]: [...currentLanguages[platform], language] };
    });
    setCatalogs((currentCatalogs) => {
      const platformCatalog = currentCatalogs[platform];
      const fill = (cells: Cells): Cells => {
        const next: Cells = {};
        for (const key of Object.keys(cells)) next[key] = { ...cells[key], [code]: cells[key][code] ?? "" };
        return next;
      };
      return { ...currentCatalogs, [platform]: { saved: fill(platformCatalog.saved), drafts: fill(platformCatalog.drafts) } };
    });
    setEditorPlatform(platform);
    setSelected([]);
    setImportOpen(false);
    setPage("editor");
  }

  function createRelease() {
    const version = releases.filter((item) => item.platform === releasePlatform).reduce((max, item) => Math.max(max, item.version), 0) + 1;
    setReleases((currentReleases) => [
      { platform: releasePlatform, version, name: releaseName.trim() || "Untitled", createdAt: "Just now" },
      ...currentReleases,
    ]);
    setReleaseName("");
    setCreateOpen(false);
    setFilter(releasePlatform);
    setPage("releases");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas text-primary">
      <header className="border-b border-secondary bg-canvas-secondary">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-6">
          <p className="mr-4 text-sm font-semibold text-primary">Language publisher</p>
          <Button variant={page === "editor" ? "default" : "ghost"} size="sm" className={page === "editor" ? "bg-ink text-onPrimary hover:bg-ink-hover" : "text-secondary"} onClick={() => setPage("editor")}>Editor</Button>
          <Button variant={page === "releases" ? "default" : "ghost"} size="sm" className={page === "releases" ? "bg-ink text-onPrimary hover:bg-ink-hover" : "text-secondary"} onClick={() => setPage("releases")}>Releases</Button>
        </div>
      </header>

      {page === "editor" ? (
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Editor</h1>
            <span className="flex-1" />
            <Capsule active={editorPlatform === "android"} onClick={() => switchPlatform("android")}><PlatformIcon platform="android" />Android</Capsule>
            <Capsule active={editorPlatform === "ios"} onClick={() => switchPlatform("ios")}><PlatformIcon platform="ios" />iOS</Capsule>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>Import</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search keys or values" aria-label="Search" className="max-w-xs" />
            <p className="text-xs text-muted-foreground">{`${visibleKeys.length} keys`}</p>
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
            {selected.length > 0 ? <Button size="sm" className="bg-critical text-onPrimary hover:bg-critical/90" onClick={() => setDeleteOpen(true)}>{`Delete ${selected.length}`}</Button> : null}
          </div>
          <div className="flex flex-col gap-3">
            {visibleKeys.map((key) => (
              <div key={key} className="grid grid-cols-1 overflow-hidden rounded-lg border border-secondary bg-canvas sm:grid-cols-[220px_minmax(0,1fr)]">
                <div className="flex items-start gap-2 border-l-4 border-ink bg-canvas-secondary px-3 py-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-ink"
                    checked={selected.includes(key)}
                    onChange={() => toggleKey(key)}
                    aria-label={`Select ${key}`}
                  />
                  <span className="font-mono text-xs break-all text-primary">{key}</span>
                </div>
                <div>
                  {languages.map((language, index) => {
                    const value = current.drafts[key]?.[language.code] ?? "";
                    const stored = current.saved[key]?.[language.code] ?? "";
                    const changed = value !== stored;
                    return (
                      <div key={language.code} className={`flex items-center gap-3 px-3 py-2 ${index % 2 === 0 ? "bg-neutral-secondary" : "bg-canvas"}`}>
                        <div className="w-44 shrink-0 text-sm font-medium text-secondary">{language.label}</div>
                        <div className="min-w-0 flex-1">
                          <Input
                            value={value}
                            aria-label={`${language.label} value for ${key}`}
                            placeholder="Empty"
                            onChange={(event) => edit(key, language.code, event.target.value)}
                            className="border-secondary bg-canvas text-primary placeholder:text-critical"
                          />
                        </div>
                        {changed ? <Button size="sm" className="bg-ink text-onPrimary hover:bg-ink-hover" onClick={() => save(key, language.code)}>Save</Button> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {visibleKeys.length === 0 ? <p className="text-sm text-muted-foreground">No keys match that search.</p> : null}
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">Releases</h1>
            <span className="flex-1" />
            <Button className="bg-ink text-onPrimary hover:bg-ink-hover" onClick={() => setCreateOpen(true)} disabled={unsavedCount > 0}>Create release</Button>
          </div>
          {unsavedCount > 0 ? (
            <p className="text-sm text-muted-foreground">Save the open edits in Editor before creating a release.</p>
          ) : null}
          <div className="flex gap-2">
            <Capsule active={filter === "all"} onClick={() => setFilter("all")}>All</Capsule>
            <Capsule active={filter === "android"} onClick={() => setFilter("android")}><PlatformIcon platform="android" />Android</Capsule>
            <Capsule active={filter === "ios"} onClick={() => setFilter("ios")}><PlatformIcon platform="ios" />iOS</Capsule>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Served</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Platform</TableHead>
                <TableHead className="w-24 text-right">Version</TableHead>
                <TableHead className="w-36">Created</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shownReleases.map((item) => {
                const id = `${item.platform}-${item.version}`;
                const live = production[item.platform] === item.version;
                return (
                  <TableRow key={id} data-state={live ? "selected" : undefined}>
                    <TableCell className="w-10">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={live}
                        aria-label={`Set ${item.platform} version ${item.version} as production`}
                        onClick={() => { if (!live) setPending(item); }}
                        className="flex size-4 items-center justify-center rounded-full border border-ink bg-canvas"
                      >
                        <span className={`size-2 rounded-full bg-ink ${live ? "opacity-100" : "opacity-0"}`} />
                      </button>
                    </TableCell>
                    <TableCell>
                      {editingName === id ? (
                        <Input
                          value={item.name}
                          aria-label={`Name for ${item.platform} version ${item.version}`}
                          onChange={(event) => setReleases((currentReleases) => currentReleases.map((release) => (
                            release.platform === item.platform && release.version === item.version
                              ? { ...release, name: event.target.value }
                              : release
                          )))}
                          onBlur={() => setEditingName(null)}
                          autoFocus
                        />
                      ) : (
                        <button type="button" className="text-left text-sm hover:underline" onClick={() => setEditingName(id)}>
                          {item.name || "Untitled"}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={item.platform === "android" ? "bg-positive-secondary text-positive-secondary" : "bg-neutral-secondary text-primary"}>{item.platform === "android" ? "Android" : "iOS"}</Badge>
                      {live ? <Badge className="ml-2 bg-positive text-onPrimary">Production</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right">{item.version}</TableCell>
                    <TableCell className="text-muted-foreground">{item.createdAt}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => downloadRelease(item)}>Download</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </main>
      )}

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        platform={editorPlatform}
        present={languagesByPlatform}
        onImport={importLanguage}
      />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete keys</DialogTitle>
            <DialogDescription>
              {`Delete ${selected.length} ${selected.length === 1 ? "key" : "keys"} from ${editorPlatform === "android" ? "Android" : "iOS"}? This removes them from the working set. Existing releases stay as they are.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button className="bg-critical text-onPrimary hover:bg-critical/90" onClick={deleteSelected}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create release</DialogTitle>
            <DialogDescription>Choose the platform. This freezes that platform’s saved strings and does not change production.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>Platform</Label>
              <div className="flex gap-2">
                <Capsule active={releasePlatform === "android"} onClick={() => setReleasePlatform("android")}><PlatformIcon platform="android" />Android</Capsule>
                <Capsule active={releasePlatform === "ios"} onClick={() => setReleasePlatform("ios")}><PlatformIcon platform="ios" />iOS</Capsule>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="release-name">Name</Label>
              <Input id="release-name" value={releaseName} onChange={(event) => setReleaseName(event.target.value)} placeholder="Papercut 29 Sep" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="bg-ink text-onPrimary hover:bg-ink-hover" onClick={createRelease}>Create release</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={pending != null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change production</DialogTitle>
            <DialogDescription>
              {pending ? `Set “${pending.name}” as the ${pending.platform === "android" ? "Android" : "iOS"} production release? Apps that read ${pending.platform}/manifest.json will receive version ${pending.version}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button className="bg-positive text-onPrimary hover:bg-positive/90" onClick={() => {
              if (pending) setProduction((currentProduction) => ({ ...currentProduction, [pending.platform]: pending.version }));
              setPending(null);
            }}>
              Set production
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlatformChoice({ platform }: { platform: Platform }) {
  return (
    <span className="flex items-center gap-2">
      <PlatformIcon platform={platform} />
      {platform === "android" ? "Android" : "iOS"}
    </span>
  );
}

function Capsule({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} className={active ? "rounded-full bg-ink text-onPrimary hover:bg-ink-hover" : "rounded-full border-secondary bg-canvas text-primary"} onClick={onClick}>
      {children}
    </Button>
  );
}

function ImportDialog({ open, onOpenChange, platform, present, onImport }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: Platform;
  present: Record<Platform, Language[]>;
  onImport: (platform: Platform, code: string) => void;
}) {
  const [locale, setLocale] = useState("en");
  const [importPlatform, setImportPlatform] = useState(platform);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setImportPlatform(platform);
  }
  const items = Object.fromEntries(LANGUAGE_CATALOG.map((language) => [language.code, `${language.label} — ${language.code}`]));
  const adding = !present[importPlatform].some((language) => language.code === locale);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import</DialogTitle>
          <DialogDescription>CSV, Android strings.xml, or a JSON language file. Choosing a language that is not on this platform yet adds it.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-platform">Platform</Label>
            <Select
              value={importPlatform}
              onValueChange={(value) => setImportPlatform((value ?? "android") as Platform)}
            >
              <SelectTrigger id="import-platform" className="w-full">
                <SelectValue>
                  {(value: string | null) => <PlatformChoice platform={value === "ios" ? "ios" : "android"} />}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="android"><PlatformChoice platform="android" /></SelectItem>
                <SelectItem value="ios"><PlatformChoice platform="ios" /></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-locale">Language</Label>
            <Select value={locale} onValueChange={(value) => setLocale(value ?? "en")} items={items}>
              <SelectTrigger id="import-locale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_CATALOG.map((language) => (
                  <SelectItem key={language.code} value={language.code}>{`${language.label} — ${language.code}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {adding ? <p className="text-sm text-secondary">This language will be added to the platform.</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-file">Language file</Label>
            <Input id="import-file" type="file" />
          </div>
        </div>
        <DialogFooter>
          <Button className="bg-ink text-onPrimary hover:bg-ink-hover" onClick={() => onImport(importPlatform, locale)}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
