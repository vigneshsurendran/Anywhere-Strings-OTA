import { redirect } from "next/navigation";
import {
  addAccessAction,
  removeAccessAction,
  setAccessRoleAction,
} from "@/app/actions/access";
import {
  addSupportedLanguageAction,
  createKey,
  deleteSelectedKeys,
  importLanguageFile,
  saveTranslation,
} from "@/app/actions/catalog";
import { signOutOfApp } from "@/app/actions/auth";
import {
  createReleaseAction,
  renameReleaseAction,
  setProductionAction,
} from "@/app/actions/releases";
import { PublisherApp } from "@/src/components/publisher/publisher-app";
import { AuthorizationError, requireAuthorizedUser } from "@/src/lib/auth/session";
import { listAccess } from "@/src/server/access";
import { loadEditor } from "@/src/server/editor";
import { listReleases } from "@/src/server/releases";
import { withDatabase } from "@/src/server/database";

export const dynamic = "force-dynamic";

export default async function PublisherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuthorizedUser().catch((error: unknown) => {
    if (error instanceof AuthorizationError) {
      redirect(error.status === 403 ? "/sign-in?error=AccessDenied" : "/sign-in");
    }
    throw error;
  });
  const data = withDatabase((db) => ({
    android: loadEditor(db, "android"),
    ios: loadEditor(db, "ios"),
    releases: listReleases(db),
    people: user.role === "admin" ? listAccess(db) : [],
  }));

  return (
    <>
      <PublisherApp
        android={{ languages: data.android.languages, rows: data.android.rows }}
        ios={{ languages: data.ios.languages, rows: data.ios.rows }}
        releases={data.releases}
        people={data.people}
        role={user.role}
        importAction={importLanguageFile}
        saveAction={saveTranslation}
        deleteAction={deleteSelectedKeys}
        addKeyAction={createKey}
        addSupportedAction={addSupportedLanguageAction}
        addAccessAction={addAccessAction}
        roleAction={setAccessRoleAction}
        removeAccessAction={removeAccessAction}
        createReleaseAction={createReleaseAction}
        renameReleaseAction={renameReleaseAction}
        setProductionAction={setProductionAction}
        signOutAction={signOutOfApp}
      />
      {children}
    </>
  );
}
