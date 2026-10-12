/**
 * Optimistic redirect for protected areas: no session cookie, no entry.
 *
 * This is NOT the security boundary. A cookie can be forged, so every
 * protected page and server action re-validates the session server-side
 * (see src/lib/session.ts). This only spares signed-out visitors a round trip.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  if (getSessionCookie(request, { cookiePrefix: "jsc" })) return NextResponse.next();

  const login = new URL("/login", request.url);
  // Keep the query (e.g. ?plan=ultra). /login re-validates it with safeNextPath.
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/portal/:path*", "/staff/:path*"],
};
