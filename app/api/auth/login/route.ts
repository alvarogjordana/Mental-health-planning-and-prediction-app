import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = (await request.json()) as {
      username: string;
      password: string;
    };

    const expectedUser = process.env.APP_USERNAME ?? "";
    const expectedPass = process.env.APP_PASSWORD ?? "";
    const secret       = process.env.APP_SESSION_SECRET ?? "";

    if (
      !safeCompare(username ?? "", expectedUser) ||
      !safeCompare(password ?? "", expectedPass)
    ) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Build HMAC-signed session token: timestamp.base64sig
    const data = String(Date.now());
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(data),
    );
    const sig   = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
    const token = `${data}.${sig}`;

    const response = NextResponse.json({ success: true });
    response.cookies.set("freedom_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
