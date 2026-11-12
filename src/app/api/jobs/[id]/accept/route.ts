import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/http";
import { addEvent, getJob } from "@/lib/jobs";
import { serializeJob } from "@/lib/dto";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return apiError("Sign in with a demo role.", 401);
  if (viewer.role !== "FREELANCER") return apiError("Only a freelancer can accept a job.", 403);
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) return apiError("Job not found.", 404);
  if (job.status !== "FUNDED") return apiError("Only a job with an authorization hold can be accepted.", 409);

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id },
      data: { status: "IN_PROGRESS", freelancerId: viewer.id },
    });
    await addEvent(id, "ACCEPTED", { freelancerId: viewer.id }, tx);
  });
  const updated = await getJob(id);
  return NextResponse.json({ job: serializeJob(updated!) });
}
