import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runVerification } from "@/lib/agent";
import { addEvent, getJob } from "@/lib/jobs";
import { captureJob } from "@/lib/settle";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const encoder = new TextEncoder();
  const { id } = await context.params;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        const viewer = await getViewer();
        if (!viewer) {
          send("error", { message: "Sign in with a demo role." });
          return;
        }
        const job = await getJob(id);
        if (!job) {
          send("error", { message: "Job not found." });
          return;
        }
        if (viewer.id !== job.clientId && viewer.id !== job.freelancerId) {
          send("error", { message: "Only this job's client or assigned freelancer can run review." });
          return;
        }
        const submission = job.submissions[0];
        if (!submission) {
          send("error", { message: "There is no submitted delivery." });
          return;
        }
        if (submission.verification) {
          send("error", { message: "This submission was already reviewed. Submit again before reviewing." });
          return;
        }
        if (job.status !== "SUBMITTED" && job.status !== "VERIFYING") {
          send("error", { message: "Only a submitted job can be reviewed." });
          return;
        }

        const locked = await prisma.job.updateMany({
          where: { id, status: { in: ["SUBMITTED", "VERIFYING"] } },
          data: { status: "VERIFYING" },
        });
        if (locked.count === 0) {
          send("error", { message: "The job is not in a state where review can start." });
          return;
        }
        await addEvent(id, "VERIFYING", { submissionId: submission.id });
        send("log", { message: "Starting review. Opening the page and checking it against the acceptance criteria." });

        const outcome = await runVerification({
          criteria: job.criteria.map((criterion) => ({ id: criterion.id, label: criterion.label })),
          deliveryUrl: submission.deliveryUrl,
          brief: job.brief,
          onLog: (message) => send("log", { message }),
        });

        await prisma.verification.create({
          data: {
            submissionId: submission.id,
            status: outcome.status,
            summary: outcome.summary,
            rawAgentTrace: outcome.trace,
            results: {
              create: outcome.results.map((result) => ({
                criterionId: result.criterionId,
                verdict: result.verdict,
                evidence: result.evidence,
                confidence: result.confidence,
              })),
            },
          },
        });

        if (outcome.status === "FAIL") {
          await prisma.job.update({ where: { id }, data: { status: "FAILED" } });
          await addEvent(id, "FAILED", { submissionId: submission.id });
          send("log", { message: "Revision is required. The authorization hold stays in place. Capture is not called." });
          send("done", { status: "FAILED", summary: outcome.summary });
          return;
        }

        await prisma.job.update({ where: { id }, data: { status: "PASSED" } });
        await addEvent(id, "PASSED", { submissionId: submission.id });
        send("log", { message: "Every criterion passed. The server attempts capture." });
        try {
          await captureJob(job, { onLog: (message) => send("log", { message }) });
          send("log", { message: "Capture completed and the job is paid." });
          send("done", { status: "PAID", summary: outcome.summary });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Capture failed.";
          send("log", { message: `Capture failed. The job stays in the passed state. ${message}` });
          send("done", { status: "PASSED", summary: outcome.summary, captureError: message });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Review failed.";
        await prisma.job
          .updateMany({ where: { id, status: "VERIFYING" }, data: { status: "SUBMITTED" } })
          .catch(() => undefined);
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
