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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
