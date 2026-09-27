"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/src/lib/auth";
import { isAuthConfigured } from "@/src/lib/auth/environment";

export async function signInWithGoogle() {
  if (!isAuthConfigured()) redirect("/sign-in?error=Configuration");
  try {
    await signIn("google", { redirectTo: "/editor" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/sign-in?error=OAuthCallbackError");
    throw error; // Preserve Next.js redirects.
  }
}

export async function signOutOfApp() {
  await signOut({ redirectTo: "/sign-in" });
}
