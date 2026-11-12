import { NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { serializeJob } from "@/lib/dto";
import { apiError } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) return apiError("Job not found.", 404);
  return NextResponse.json({ job: serializeJob(job) });
}
