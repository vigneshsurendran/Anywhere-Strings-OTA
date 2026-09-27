import { afterEach, describe, expect, it, vi } from "vitest";
import { Auth } from "@auth/core";
import { encode } from "next-auth/jwt";
import { createAuthConfig } from "@/src/lib/auth/config";
import { isAuthConfigured } from "@/src/lib/auth/environment";
import { isAllowedGoogleProfile, SESSION_MAX_AGE } from "@/src/lib/auth/policy";

const secret = "test-only-secret-with-at-least-32-characters";
const profile = { sub: "google-user-123", email: "person@anywhere.co", email_verified: true };
const account = { provider: "google", type: "oidc" as const, providerAccountId: profile.sub,
  access_token: "sensitive-access-token", refresh_token: "sensitive-refresh-token",
  id_token: "sensitive-id-token", expires_at: Math.floor(Date.now() / 1000) + 3600 };

function config() {
  return { ...createAuthConfig(), secret, trustHost: true };
}

function request(path: string, init?: RequestInit) {
  return Auth(new Request(`http://localhost:3000/api/auth/${path}`, init), config());
}

async function sessionCookie(overrides = {}) {
  const token = await encode({ secret, salt: "authjs.session-token", maxAge: SESSION_MAX_AGE,
    token: { sub: profile.sub, email: profile.email, emailVerified: true,
      authenticatedUntil: Date.now() + SESSION_MAX_AGE * 1000, ...overrides } });
  return `authjs.session-token=${token}`;
}

function cookies(response: Response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

afterEach(() => vi.unstubAllEnvs());

describe("Google authorization", () => {
  it("accepts a verified exact-domain identity, including case variations", () => {
    expect(isAllowedGoogleProfile(profile)).toBe(true);
    expect(isAllowedGoogleProfile({ ...profile, email: "Person@ANYWHERE.CO" })).toBe(true);
  });
  it.each([
    null, {}, { ...profile, sub: "" }, { ...profile, email: undefined },
    { ...profile, email_verified: false }, { ...profile, email_verified: undefined },
    { ...profile, email_verified: "true" },
    ...["person@gmail.com", "person@anywhere.co.evil.com", "person@evilanywhere.co",
      "person@sub.anywhere.co", "person@@anywhere.co", "@anywhere.co", " person@anywhere.co",
      "person@anywhere.co\n"].map((email) => ({ ...profile, email, hd: "anywhere.co" })),
  ])("rejects missing, unverified, malformed and lookalike identities: %j", (identity) => {
    expect(isAllowedGoogleProfile(identity)).toBe(false);
  });
  it("accepts a verified personal Google email when the local override is set", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_ALLOW_ANY_VERIFIED_EMAIL", "true");
    expect(isAllowedGoogleProfile({ ...profile, email: "person@gmail.com" })).toBe(true);
    expect(isAllowedGoogleProfile({ ...profile, email: "person@gmail.com", email_verified: false })).toBe(false);
  });
  it("ignores the personal-account override in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_ALLOW_ANY_VERIFIED_EMAIL", "true");
    expect(isAllowedGoogleProfile({ ...profile, email: "person@gmail.com" })).toBe(false);
    expect(isAllowedGoogleProfile(profile)).toBe(true);
  });
  it("rejects client claims and another provider even with an allowed email", async () => {
    const signIn = config().callbacks!.signIn!;
    expect(await signIn({ account, user: { email: profile.email }, profile: undefined })).toBe(false);
    expect(await signIn({ account: { ...account, provider: "other" }, user: {}, profile })).toBe(false);
    expect(await signIn({ account, user: {}, profile })).toBe(true);
  });
  it("discards provider tokens from the session JWT", async () => {
    const token = await config().callbacks!.jwt!({ token: {}, account, profile, user: {}, trigger: "signIn" });
    expect(token).toMatchObject({
      sub: profile.sub, email: profile.email, emailVerified: true,
    });
    expect(token).not.toHaveProperty("access_token");
    expect(token).not.toHaveProperty("refresh_token");
    expect(token).not.toHaveProperty("id_token");
    expect(JSON.stringify(token)).not.toContain("sensitive");
    expect(Object.keys(token!).sort()).toEqual([
      "authenticatedUntil", "email", "emailVerified", "sub",
    ]);
  });
  it("never exposes provider tokens through the session callback", async () => {
    const session = await config().callbacks!.session!({
      session: { expires: new Date().toISOString(), user: {} },
      token: {
        email: profile.email, emailVerified: true, authenticatedUntil: Date.now() + 10000,
        access_token: "sensitive-access-token", refresh_token: "sensitive-refresh-token",
        expires_at: account.expires_at,
      },
    } as never);
    expect(session).toEqual({
      expires: expect.any(String),
      user: { email: profile.email, emailVerified: true },
    });
    expect(JSON.stringify(session)).not.toContain("sensitive");
  });
  it("ignores client attempts to change the session identity or expiry", async () => {
    const until = Date.now() + 10000;
    const token = await config().callbacks!.jwt!({
      token: {
        email: profile.email, emailVerified: true, authenticatedUntil: until,
        access_token: "sensitive-access-token", refresh_token: "sensitive-refresh-token",
        expires_at: account.expires_at,
      },
      account: null, user: {}, trigger: "update",
      session: { email: "attacker@anywhere.co", emailVerified: true, authenticatedUntil: Infinity },
    });
    expect(token!.email).toBe(profile.email);
    expect(token!.authenticatedUntil).toBe(until);
    expect(token).not.toHaveProperty("access_token");
    expect(token).not.toHaveProperty("refresh_token");
    expect(JSON.stringify(token)).not.toContain("sensitive");
  });
});

describe("Auth.js session and request boundaries", () => {
  it("returns no session without a cookie", async () => {
    expect(await (await request("session")).json()).toBeNull();
  });
  it("restores an encrypted cookie across requests without returning provider tokens", async () => {
    const cookie = await sessionCookie();
    for (let i = 0; i < 2; i++) {
      const response = await request("session", { headers: { cookie } });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.user).toEqual({ email: profile.email, emailVerified: true });
      expect(Object.keys(body)).toEqual(["expires", "user"]);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.getSetCookie().join(";")).toMatch(/HttpOnly/i);
      expect(response.headers.getSetCookie().join(";")).toMatch(/SameSite=Lax/i);
    }
  });
  it.each([
    { authenticatedUntil: Date.now() - 1000 },
    { emailVerified: false }, { email: "person@gmail.com" }, { authenticatedUntil: undefined },
  ])("refuses an expired or unauthorized signed session: %j", async (overrides) => {
    const response = await request("session", { headers: { cookie: await sessionCookie(overrides) } });
    expect(await response.json()).toBeNull();
    expect(response.headers.getSetCookie().join(";")).toContain("Max-Age=0");
  });
  it("refuses an expired encrypted token", async () => {
    const token = await encode({ secret, salt: "authjs.session-token", maxAge: -60, token: {} });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await (await request("session", { headers: { cookie: `authjs.session-token=${token}` } })).json()).toBeNull();
  });
  it("refuses a tampered cookie and logs no cookie contents", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await request("session", { headers: { cookie: "authjs.session-token=sensitive-forged-cookie" } });
    expect(await response.json()).toBeNull();
    expect(JSON.stringify(log.mock.calls)).not.toContain("sensitive-forged-cookie");
  });
  it("protects sign-out with CSRF and clears the browser session after valid sign-out", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cookie = await sessionCookie();
    const rejected = await request("signout", { method: "POST", headers: { cookie,
      "Content-Type": "application/x-www-form-urlencoded" }, body: "callbackUrl=/sign-in" });
    expect(rejected.headers.get("location")).toContain("MissingCSRF");
    expect(rejected.headers.getSetCookie().join(";")).not.toContain("authjs.session-token=;");
    const csrf = await request("csrf");
    const { csrfToken } = await csrf.json();
    const response = await request("signout", { method: "POST", headers: {
      cookie: `${cookie}; ${cookies(csrf)}`, "Content-Type": "application/x-www-form-urlencoded",
    }, body: new URLSearchParams({ csrfToken, callbackUrl: "/sign-in" }) });
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in");
    expect(response.headers.getSetCookie().join(";")).toContain("authjs.session-token=;");
    expect(response.headers.getSetCookie().join(";")).toContain("Max-Age=0");
    expect(await (await request("session", { headers: { cookie: cookies(response) } })).json()).toBeNull();
  });
  it("does not redirect users to external callback URLs", async () => {
    const redirect = config().callbacks!.redirect!;
    for (const url of ["https://evil.example", "//evil.example", "/other", "http://localhost:3000/sign-in.evil"]) {
      expect(await redirect({ url, baseUrl: "http://localhost:3000" })).toBe("http://localhost:3000/editor");
    }
  });
});

describe("configuration fails closed", () => {
  function configure() {
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    vi.stubEnv("AUTH_SECRET", secret);
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
  }
  it("supports localhost development only when all required values exist", () => {
    configure();
    expect(isAuthConfigured()).toBe(true);
  });
  it.each(["AUTH_URL", "AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"])("rejects missing %s", (name) => {
    configure(); vi.stubEnv(name, ""); expect(isAuthConfigured()).toBe(false);
  });
  it.each(["not-a-url", "https://example.com/path", "https://example.com?query=true", "https://user:pass@example.com", "http://example.com"])("rejects unsafe origins: %s", (url) => {
    configure(); vi.stubEnv("AUTH_URL", url); expect(isAuthConfigured()).toBe(false);
  });
  it("requires HTTPS in production", () => {
    configure(); vi.stubEnv("NODE_ENV", "production"); expect(isAuthConfigured()).toBe(false);
    vi.stubEnv("AUTH_URL", "https://publisher.example.com"); expect(isAuthConfigured()).toBe(true);
  });
});
