import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, readJson } from "@/lib/http";
import { addEvent } from "@/lib/jobs";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return apiError("Sign in with a demo role.", 401);
  if (viewer.role !== "CLIENT") return apiError("Only a client can create a job.", 403);

  const body = await readJson(request);
  const title = String(body.title || "").trim();
  const brief = String(body.brief || "").trim();
  const currency = String(body.currency || "USD").toUpperCase();
  const dueAt = new Date(String(body.dueAt || ""));
  const budgetCents = Number(body.budgetCents);
  const criteria = Array.isArray(body.criteria) ? body.criteria.map((item) => String(item).trim()).filter(Boolean) : [];

  if (!title || !brief) return apiError("Title and brief are required.");
  if (currency !== "USD") return apiError("The demo currency is USD only.");
  if (!Number.isInteger(budgetCents) || budgetCents < 100 || budgetCents > 10_000_000) {
    return apiError("The budget must be at least 1 USD.");
  }
  if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() < Date.now() - 60_000) {
    return apiError("The due date must be in the future.");
  }
  if (criteria.length < 1 || criteria.length > 8) return apiError("Add between 1 and 8 acceptance criteria.");

  const job = await prisma.job.create({
    data: {
      title,
      brief,
      budgetCents,
      currency,
      dueAt,
      clientId: viewer.id,
      criteria: { create: criteria.map((label, sortOrder) => ({ label, sortOrder })) },
    },
  });
  await addEvent(job.id, "CREATED", {});
  return NextResponse.json({ id: job.id });
}
