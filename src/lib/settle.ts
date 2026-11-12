import { prisma } from "@/lib/db";
import { addEvent, type JobRecord } from "@/lib/jobs";
import { explainReceiptWithToolkit, modelConfigured } from "@/lib/agent";
import {
  captureAuthorization,
  createReceiptInvoice,
  finalizeInvoiceReceipt,
  getInvoice,
  invoiceAmountMatches,
  invoiceIdFrom,
  paypalMockEnabled,
  refundCapture,
  voidAuthorization,
} from "@/lib/paypal";

export async function captureJob(job: JobRecord, options: { forced?: boolean; onLog?: (message: string) => void }) {
  if (!job.paypalAuthorizationId) {
    throw new Error("There is no authorization hold id.");
  }
  if (job.paypalCaptureId || job.status === "PAID") {
    return job;
  }
  options.onLog?.("The server captures the authorization separately from the review result.");
  const captured = await captureAuthorization({
    authorizationId: job.paypalAuthorizationId,
    jobId: job.id,
    cents: job.budgetCents,
    currency: job.currency,
  });
  const captureId = captured.id;
  if (!captureId) {
    throw new Error("Did not receive a capture id.");
  }
  await prisma.job.update({
    where: { id: job.id },
    data: { status: "PAID", paypalCaptureId: captureId },
  });
  let invoiceId: string | null = null;
  let invoiceError: string | null = null;
  try {
    invoiceId = await recordReceipt(job, captureId, options.onLog);
  } catch (error) {
    invoiceError = error instanceof Error ? error.message : "Could not record the invoice.";
    options.onLog?.(`Capture completed. Recording the receipt failed. ${invoiceError}`);
  }
  if (invoiceId) {
    await prisma.job.update({ where: { id: job.id }, data: { paypalInvoiceId: invoiceId } });
  }
  await addEvent(job.id, "PAID", {
    captureId,
    forced: Boolean(options.forced),
    mock: paypalMockEnabled() || job.paypalAuthorizationId.startsWith("MOCK-AUTH-"),
    invoiceId,
    invoiceError,
  });
  return prisma.job.findUniqueOrThrow({ where: { id: job.id } });
}

async function recordReceipt(job: JobRecord, captureId: string, onLog?: (message: string) => void) {
  if (!paypalMockEnabled() && process.env.PAYPAL_CLIENT_ID && modelConfigured()) {
    try {
      const agent = await explainReceiptWithToolkit({
        title: job.title,
        cents: job.budgetCents,
        currency: job.currency,
        captureId,
        recipientEmail: job.client.email,
        onLog: onLog || (() => undefined),
      });
      const invoiceId = invoiceIdFrom(agent);
      if (invoiceId) {
        const invoice = await getInvoice(invoiceId);
        if (invoiceAmountMatches(invoice, job.budgetCents)) {
          onLog?.("The draft amount matches the job budget. The server sends the receipt and records the payment.");
          await finalizeInvoiceReceipt({
            invoiceId,
            jobId: job.id,
            captureId,
            cents: job.budgetCents,
            currency: job.currency,
          });
          return invoiceId;
        }
        onLog?.("The invoice drafted by the agent does not match the budget, so it is not used.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent Toolkit error";
      onLog?.(`The Agent Toolkit invoice is not used. ${message}`);
    }
  }
  onLog?.("Recording a receipt invoice for the captured payment.");
  const invoice = await createReceiptInvoice({
    jobId: job.id,
    title: job.title,
    cents: job.budgetCents,
    currency: job.currency,
    captureId,
    recipientEmail: job.client.email,
  });
  return invoice.id;
}

export async function voidJob(job: JobRecord) {
  if (job.status === "CANCELED") return job;
  if (job.status === "PAID" && job.paypalCaptureId) {
    const refund = await refundCapture(job.paypalCaptureId, job.id, job.budgetCents, job.currency);
    await prisma.job.update({ where: { id: job.id }, data: { status: "CANCELED" } });
    await addEvent(job.id, "CANCELED", { refund });
    return prisma.job.findUniqueOrThrow({ where: { id: job.id } });
  }
  if (job.paypalAuthorizationId) {
    await voidAuthorization(job.paypalAuthorizationId, job.id);
  }
  await prisma.job.update({ where: { id: job.id }, data: { status: "CANCELED" } });
  await addEvent(job.id, "CANCELED", {
    authorizationId: job.paypalAuthorizationId,
    mock: paypalMockEnabled() || Boolean(job.paypalAuthorizationId?.startsWith("MOCK-AUTH-")),
  });
  return prisma.job.findUniqueOrThrow({ where: { id: job.id } });
}
