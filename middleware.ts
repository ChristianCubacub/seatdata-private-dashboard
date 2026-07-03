import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;

  if (!username || !password) {
    return new Response("Missing dashboard auth environment variables.", {
      status: 500,
    });
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const base64Credentials = authHeader.split(" ")[1];
    const credentials = atob(base64Credentials);
    const [inputUsername, inputPassword] = credentials.split(":");

    if (inputUsername === username && inputPassword === password) {
      return NextResponse.next();
    }
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="SeatData Dashboard"',
    },
  });
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};