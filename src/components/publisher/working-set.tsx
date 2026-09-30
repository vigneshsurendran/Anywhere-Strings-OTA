"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/src/components/common/submit-button";
import { FormMessage } from "@/src/components/publisher/import-form";
import { filterRows } from "@/src/features/catalog/filter";
import type { ActionResult } from "@/src/features/catalog/types";
import type { Platform } from "@/src/features/catalog/validation";

const fieldClass = "rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm dark:border-zinc-700";

export type VisibleRow = {
  key: string;
  value: string | null;
};

export function WorkingSet({
  platform,
  languages,
  locale,
  rows,
  saveAction,
  addLanguageAction,
  addKeyAction,
}: {
  platform: Platform;
  languages: string[];
  locale: string | null;
  rows: VisibleRow[];
  saveAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  addLanguageAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  addKeyAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}) {
  const [query, setQuery] = useState("");
  const visible = filterRows(rows, query);
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold">Working set</h2>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <PlatformLink platform="android" current={platform}>Android</PlatformLink>
        <PlatformLink platform="ios" current={platform}>iOS</PlatformLink>
      </div>
      {languages.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">This catalog is empty.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {languages.map((language) => (
              <Link
                key={language}
                href={`/editor?platform=${platform}&locale=${encodeURIComponent(language)}`}
                aria-current={language === locale ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-sm ${language === locale ? "border-foreground" : "border-zinc-300 dark:border-zinc-700"}`}
              >
                {language}
              </Link>
            ))}
          </div>
          <label className="mt-6 grid max-w-md gap-2 text-sm">
            Search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={fieldClass}
              placeholder="Filter by key or value"
            />
          </label>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-4 font-medium">Key</th>
                  <th className="py-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={`${platform}:${locale}:${row.key}`} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-3 pr-4 align-top font-mono">{row.key}</td>
                    <td className="py-3">
                      <ValueForm action={saveAction} platform={platform} locale={locale ?? ""} row={row} />
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-4 text-zinc-500">No keys match that search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <LanguageForm action={addLanguageAction} platform={platform} />
        <KeyForm action={addKeyAction} platform={platform} />
      </div>
    </section>
  );
}

function PlatformLink({ platform, current, children }: {
  platform: Platform;
  current: Platform;
  children: string;
}) {
  return (
    <Link
      href={`/editor?platform=${platform}`}
      aria-current={platform === current ? "page" : undefined}
      className={`rounded-lg border px-3 py-2 ${platform === current ? "border-foreground" : "border-zinc-300 dark:border-zinc-700"}`}
    >
      {children}
    </Link>
  );
}

function ValueForm({ action, platform, locale, row }: {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  platform: Platform;
  locale: string;
  row: VisibleRow;
}) {
  const [state, formAction] = useActionState(action, null);
  const [draft, setDraft] = useState(row.value ?? "");
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="platform" value={platform} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="key" value={row.key} />
      {row.value === null && <p className="text-xs text-zinc-500">No value</p>}
      <div className="flex flex-wrap items-start gap-2">
        <input
          name="value"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`Value for ${row.key}`}
          className={`${fieldClass} min-w-64 flex-1`}
        />
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

function LanguageForm({ action, platform }: {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  platform: Platform;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="grid gap-3">
      <h3 className="font-medium">Add a language</h3>
      <input type="hidden" name="platform" value={platform} />
      <label className="grid gap-2 text-sm">
        New locale
        <input name="locale" required placeholder="fr" className={fieldClass} />
      </label>
      <SubmitButton pendingLabel="Adding…">Add language</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

function KeyForm({ action, platform }: {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  platform: Platform;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="grid gap-3">
      <h3 className="font-medium">Add a key</h3>
      <input type="hidden" name="platform" value={platform} />
      <label className="grid gap-2 text-sm">
        New key
        <input name="key" required placeholder="welcome_title" className={fieldClass} />
      </label>
      <SubmitButton pendingLabel="Adding…">Add key</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
