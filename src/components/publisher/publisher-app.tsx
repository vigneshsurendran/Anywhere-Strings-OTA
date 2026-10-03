"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButton } from "@/src/components/common/auth-button";
import { AccessScreen } from "@/src/components/publisher/access-screen";
import { EditorScreen } from "@/src/components/publisher/editor-screen";
import { ReleasesScreen } from "@/src/components/publisher/releases-screen";
import type { ActionResult, EditorLanguage, EditorRow } from "@/src/features/catalog/types";
import type { ReleaseRecord } from "@/src/features/releases/types";
import type { AccessRole, AccessRow } from "@/src/server/access";
import type { Platform } from "@/src/features/catalog/validation";

type Catalog = { languages: EditorLanguage[]; rows: EditorRow[] };

export function PublisherApp({
  android,
  ios,
  releases,
  people,
  role,
  importAction,
  saveAction,
  deleteAction,
  addKeyAction,
  addSupportedAction,
  addAccessAction,
  roleAction,
  removeAccessAction,
  createReleaseAction,
  renameReleaseAction,
  setProductionAction,
  signOutAction,
}: {
  android: Catalog;
  ios: Catalog;
  releases: ReleaseRecord[];
  people: AccessRow[];
  role: AccessRole;
  importAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  saveAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  deleteAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  addKeyAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  addSupportedAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  addAccessAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  roleAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  removeAccessAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  createReleaseAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  renameReleaseAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  setProductionAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const view = pathname.startsWith("/access") ? "access" : pathname.startsWith("/releases") ? "releases" : "editor";
  const [platform, setPlatform] = useState<Platform>("android");
  const [unsavedCount, setUnsavedCount] = useState(0);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas text-primary">
      <header className="border-b border-secondary bg-canvas-secondary">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-6">
          <p className="mr-4 text-sm font-semibold text-primary">Anywhere String OTA</p>
          <Link
            href="/editor"
            aria-current={view === "editor" ? "page" : undefined}
            className={`inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-[0.8rem] font-medium ${view === "editor" ? "bg-ink text-onPrimary" : "text-secondary"}`}
          >
            Editor
          </Link>
          <Link
            href="/releases"
            aria-current={view === "releases" ? "page" : undefined}
            className={`inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-[0.8rem] font-medium ${view === "releases" ? "bg-ink text-onPrimary" : "text-secondary"}`}
          >
            Releases
          </Link>
          {role === "admin" ? (
            <Link
              href="/access"
              aria-current={view === "access" ? "page" : undefined}
              className={`inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-[0.8rem] font-medium ${view === "access" ? "bg-ink text-onPrimary" : "text-secondary"}`}
            >
              Access
            </Link>
          ) : null}
          <form action={signOutAction} className="ml-auto">
            <AuthButton
              pendingLabel="Signing out…"
              className="inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-[0.8rem] font-medium text-secondary hover:text-primary"
            >
              Sign out
            </AuthButton>
          </form>
        </div>
      </header>
      <div className={view === "editor" ? "flex flex-1 flex-col" : "hidden"}>
        <EditorScreen
          platform={platform}
          onPlatform={setPlatform}
          catalogs={{ android, ios }}
          importAction={importAction}
          saveAction={saveAction}
          deleteAction={deleteAction}
          addKeyAction={addKeyAction}
          addSupportedAction={addSupportedAction}
          onUnsavedCount={setUnsavedCount}
          active={view === "editor"}
        />
      </div>
      {view === "releases" ? (
        <ReleasesScreen
          releases={releases}
          unsavedCount={unsavedCount}
          preferredPlatform={platform}
          createAction={createReleaseAction}
          renameAction={renameReleaseAction}
          productionAction={setProductionAction}
        />
      ) : null}
      {view === "access" && role === "admin" ? (
        <AccessScreen people={people} addAction={addAccessAction} roleAction={roleAction} removeAction={removeAccessAction} />
      ) : null}
    </div>
  );
}
