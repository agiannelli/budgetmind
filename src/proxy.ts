import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";

/**
 * Next.js 16 Proxy (formerly middleware). Runs on the Node.js runtime.
 *
 * 1. Delegates to the Auth0 SDK to mount the `/auth/*` routes and refresh the
 *    session cookie.
 * 2. Optimistically gates every other route: no session -> redirect to login.
 *
 * This is an optimistic check only. Per the Next.js data-security guidance,
 * authoritative checks also live in the (app) layout and any data access.
 */
// Publicly reachable app routes (no session required).
const PUBLIC_PATHS = new Set<string>(["/"]);

export async function proxy(request: NextRequest) {
  const authRes = await auth0.middleware(request);

  const { pathname } = request.nextUrl;

  // Let the Auth0 SDK's own routes and public pages through.
  if (pathname.startsWith("/auth") || PUBLIC_PATHS.has(pathname)) {
    return authRes;
  }

  const session = await auth0.getSession(request);
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", request.nextUrl.origin));
  }

  return authRes;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|sitemap.xml|robots.txt).*)",
  ],
};
