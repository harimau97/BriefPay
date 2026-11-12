import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeJob } from "@/lib/dto";
import { apiError, readJson } from "@/lib/http";
import { addEvent, getJob } from "@/lib/jobs";
import { resolveDeliveryUrl } from "@/lib/browse";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return apiError("Sign in with a demo role.", 401);
  if (viewer.role !== "FREELANCER") return apiError("A freelancer submits the delivery.", 403);
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) return apiError("Job not found.", 404);
  if (job.freelancerId !== viewer.id) return apiError("Only the freelancer who accepted the job can submit.", 403);
  if (job.status !== "IN_PROGRESS" && job.status !== "FAILED") {
    return apiError("You can submit only while the job is in progress or awaiting revision.", 409);
  }

  const body = await readJson(request);
  const deliveryUrl = String(body.deliveryUrl || "").trim();
  const notes = String(body.notes || "").slice(0, 2000);
  if (!deliveryUrl) return apiError("A delivery URL is required.");
  try {
    resolveDeliveryUrl(deliveryUrl);
  } catch {
    return apiError("The delivery URL is not valid.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.submission.create({ data: { jobId: id, deliveryUrl, notes } });
    await tx.job.update({ where: { id }, data: { status: "SUBMITTED" } });
    await addEvent(id, "SUBMITTED", { deliveryUrl }, tx);
  });
  const updated = await getJob(id);
  return NextResponse.json({ job: serializeJob(updated!) });
}
