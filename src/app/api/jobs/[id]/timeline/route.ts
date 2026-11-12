import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { getJob } from "@/lib/jobs";
import { buildTimeline } from "@/lib/timeline";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) return apiError("Job not found.", 404);
  return NextResponse.json(buildTimeline({ title: job.title, events: job.events }));
}
