import Link from "next/link";
import { signInWithGoogle } from "@/app/actions/auth";
import { AuthButton } from "@/src/components/common/auth-button";
import { isAuthConfigured } from "@/src/lib/auth/environment";
import { isEmailDomainRestrictionRelaxed } from "@/src/lib/auth/policy";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const configured = isAuthConfigured();
  const domainRelaxed = isEmailDomainRestrictionRelaxed();
  const denied = error === "AccessDenied";
  const unavailable = !configured || error === "Configuration";
  const accountHint = domainRelaxed
    ? "Local development currently allows any verified Google account. Add that account as a Google OAuth test user."
    : "Use your verified @anywhere.co Google account.";
  const message = unavailable
    ? "Google sign-in is not configured yet. Ask your administrator to complete the authentication setup."
    : denied
      ? domainRelaxed
        ? "Access denied. Use a verified Google account that an admin has added to Access, then try again."
        : "Access denied. Use a verified @anywhere.co account that an admin has added to Access, then try again."
      : error
        ? "Sign-in was canceled, expired, or could not be completed. Please try again."
        : null;

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-background p-8 shadow-sm dark:border-zinc-800">
        <p className="mb-3 text-sm font-medium text-zinc-500">Anywhere String OTA</p>
        <h1 className="text-3xl font-semibold tracking-tight">{denied ? "Access denied" : "Sign in to continue"}</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{accountHint}</p>
        {message && <p role="alert" className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{message}</p>}
        <form action={signInWithGoogle} className="mt-7">
          <AuthButton disabled={!configured} pendingLabel="Connecting to Google…">{denied ? "Choose another Google account" : "Sign in with Google"}</AuthButton>
        </form>
        <Link href="/editor" className="mt-6 inline-block text-sm underline underline-offset-4">Return to editor</Link>
      </section>
    </main>
  );
}
