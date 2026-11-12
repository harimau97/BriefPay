import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, readJson } from "@/lib/http";
import { sealSession, SESSION_COOKIE, sessionCookieOptions, type SessionRole } from "@/lib/session";

const emails: Record<SessionRole, string> = {
  CLIENT: "client@demo.com",
  FREELANCER: "freelancer@demo.com",
};

export async function POST(request: Request) {
  const body = await readJson(request);
  const role = body.role;
  if (role !== "CLIENT" && role !== "FREELANCER") {
    return apiError("Role must be CLIENT or FREELANCER.");
  }
  const user = await prisma.user.findUnique({ where: { email: emails[role] } });
  if (!user) {
    return apiError("No demo account found. Run prisma db seed.", 500);
  }
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE, sealSession({ userId: user.id, role: user.role }), sessionCookieOptions());
  return response;
}
