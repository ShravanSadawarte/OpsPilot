import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (formerly Middleware in Next.js < 16) provides early navigation checks only.
 *
 * - Session validation (expiration/revocation) requires the database and is
 *   performed at the server boundary in Route Handlers / Server Components.
 * - Proxy only redirects clearly unauthenticated requests (no session cookie)
 *   away from private app routes, and sets cache headers so private,
 *   user-specific data is never cached by browsers/CDNs.
 */
const PUBLIC_PREFIXES = ["/login", "/api/v1/auth", "/_next", "/favicon.ico"];
const PRIVATE_PREFIXES = ["/dashboard", "/work-items", "/teams", "/approvals", "/activity", "/my-work", "/settings"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("ops_session");

  // Redirect unauthenticated users to login for private app pages.
  if (PRIVATE_PREFIXES.some((p) => pathname.startsWith(p)) && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();

  // Never cache private/user-specific responses publicly.
  if (pathname.startsWith("/api/") || PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) {
    response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)"],
};
