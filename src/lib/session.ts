import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "briefpay_session";

export type SessionRole = "CLIENT" | "FREELANCER";

export type SessionData = {
  userId: string;
  role: SessionRole;
};

function secret() {
  return process.env.DEMO_LOGIN_SECRET || "briefpay-demo-login";
}

export function sealSession(data: SessionData) {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function openSession(token: string | undefined | null): SessionData | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionData;
    if (parsed.role !== "CLIENT" && parsed.role !== "FREELANCER") return null;
    if (!parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readSession() {
  const jar = await cookies();
  return openSession(jar.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  const base = process.env.APP_BASE_URL || "";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: base.startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  };
}
