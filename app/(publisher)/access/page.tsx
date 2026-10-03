import { redirect } from "next/navigation";
import { AuthorizationError, requireAdmin } from "@/src/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  await requireAdmin().catch((error: unknown) => {
    if (error instanceof AuthorizationError) {
      redirect(error.status === 403 ? "/editor" : "/sign-in");
    }
    throw error;
  });
  return null;
}
