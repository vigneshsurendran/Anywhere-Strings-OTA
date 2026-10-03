import { NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/src/lib/auth/session";
import { InputError } from "@/src/features/catalog/validation";
import { releaseDownload } from "@/src/server/releases";
import { withDatabase } from "@/src/server/database";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthorizedUser();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.redirect(new URL(error.status === 403 ? "/sign-in?error=AccessDenied" : "/sign-in", _request.url));
    }
    throw error;
  }
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "That release does not exist." }, { status: 404 });
  try {
    const file = withDatabase((db) => releaseDownload(db, id));
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}
