import "server-only";
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail, isAllowedGoogleProfile, SESSION_MAX_AGE } from "./policy";

const GOOGLE_OAUTH_SCOPES = "openid email profile";

function identityFields(profile: { sub: string; email: string }) {
  return {
    sub: profile.sub,
    email: profile.email,
    emailVerified: true as const,
    authenticatedUntil: Date.now() + SESSION_MAX_AGE * 1000,
  };
}

export function createAuthConfig(): NextAuthConfig {
  return {
    secret: process.env.AUTH_SECRET,
    basePath: "/api/auth",
    // AUTH_URL is required and validated before invoking Auth.js. Configure the
    // deployment proxy to accept only the application's public host.
    trustHost: true,
    providers: [Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: GOOGLE_OAUTH_SCOPES,
          prompt: "select_account",
          response_type: "code",
        },
      },
      checks: ["pkce", "state", "nonce"],
    })],
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
    pages: { signIn: "/sign-in", error: "/sign-in" },
    callbacks: {
      signIn({ account, profile }) {
        return account?.provider === "google" && isAllowedGoogleProfile(profile);
      },
      async jwt({ token, account, profile }) {
        if (account) {
          if (account.provider !== "google" || !isAllowedGoogleProfile(profile)) {
            return null;
          }
          // Identity only. Provider access, refresh, and ID tokens are discarded.
          return identityFields(profile);
        }
        if (token.emailVerified !== true || !isAllowedEmail(token.email) ||
            typeof token.authenticatedUntil !== "number" ||
            token.authenticatedUntil <= Date.now()) return null;

        return {
          sub: token.sub,
          email: token.email,
          emailVerified: true as const,
          authenticatedUntil: token.authenticatedUntil,
        };
      },
      session({ token }) {
        return {
          expires: new Date(token.authenticatedUntil as number).toISOString(),
          user: { email: token.email, emailVerified: token.emailVerified === true },
        };
      },
      redirect({ url, baseUrl }) {
        const origin = new URL(process.env.AUTH_URL ?? baseUrl).origin;
        // Only our two post-auth destinations are permitted, never user URLs.
        const path = new URL(url, origin);
        return path.origin === origin && path.pathname === "/sign-in"
          ? `${origin}/sign-in` : `${origin}/editor`;
      },
    },
    logger: {
      // Provider errors can contain tokens or response payloads. Log only type.
      error(error) { console.error("Authentication error:", "type" in error ? error.type : "Unknown"); },
      warn(code) { console.warn("Authentication warning:", code); },
      debug() {},
    },
  };
}
