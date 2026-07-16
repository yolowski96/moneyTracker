import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/login", "/register"]);

export default auth((req) => {
  const { nextUrl } = req;
  const isAuth = !!req.auth;

  // API routes authenticate via bearer token or NextAuth handlers themselves.
  if (nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  if (PUBLIC_PATHS.has(nextUrl.pathname)) {
    if (isAuth) return NextResponse.redirect(new URL("/", nextUrl));
    return NextResponse.next();
  }

  if (!isAuth) {
    const url = new URL("/login", nextUrl);
    if (nextUrl.pathname !== "/") url.searchParams.set("from", nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

// PWA assets must stay reachable without a session: the browser fetches the
// manifest without cookies, and the service worker + icons are requested
// before/independent of login. An auth redirect here breaks installability.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|icon\\.png|apple-icon\\.png|icon-192\\.png|icon-512\\.png|icon-maskable-512\\.png).*)",
  ],
};
