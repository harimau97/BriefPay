import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { apiError, readJson } from "@/lib/http";
import { getJob } from "@/lib/jobs";
import { createAuthorizeOrder, paypalConfigured, paypalMockEnabled } from "@/lib/paypal";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return apiError("Sign in with a demo role.", 401);
  if (viewer.role !== "CLIENT") return apiError("Only a client can place the hold.", 403);
  const body = await readJson(request);
  const jobId = String(body.jobId || "");
  const job = await getJob(jobId);
  if (!job) return apiError("Job not found.", 404);
  if (job.clientId !== viewer.id) return apiError("You are not this job's client.", 403);
  if (job.status !== "DRAFT") return apiError("An authorization hold can be created only while the job is a draft.", 409);
  if (!paypalConfigured() && !paypalMockEnabled()) {
    return apiError("PayPal sandbox keys are missing. Set PAYPAL_CLIENT_ID in .env, or set PAYPAL_MOCK=true for a local walkthrough.", 503);
  }

  try {
    const order = await createAuthorizeOrder({
      jobId: job.id,
      title: job.title,
      cents: job.budgetCents,
      currency: job.currency,
    });
    if (!order.id) return apiError("Did not receive an order id.", 502);
    return NextResponse.json({ orderId: order.id, mock: Boolean(order.mock) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the order.";
    return apiError(message, 502);
  }
}
