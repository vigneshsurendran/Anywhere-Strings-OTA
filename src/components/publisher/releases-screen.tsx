"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { blockDismiss, PendingButton } from "@/src/components/common/pending-button";
import { FormMessage } from "@/src/components/publisher/import-form";
import { PlatformIcon } from "@/src/components/publisher/platform-icon";
import type { ActionResult } from "@/src/features/catalog/types";
import type { Platform } from "@/src/features/catalog/validation";
import type { ReleaseRecord } from "@/src/features/releases/types";
import { Badge } from "@/src/components/ui/badge";
import { Button, buttonVariants } from "@/src/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ReleasesScreen({
  releases,
  unsavedCount,
  preferredPlatform,
  createAction,
  renameAction,
  productionAction,
}: {
  releases: ReleaseRecord[];
  unsavedCount: number;
  preferredPlatform: Platform;
  createAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  renameAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  productionAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}) {
  const [filter, setFilter] = useState<"all" | Platform>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createSession, setCreateSession] = useState(0);
  const [pending, setPending] = useState<ReleaseRecord | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const shown = releases.filter((item) => filter === "all" || item.platform === filter);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-primary">Releases</h1>
        <span className="flex-1" />
        <Button
          type="button"
          className="bg-ink text-onPrimary hover:bg-ink-hover"
          disabled={unsavedCount > 0}
          onClick={() => {
            setCreateSession((current) => current + 1);
            setCreateOpen(true);
          }}
        >
          Create release
        </Button>
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
          {shown.map((item) => (
            <TableRow key={item.id} data-state={item.isProduction ? "selected" : undefined}>
              <TableCell className="w-10">
                <button
                  type="button"
                  role="radio"
                  aria-checked={item.isProduction}
                  aria-label={`Set ${item.platform} version ${item.version} as production`}
                  onClick={() => { if (!item.isProduction) setPending(item); }}
                  className="flex size-4 items-center justify-center rounded-full border border-ink bg-canvas"
                >
                  <span className={`size-2 rounded-full bg-ink ${item.isProduction ? "opacity-100" : "opacity-0"}`} />
                </button>
              </TableCell>
              <TableCell>
                {editingId === item.id ? (
                  <RenameField
                    release={item}
                    action={renameAction}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <button type="button" className="text-left text-sm hover:underline" onClick={() => setEditingId(item.id)}>
                    {item.name || "Untitled"}
                  </button>
                )}
              </TableCell>
              <TableCell>
                <Badge className={item.platform === "android" ? "bg-positive-secondary text-positive-secondary" : "bg-neutral-secondary text-primary"}>
                  {item.platform === "android" ? "Android" : "iOS"}
                </Badge>
                {item.isProduction ? <Badge className="ml-2 bg-positive text-onPrimary">Production</Badge> : null}
              </TableCell>
              <TableCell className="text-right">{item.version}</TableCell>
              <TableCell className="text-muted-foreground" suppressHydrationWarning>{formatCreatedDate(item.createdAt)}</TableCell>
              <TableCell>
                <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/releases/${item.id}/download`}>
                  Download
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CreateDialog key={createSession} open={createOpen} onOpenChange={setCreateOpen} action={createAction} preferredPlatform={preferredPlatform} />
      <ProductionDialog release={pending} onOpenChange={(open) => { if (!open) setPending(null); }} action={productionAction} />
    </main>
  );
}

function Capsule({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      className={active ? "rounded-full bg-ink text-onPrimary hover:bg-ink-hover" : "rounded-full border-secondary bg-canvas text-primary"}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function RenameField({ release, action, onDone }: {
  release: ReleaseRecord;
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  onDone: () => void;
}) {
  const [name, setName] = useState(release.name);
  const [state, formAction, pending] = useActionState(async (_previous: ActionResult | null, formData: FormData) => {
    const result = await action(null, formData);
    if (result.ok) onDone();
    return result;
  }, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={release.id} />
      <Input
        name="name"
        value={name}
        disabled={pending}
        aria-label={`Name for ${release.platform} version ${release.version}`}
        onChange={(event) => setName(event.target.value)}
        onBlur={(event) => { if (!pending) event.currentTarget.form?.requestSubmit(); }}
        autoFocus
      />
      {pending ? (
        <p role="status" className="mt-1 inline-flex items-center gap-1 text-xs text-secondary">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Saving…
        </p>
      ) : null}
      {state && !state.ok ? <p role="alert" className="mt-1 text-sm text-critical">{state.error ?? "The name was not saved."}</p> : null}
    </form>
  );
}

function CreateDialog({ open, onOpenChange, action, preferredPlatform }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  preferredPlatform: Platform;
}) {
  const [platform, setPlatform] = useState<Platform>(preferredPlatform);
  const [name, setName] = useState("");
  const [state, formAction, pending] = useActionState(async (previous: ActionResult | null, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.ok) {
      setName("");
      onOpenChange(false);
    }
    return result;
  }, null);
  return (
    <Dialog open={open} onOpenChange={blockDismiss(pending, onOpenChange)}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Create release</DialogTitle>
          <DialogDescription>Choose the platform. This freezes that platform’s saved strings and does not change production.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <fieldset disabled={pending} className="m-0 grid min-w-0 gap-3 border-0 p-0">
            <div className="flex flex-col gap-2">
              <Label>Platform</Label>
              <div className="flex gap-2">
                <Capsule active={platform === "android"} onClick={() => setPlatform("android")}><PlatformIcon platform="android" />Android</Capsule>
                <Capsule active={platform === "ios"} onClick={() => setPlatform("ios")}><PlatformIcon platform="ios" />iOS</Capsule>
              </div>
              <input type="hidden" name="platform" value={platform} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="release-name">Name</Label>
              <Input id="release-name" name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Papercut 29 Sep" />
            </div>
            <FormMessage state={state} />
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <PendingButton pending={pending} pendingLabel="Creating…" className="bg-ink text-onPrimary hover:bg-ink-hover">Create release</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductionDialog({ release, onOpenChange, action }: {
  release: ReleaseRecord | null;
  onOpenChange: (open: boolean) => void;
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(async (previous: ActionResult | null, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.ok) onOpenChange(false);
    return result;
  }, null);
  return (
    <Dialog open={release != null} onOpenChange={blockDismiss(pending, onOpenChange)}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Change production</DialogTitle>
          <DialogDescription>
            {release ? `Set “${release.name || "Untitled"}” as the ${release.platform === "android" ? "Android" : "iOS"} production release? Apps that read ${release.platform}/manifest.json will receive version ${release.version}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="id" value={release?.id ?? ""} />
          <FormMessage state={state} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <PendingButton pending={pending} pendingLabel="Updating…" className="bg-positive text-onPrimary hover:bg-positive/90">Set production</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatCreatedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
