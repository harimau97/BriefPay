import type { JobRecord } from "@/lib/jobs";

export type JobDTO = {
  id: string;
  title: string;
  brief: string;
  budgetCents: number;
  currency: string;
  dueAt: string;
  status: string;
  paypalOrderId: string | null;
  paypalAuthorizationId: string | null;
  paypalCaptureId: string | null;
  paypalInvoiceId: string | null;
  client: { id: string; name: string; email: string };
  freelancer: { id: string; name: string; email: string } | null;
  criteria: { id: string; label: string; sortOrder: number }[];
  submissions: {
    id: string;
    deliveryUrl: string;
    notes: string;
    createdAt: string;
    verification: {
      id: string;
      status: string;
      summary: string;
      createdAt: string;
      results: {
        id: string;
        criterionId: string;
        verdict: string;
        evidence: string;
        confidence: number;
      }[];
    } | null;
  }[];
  events: { id: string; type: string; at: string; payload: string }[];
};

export function serializeJob(job: JobRecord): JobDTO {
  return {
    id: job.id,
    title: job.title,
    brief: job.brief,
    budgetCents: job.budgetCents,
    currency: job.currency,
    dueAt: job.dueAt.toISOString(),
    status: job.status,
    paypalOrderId: job.paypalOrderId,
    paypalAuthorizationId: job.paypalAuthorizationId,
    paypalCaptureId: job.paypalCaptureId,
    paypalInvoiceId: job.paypalInvoiceId,
    client: { id: job.client.id, name: job.client.name, email: job.client.email },
    freelancer: job.freelancer
      ? { id: job.freelancer.id, name: job.freelancer.name, email: job.freelancer.email }
      : null,
    criteria: job.criteria.map((criterion) => ({
      id: criterion.id,
      label: criterion.label,
      sortOrder: criterion.sortOrder,
    })),
    submissions: job.submissions.map((submission) => ({
      id: submission.id,
      deliveryUrl: submission.deliveryUrl,
      notes: submission.notes,
      createdAt: submission.createdAt.toISOString(),
      verification: submission.verification
        ? {
            id: submission.verification.id,
            status: submission.verification.status,
            summary: submission.verification.summary,
            createdAt: submission.verification.createdAt.toISOString(),
            results: submission.verification.results.map((result) => ({
              id: result.id,
              criterionId: result.criterionId,
              verdict: result.verdict,
              evidence: result.evidence,
              confidence: result.confidence,
            })),
          }
        : null,
    })),
    events: job.events.map((event) => ({
      id: event.id,
      type: event.type,
      at: event.at.toISOString(),
      payload: event.payload,
    })),
  };
}
