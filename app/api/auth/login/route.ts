import { NextResponse } from "next/server";
import {
  createSessionToken,
  secureEqual,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(request: Request) {
  const expectedUsername = process.env.DASHBOARD_USERNAME;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;
  const sessionSecret =
    process.env.DASHBOARD_SESSION_SECRET ?? expectedPassword;

  if (!expectedUsername || !expectedPassword || !sessionSecret) {
    return NextResponse.json(
      { error: "Dashboard authentication is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const username = String(body.username ?? "");
    const password = String(body.password ?? "");
    const [usernameMatches, passwordMatches] = await Promise.all([
      secureEqual(username, expectedUsername),
      secureEqual(password, expectedPassword),
    ]);

    if (!usernameMatches || !passwordMatches) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: await createSessionToken(expectedUsername, sessionSecret),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 12 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
  }
}
