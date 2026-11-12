import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeJob } from "@/lib/dto";
import { apiError, readJson } from "@/lib/http";
import { addEvent, getJob } from "@/lib/jobs";
import { amountsMatch, authorizeOrder, paypalMockEnabled, readAuthorization } from "@/lib/paypal";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return apiError("Sign in with a demo role.", 401);
  if (viewer.role !== "CLIENT") return apiError("Only a client can record an authorization.", 403);
  const body = await readJson(request);
  const jobId = String(body.jobId || "");
  const orderId = String(body.orderId || "");
  if (!orderId) return apiError("An order id is required.");
  const job = await getJob(jobId);
  if (!job) return apiError("Job not found.", 404);
  if (job.clientId !== viewer.id) return apiError("You are not this job's client.", 403);
  if (job.status === "FUNDED" && job.paypalAuthorizationId) {
    return NextResponse.json({ job: serializeJob(job), alreadyFunded: true });
  }
  if (job.status !== "DRAFT") return apiError("An authorization hold can be recorded only while the job is a draft.", 409);

  try {
    const order = await authorizeOrder(orderId, job.id);
    const { unit, authorization, capture } = readAuthorization(order);
    if (capture) {
      return apiError("This order is already captured. It is not an authorization hold, so it is not recorded.", 409);
    }
    if (!authorization?.id) return apiError("Could not find an authorization id. Capture was not called.", 502);
    const mock = paypalMockEnabled() || orderId.startsWith("MOCK-ORDER-");
    if (!mock) {
      if (unit?.custom_id !== job.id && unit?.reference_id !== job.id) {
        return apiError("The order does not match this job.", 409);
      }
      const amount = authorization.amount?.value || unit?.amount?.value;
      const currency = authorization.amount?.currency_code || unit?.amount?.currency_code || "";
      if (!amountsMatch(amount, job.budgetCents) || currency !== job.currency) {
        return apiError(
          `The authorized amount does not match the job budget. PayPal returned ${currency || "no currency"} ${amount || "no amount"}.`,
          409,
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: job.id },
        data: {
          status: "FUNDED",
          paypalOrderId: order.id || orderId,
          paypalAuthorizationId: authorization.id,
        },
      });
      await addEvent(job.id, "FUNDED", {
        orderId: order.id || orderId,
        authorizationId: authorization.id,
        mock,
        captured: false,
      }, tx);
    });
    const updated = await getJob(job.id);
    return NextResponse.json({ job: serializeJob(updated!), mock });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record the authorization.";
    return apiError(message, 502);
  }
}
