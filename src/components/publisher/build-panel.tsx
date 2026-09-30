"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/src/components/common/submit-button";
import { FormMessage } from "@/src/components/publisher/import-form";
import type { ActionResult } from "@/src/features/catalog/types";
import type { Platform } from "@/src/features/catalog/validation";

const fieldClass = "rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm dark:border-zinc-700";

export type BuildListItem = {
  id: number;
  createdAt: string;
  publishedAt: string | null;
};

export type SnapshotRow = {
  locale: string;
  key: string;
  value: string;
};

export function BuildPanel({
  platform,
  locale,
  builds,
  selected,
  createAction,
  saveAction,
  publishAction,
}: {
  platform: Platform;
  locale: string | null;
  builds: BuildListItem[];
  selected: (BuildListItem & { rows: SnapshotRow[] }) | null;
  createAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  saveAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  publishAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}) {
  const [createState, createFormAction] = useActionState(createAction, null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [publishState, publishFormAction] = useActionState(publishAction, null);
  const query = new URLSearchParams({ platform });
  if (locale) query.set("locale", locale);
  return (
    <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Builds</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        A build copies this platform’s working set. You can edit it until it is published.
      </p>
      <form action={createFormAction} className="mt-4">
        <input type="hidden" name="platform" value={platform} />
        <SubmitButton pendingLabel="Building…">Build snapshot</SubmitButton>
        <div className="mt-3"><FormMessage state={createState} /></div>
      </form>
      {builds.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No builds yet.</p>
      ) : (
        <ul className="mt-6 grid gap-2 text-sm">
          {builds.map((build) => {
            const href = `/editor?${query.toString()}&build=${build.id}`;
            const label = build.publishedAt ? `Published ${build.publishedAt}` : "Not published";
            return (
              <li key={build.id}>
                <Link href={href} className="underline underline-offset-4" aria-current={selected?.id === build.id ? "page" : undefined}>
                  Build {build.id}
                </Link>
                <span className="text-zinc-500"> · {build.createdAt} · {label}</span>
              </li>
            );
          })}
        </ul>
      )}
      {selected && (
        <div className="mt-8">
          <h3 className="font-medium">Build {selected.id}</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {selected.publishedAt ? `Published ${selected.publishedAt}` : "Not published"}
          </p>
          {selected.rows.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">This snapshot has no values.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="py-2 pr-4 font-medium">Locale</th>
                    <th className="py-2 pr-4 font-medium">Key</th>
                    <th className="py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.rows.map((row) => (
                    <tr key={`${row.locale}:${row.key}`} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="py-3 pr-4 align-top">{row.locale}</td>
                      <td className="py-3 pr-4 align-top font-mono">{row.key}</td>
                      <td className="py-3">
                        {selected.publishedAt ? (
                          <input readOnly value={row.value} aria-label={`Published value for ${row.locale} ${row.key}`} className={`${fieldClass} w-full`} />
                        ) : (
                          <SnapshotValueForm action={saveAction} buildId={selected.id} row={row} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            className="mt-6 rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            onClick={() => dialogRef.current?.showModal()}
          >
            Review publish
          </button>
          <dialog ref={dialogRef} className="publish-review rounded-2xl border border-zinc-200 bg-background p-6 text-foreground dark:border-zinc-800">
            <h3 className="text-lg font-semibold">Publish build {selected.id}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              This writes new {platform} language files and then updates {platform}/manifest.json. The other platform’s manifest is left unchanged.
            </p>
            <form action={publishFormAction} className="mt-6 flex flex-wrap gap-3">
              <input type="hidden" name="buildId" value={selected.id} />
              <SubmitButton pendingLabel="Publishing…">Publish</SubmitButton>
              <button type="button" className="rounded-lg px-4 py-2 text-sm" onClick={() => dialogRef.current?.close()}>Cancel</button>
            </form>
            <div className="mt-4"><FormMessage state={publishState} /></div>
          </dialog>
        </div>
      )}
    </section>
  );
}

function SnapshotValueForm({ action, buildId, row }: {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  buildId: number;
  row: SnapshotRow;
}) {
  const [state, formAction] = useActionState(action, null);
  const [draft, setDraft] = useState(row.value);
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="buildId" value={buildId} />
      <input type="hidden" name="locale" value={row.locale} />
      <input type="hidden" name="key" value={row.key} />
      <div className="flex flex-wrap items-start gap-2">
        <input
          name="value"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`Snapshot value for ${row.locale} ${row.key}`}
          className={`${fieldClass} min-w-64 flex-1`}
        />
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
