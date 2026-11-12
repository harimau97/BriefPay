import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addEvent, getJob } from "@/lib/jobs";
import { amountsMatch, authorizeOrder, readAuthorization } from "@/lib/paypal";
import { verifyWebhookSignature } from "@/lib/paypal-webhook";

type PayPalEvent = {
  event_type?: string;
  resource?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const raw = await request.text();
  let event: PayPalEvent;
  try {
    event = JSON.parse(raw) as PayPalEvent;
  } catch {
    return NextResponse.json({ error: "Not JSON." }, { status: 400 });
  }
  try {
    await verifyWebhookSignature({ headers: request.headers, event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signature verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const resource = event.resource || {};
  const type = event.event_type || "";
  try {
    if (type === "CHECKOUT.ORDER.APPROVED") {
      await onOrderApproved(resource);
    } else if (type === "PAYMENT.AUTHORIZATION.CREATED" || type === "PAYMENT.AUTHORIZATION.VOIDED") {
      await onAuthorization(type, resource);
    } else if (type === "PAYMENT.CAPTURE.COMPLETED") {
      await onCapture(resource);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handling failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function onOrderApproved(resource: Record<string, unknown>) {
  const units = Array.isArray(resource.purchase_units) ? resource.purchase_units : [];
  const unit = units[0] as { custom_id?: string; payments?: { captures?: unknown[] } } | undefined;
  const jobId = unit?.custom_id;
  if (!jobId) return;
  if (unit?.payments?.captures?.length) return;
  const job = await getJob(jobId);
  if (!job || job.status !== "DRAFT") return;
  const orderId = String(resource.id || "");
  if (!orderId) return;
  const order = await authorizeOrder(orderId, job.id);
  const { authorization, capture, unit: authorizedUnit } = readAuthorization(order);
  if (capture || !authorization?.id) return;
  if (authorizedUnit?.custom_id !== job.id && authorizedUnit?.reference_id !== job.id) return;
  const amount = authorization.amount?.value || authorizedUnit?.amount?.value;
  if (!amountsMatch(amount, job.budgetCents)) return;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({
      where: { id: job.id, status: "DRAFT" },
      data: { status: "FUNDED", paypalOrderId: orderId, paypalAuthorizationId: authorization.id },
    });
    if (updated.count === 1) {
      await addEvent(job.id, "FUNDED", { orderId, authorizationId: authorization.id, source: "webhook" }, tx);
    }
  });
}

async function onAuthorization(type: string, resource: Record<string, unknown>) {
  const authorizationId = String(resource.id || "");
  if (!authorizationId) return;
  const job = await prisma.job.findFirst({ where: { paypalAuthorizationId: authorizationId } });
  if (!job) return;
  if (type === "PAYMENT.AUTHORIZATION.VOIDED" && job.status !== "PAID" && job.status !== "CANCELED") {
    await prisma.job.update({ where: { id: job.id }, data: { status: "CANCELED" } });
    await addEvent(job.id, "CANCELED", { source: "webhook", authorizationId });
  }
}

async function onCapture(resource: Record<string, unknown>) {
  const captureId = String(resource.id || "");
  const related = resource.supplementary_data as { related_ids?: { authorization_id?: string; order_id?: string } } | undefined;
  const authorizationId = related?.related_ids?.authorization_id;
  const job = authorizationId
    ? await prisma.job.findFirst({ where: { paypalAuthorizationId: authorizationId } })
    : await prisma.job.findFirst({ where: { paypalCaptureId: captureId } });
  if (!job || job.status === "CANCELED") return;
  if (job.status !== "PAID") {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "PAID", paypalCaptureId: captureId || job.paypalCaptureId },
    });
    await addEvent(job.id, "PAID", { source: "webhook", captureId });
  }
}
