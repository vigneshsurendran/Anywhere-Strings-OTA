export const ALLOWED_DOMAIN = "anywhere.co";
export const SESSION_MAX_AGE = 8 * 60 * 60;

/** Local-only bypass of the @anywhere.co restriction. Ignored in production. */
export function isEmailDomainRestrictionRelaxed(): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.AUTH_ALLOW_ANY_VERIFIED_EMAIL === "true";
}

export function isAllowedEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  if (isEmailDomainRestrictionRelaxed()) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  return /^[^\s@]+@anywhere\.co$/i.test(email);
}

export function isAllowedGoogleProfile(profile: unknown): profile is {
  sub: string;
  email: string;
  email_verified: true;
} {
  if (!profile || typeof profile !== "object") return false;
  return (
    "sub" in profile && typeof profile.sub === "string" && profile.sub.length > 0 &&
    "email_verified" in profile && profile.email_verified === true &&
    "email" in profile && isAllowedEmail(profile.email)
  );
}
