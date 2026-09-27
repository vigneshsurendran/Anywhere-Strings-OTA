import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, configured, redirect, signIn, signOut } = vi.hoisted(() => ({
  auth: vi.fn(), configured: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));
vi.mock("@/src/lib/auth", () => ({ auth, signIn, signOut }));
vi.mock("@/src/lib/auth/environment", () => ({ isAuthConfigured: configured }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next-auth", () => import("@auth/core/errors"));

import { requireAuthorizedUser } from "@/src/lib/auth/session";
import PublisherLayout from "@/app/(publisher)/layout";
import { signInWithGoogle, signOutOfApp } from "@/app/actions/auth";
import { AuthError } from "next-auth";

const directories: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  configured.mockReturnValue(true);
  auth.mockResolvedValue(null);
  const directory = mkdtempSync(path.join(tmpdir(), "publisher-editor-"));
  directories.push(directory);
  vi.stubEnv("PUBLISHER_DATABASE_PATH", path.join(directory, "publisher.sqlite"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("protected server entry point", () => {
  it("requires authentication before rendering the editor", async () => {
    await expect(PublisherLayout({ children: null })).rejects.toThrow("REDIRECT:/sign-in");
  });
  it("requires authentication independently of UI routing", async () => {
    await expect(requireAuthorizedUser()).rejects.toMatchObject({ status: 401 });
  });
  it("fails closed without configuration", async () => {
    configured.mockReturnValue(false);
    await expect(requireAuthorizedUser()).rejects.toMatchObject({ status: 401 });
    expect(auth).not.toHaveBeenCalled();
  });
  it("rejects a wrong-domain session", async () => {
    auth.mockResolvedValue({ user: { email: "person@gmail.com", emailVerified: true }, expires: new Date(Date.now() + 10000).toISOString() });
    await expect(requireAuthorizedUser()).rejects.toMatchObject({ status: 403 });
    await expect(PublisherLayout({ children: null })).rejects.toThrow("REDIRECT:/sign-in?error=AccessDenied");
  });
  it("rejects an unverified or expired session", async () => {
    auth.mockResolvedValue({ user: { email: "person@anywhere.co" }, expires: new Date(Date.now() + 10000).toISOString() });
    await expect(requireAuthorizedUser()).rejects.toMatchObject({ status: 403 });
    auth.mockResolvedValue({ user: { email: "person@anywhere.co", emailVerified: true }, expires: "2000-01-01" });
    await expect(requireAuthorizedUser()).rejects.toMatchObject({ status: 401 });
  });
  it("rejects a verified Anywhere account that is not listed", async () => {
    auth.mockResolvedValue({ user: { email: "person@anywhere.co", emailVerified: true }, expires: new Date(Date.now() + 10000).toISOString() });
    await expect(requireAuthorizedUser()).rejects.toMatchObject({ status: 403 });
    await expect(PublisherLayout({ children: null })).rejects.toThrow("REDIRECT:/sign-in?error=AccessDenied");
  });
  it("returns the listed admin and permits the editor", async () => {
    vi.stubEnv("AUTH_ADMIN_EMAILS", "person@anywhere.co");
    auth.mockResolvedValue({ user: { email: "Person@Anywhere.co", emailVerified: true }, expires: new Date(Date.now() + 10000).toISOString() });
    expect(await requireAuthorizedUser()).toEqual({ email: "person@anywhere.co", role: "admin" });
    expect(await PublisherLayout({ children: null })).toBeTruthy();
  });
});

describe("server actions", () => {
  it("starts Google sign-in with a fixed editor destination", async () => {
    await signInWithGoogle();
    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/editor" });
  });
  it("offers a safe retry after an auth failure", async () => {
    signIn.mockRejectedValueOnce(new AuthError("private provider details"));
    await expect(signInWithGoogle()).rejects.toThrow("REDIRECT:/sign-in?error=OAuthCallbackError");
  });
  it("preserves the framework redirect exception", async () => {
    signIn.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(signInWithGoogle()).rejects.toThrow("NEXT_REDIRECT");
  });
  it("does not invoke Google without configuration", async () => {
    configured.mockReturnValue(false);
    await expect(signInWithGoogle()).rejects.toThrow("REDIRECT:/sign-in?error=Configuration");
    expect(signIn).not.toHaveBeenCalled();
  });
  it("uses library sign-out and returns to sign-in", async () => {
    await signOutOfApp();
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/sign-in" });
  });
});
