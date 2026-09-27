import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Auth, customFetch } from "@auth/core";
import type { OAuthConfig } from "next-auth/providers";
import { SignJWT, generateKeyPair } from "jose";
import { createAuthConfig } from "@/src/lib/auth/config";

const issuer = "https://accounts.google.com";
const secret = "test-only-secret-with-at-least-32-characters";
const { privateKey } = await generateKeyPair("RS256");
let nonce = "";
let claims: Record<string, unknown>;
const upstream = vi.fn(async (input: string | URL | Request) => {
  const url = String(input);
  if (url.endsWith("/.well-known/openid-configuration")) {
    return Response.json({ issuer, authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`, userinfo_endpoint: `${issuer}/userinfo`, jwks_uri: `${issuer}/jwks`,
      response_types_supported: ["code"], subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"], code_challenge_methods_supported: ["S256"] });
  }
  if (url === `${issuer}/token`) {
    const id_token = await new SignJWT({ ...claims, nonce }).setProtectedHeader({ alg: "RS256" })
      .setIssuer(issuer).setAudience("test-client").setIssuedAt().setExpirationTime("5m").sign(privateKey);
    return Response.json({
      access_token: "private-google-token", refresh_token: "private-refresh-token",
      token_type: "Bearer", expires_in: 300, id_token,
    });
  }
  throw new Error("Unexpected mocked provider endpoint");
});

function config() {
  const result = createAuthConfig();
  const provider = result.providers[0] as OAuthConfig<Record<string, unknown>>;
  provider[customFetch] = upstream;
  return { ...result, secret };
}
function cookies(response: Response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}
function request(path: string, init?: RequestInit) {
  return Auth(new Request(`http://localhost:3000/api/auth/${path}`, init), config());
}
async function begin() {
  const csrf = await request("csrf");
  const { csrfToken } = await csrf.json();
  const response = await request("signin/google", { method: "POST", headers: {
    cookie: cookies(csrf), "Content-Type": "application/x-www-form-urlencoded",
  }, body: new URLSearchParams({ csrfToken, callbackUrl: "/editor" }) });
  const location = new URL(response.headers.get("location")!);
  nonce = location.searchParams.get("nonce")!;
  return { response, location, cookie: cookies(response) };
}

beforeEach(() => {
  upstream.mockClear();
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
  claims = { sub: "google-123", email: "person@anywhere.co", email_verified: true };
});
afterEach(() => vi.unstubAllEnvs());

describe("mocked Google authorization-code flow", () => {
  it("uses state, PKCE and nonce; accepts a verified account and restores its session", async () => {
    const { location, cookie } = await begin();
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    expect(location.searchParams.get("prompt")).toBe("select_account");
    expect(location.searchParams.get("access_type")).toBeNull();
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(location.searchParams.get("code_challenge")).toBeTruthy();
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(nonce).toBeTruthy();
    const response = await request(`callback/google?code=test-code&state=${location.searchParams.get("state")}`, { headers: { cookie } });
    expect(response.headers.get("location")).toBe("http://localhost:3000/editor");
    const session = await request("session", { headers: { cookie: cookies(response) } });
    const body = await session.json();
    expect(body.user).toEqual({ email: "person@anywhere.co", emailVerified: true });
    expect(Object.keys(body)).toEqual(["expires", "user"]);
    expect(JSON.stringify(body)).not.toContain("private-google-token");
    expect(JSON.stringify(body)).not.toContain("private-refresh-token");
    expect(response.headers.getSetCookie().join(";")).not.toContain("private-google-token");
  });
  it.each([
    { email: "person@gmail.com" }, { email: "person@anywhere.co.evil.com" },
    { email_verified: false }, { email: undefined }, { email_verified: undefined },
  ])("denies provider identity %j without issuing an application session", async (overrides) => {
    claims = { ...claims, ...overrides };
    const { location, cookie } = await begin();
    const response = await request(`callback/google?code=test-code&state=${location.searchParams.get("state")}`, { headers: { cookie } });
    expect(response.headers.get("location")).toContain("/sign-in?error=AccessDenied");
    expect(response.headers.getSetCookie().join(";")).not.toContain("authjs.session-token=");
  });
  it("accepts a verified personal Google email when the local override is set", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_ALLOW_ANY_VERIFIED_EMAIL", "true");
    claims = { ...claims, email: "person@gmail.com" };
    const { location, cookie } = await begin();
    const response = await request(`callback/google?code=test-code&state=${location.searchParams.get("state")}`, { headers: { cookie } });
    expect(response.headers.get("location")).toBe("http://localhost:3000/editor");
    const body = await (await request("session", { headers: { cookie: cookies(response) } })).json();
    expect(body.user).toEqual({ email: "person@gmail.com", emailVerified: true });
  });
  it("handles canceled consent without creating a session", async () => {
    const { location, cookie } = await begin();
    const response = await request(`callback/google?error=access_denied&state=${location.searchParams.get("state")}`, { headers: { cookie } });
    expect(response.headers.get("location")).toContain("/sign-in?error=OAuthCallbackError");
    expect(response.headers.getSetCookie().join(";")).not.toContain("authjs.session-token=");
  });
  it("rejects a callback with mismatched state", async () => {
    const { cookie } = await begin();
    const response = await request("callback/google?code=test-code&state=wrong", { headers: { cookie } });
    expect(response.headers.get("location")).toContain("/sign-in?error=");
    expect(response.headers.getSetCookie().join(";")).not.toContain("authjs.session-token=");
  });
  it("rejects a callback when the transient cookies are absent or expired", async () => {
    const { location } = await begin();
    const response = await request(`callback/google?code=test-code&state=${location.searchParams.get("state")}`);
    expect(response.headers.get("location")).toContain("/sign-in?error=");
    expect(response.headers.getSetCookie().join(";")).not.toContain("authjs.session-token=");
  });
});
