import type { NextRequest } from "next/server";
import { handlers } from "@/src/lib/auth";
import { isAuthConfigured } from "@/src/lib/auth/environment";

function unavailable() {
  return Response.json({ error: "Sign-in is not configured. Contact your administrator." },
    { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  return isAuthConfigured() ? handlers.GET(request) : unavailable();
}

export async function POST(request: NextRequest) {
  return isAuthConfigured() ? handlers.POST(request) : unavailable();
}
