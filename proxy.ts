import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;
  const sessionSecret = process.env.DASHBOARD_SESSION_SECRET ?? password;

  if (!username || !password || !sessionSecret) {
    return new Response("Missing dashboard auth environment variables.", {
      status: 500,
    });
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (
    sessionToken &&
    (await verifySessionToken(sessionToken, username, sessionSecret))
  ) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    try {
      const credentials = atob(authHeader.split(" ")[1]);
      const separator = credentials.indexOf(":");
      const inputUsername = credentials.slice(0, separator);
      const inputPassword = credentials.slice(separator + 1);

      if (inputUsername === username && inputPassword === password) {
        return NextResponse.next();
      }
    } catch {
      // Malformed Basic Auth falls through to the normal login response.
    }
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
