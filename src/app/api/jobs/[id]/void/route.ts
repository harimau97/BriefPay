import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { serializeJob } from "@/lib/dto";
import { apiError } from "@/lib/http";
import { getJob } from "@/lib/jobs";
import { voidJob } from "@/lib/settle";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return apiError("Sign in with a demo role.", 401);
  if (viewer.role !== "CLIENT") return apiError("Only a client can cancel.", 403);
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) return apiError("Job not found.", 404);
  if (job.clientId !== viewer.id) return apiError("You are not this job's client.", 403);
  if (job.status === "CANCELED") return NextResponse.json({ job: serializeJob(job) });
  if (job.status === "VERIFYING") return apiError("You can cancel after review finishes.", 409);

  try {
    await voidJob(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not release the hold.";
    return apiError(message, 502);
  }
  const updated = await getJob(id);
  return NextResponse.json({ job: serializeJob(updated!) });
}
