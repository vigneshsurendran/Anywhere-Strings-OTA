import "server-only";
import { claimFirstAdmin, findAccess, type AccessRole } from "@/src/server/access";
import { withDatabase } from "@/src/server/database";
import { auth } from "./index";
import { isAuthConfigured } from "./environment";
import { isAllowedEmail, isEmailDomainRestrictionRelaxed } from "./policy";

export type AuthorizedUser = {
  email: string;
  role: AccessRole;
};

export class AuthorizationError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "Sign-in required" : "Access denied");
    this.name = "AuthorizationError";
  }
}

export async function getAuthorizedUser() {
  if (!isAuthConfigured()) return null;
  const session = await auth();
  if (!session || !(Date.parse(session.expires) > Date.now())) return null;
  if (session.user?.emailVerified !== true || !isAllowedEmail(session.user.email)) {
    throw new AuthorizationError(403);
  }
  const email = session.user.email.toLowerCase();
  const row = withDatabase((db) => findAccess(db, email));
  if (row) return { email, role: row.role };
  if (isEmailDomainRestrictionRelaxed() && withDatabase((db) => claimFirstAdmin(db, email))) {
    return { email, role: "admin" as const };
  }
  throw new AuthorizationError(403);
}

export async function requireAdmin() {
  const user = await requireAuthorizedUser();
  if (user.role !== "admin") throw new AuthorizationError(403);
  return user;
}

// Call independently inside every future protected server operation.
export async function requireAuthorizedUser() {
  const user = await getAuthorizedUser();
  if (!user) throw new AuthorizationError(401);
  return user;
}
