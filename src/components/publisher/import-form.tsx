"use client";

import { useActionState, useEffect } from "react";
import { PendingButton } from "@/src/components/common/pending-button";
import { PlatformIcon } from "@/src/components/publisher/platform-icon";
import type { ActionResult } from "@/src/features/catalog/types";
import { CATALOG_LANGUAGES } from "@/src/features/catalog/languages";
import { isPlatform, type Platform } from "@/src/features/catalog/validation";
import { LanguageSelect } from "@/src/components/publisher/language-select";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";

export function ImportForm({ action, platform, embedded = false, onBusy }: {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  platform: Platform;
  embedded?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  useEffect(() => {
    onBusy?.(pending);
  }, [onBusy, pending]);
  return (
    <section className={embedded ? undefined : "mt-8"}>
      {embedded ? null : (
        <>
          <h2 className="text-lg font-semibold">Import</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Import a CSV, Android strings file, or JSON language file into the platform and locale you choose.
          </p>
        </>
      )}
      <form action={formAction} className={embedded ? "grid gap-3" : "mt-4 grid gap-3"}>
        <fieldset disabled={pending} className="m-0 grid min-w-0 gap-3 border-0 p-0">
          <div className="grid gap-2 text-sm">
            <label htmlFor="import-platform">Platform</label>
            <Select key={platform} name="platform" defaultValue={platform}>
              <SelectTrigger id="import-platform" className="h-10 w-full border-zinc-300 bg-background px-3 text-sm data-[size=default]:h-10 dark:border-zinc-700">
                <SelectValue>
                  {(value: string | null) => <PlatformChoice platform={isPlatform(value) ? value : platform} />}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="android"><PlatformChoice platform="android" /></SelectItem>
                <SelectItem value="ios"><PlatformChoice platform="ios" /></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <LanguageSelect languages={CATALOG_LANGUAGES} />
          <label className="grid gap-2 text-sm">
            Language file
            <Input name="file" type="file" required accept=".csv,.xml,.json,text/csv,application/json,text/xml,application/xml" className="border-secondary bg-canvas text-primary" />
          </label>
          <FormMessage state={state} />
        </fieldset>
        <div>
          <PendingButton pending={pending} pendingLabel="Importing…" className="bg-ink text-onPrimary hover:bg-ink-hover">Import</PendingButton>
        </div>
      </form>
    </section>
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

export function FormMessage({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (state.ok) return <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300 sm:col-span-2">{state.message}</p>;
  return <p role="alert" className="text-sm text-red-700 dark:text-red-300 sm:col-span-2">{state.error}</p>;
}
