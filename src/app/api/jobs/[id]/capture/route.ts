import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { serializeJob } from "@/lib/dto";
import { apiError, readJson } from "@/lib/http";
import { getJob } from "@/lib/jobs";
import { captureJob } from "@/lib/settle";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return apiError("Sign in with a demo role.", 401);
  if (viewer.role !== "CLIENT") return apiError("Only a client can confirm payout.", 403);
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) return apiError("Job not found.", 404);
  if (job.clientId !== viewer.id) return apiError("You are not this job's client.", 403);

  const body = await readJson(request);
  const force = body.force === true;
  if (job.status === "PAID") return NextResponse.json({ job: serializeJob(job) });
  if (job.status !== "PASSED" && !(force && job.status === "FAILED")) {
    return apiError("Capture runs only after review passes, or when the client forces payout on a failed job.", 409);
  }

  try {
    await captureJob(job, { forced: force });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Capture failed.";
    return apiError(message, 502);
  }
  const updated = await getJob(id);
  return NextResponse.json({ job: serializeJob(updated!) });
}
