import { NextRequest, NextResponse } from "next/server";

// Session presence check at the edge; full JWT verification happens server-side
// in lib/auth (every action/page re-verifies — this is just fast redirect UX).
const PROTECTED = ["/dashboard", "/projects", "/setup", "/p/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("procyra_session")?.value);
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p)) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|api|.*\\..*).*)"] };
