"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JobDTO } from "@/lib/dto";
import type { Viewer } from "@/lib/auth";
import { appPath } from "@/lib/base-path";
import { formatMoney, formatWhen } from "@/lib/format";
import { PayPalFundButton } from "@/components/PayPalFundButton";
import { StatusBadge } from "@/components/StatusBadge";
import { VerificationReport } from "@/components/VerificationReport";

const JobTimeline = dynamic(() => import("@/components/JobTimeline"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted">Loading the timeline</p>,
});

export function JobWorkspace({
  job,
  viewer,
  paypalClientId,
  mock,
  passUrl,
  failUrl,
}: {
  job: JobDTO;
  viewer: Viewer | null;
  paypalClientId: string | null;
  mock: boolean;
  passUrl: string;
  failUrl: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [deliveryUrl, setDeliveryUrl] = useState(passUrl);
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState<"void" | "force" | null>(null);
  const isClient = viewer?.role === "CLIENT" && viewer.id === job.client.id;
  const isFreelancer = viewer?.role === "FREELANCER" && (job.freelancer?.id === viewer.id || job.status === "FUNDED");

  async function post(path: string, body?: unknown) {
    const response = await fetch(appPath(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  async function run(name: string, action: () => Promise<void>) {
    setPending(name);
    setError("");
    try {
      await action();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setPending("");
    }
  }

  async function verify() {
    setPending("verify");
    setError("");
    setLogs(["Verification requested."]);
    try {
      const response = await fetch(appPath(`/api/jobs/${job.id}/verify`), { method: "POST" });
      if (!response.body) throw new Error("Did not receive the verification log.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const eventName = chunk
            .split("\n")
            .find((line) => line.startsWith("event:"))
            ?.slice(6)
            .trim();
          const dataText = chunk
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("\n");
          if (!dataText) continue;
          const data = JSON.parse(dataText) as { message?: string };
          if (eventName === "log" && data.message) setLogs((current) => [...current, data.message as string]);
          if (eventName === "error") throw new Error(data.message || "Verification failed.");
        }
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Verification failed.");
    } finally {
      setPending("");
    }
  }

  return (
    <div>
      <article className="sheet p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title">{job.title}</h1>
            <p className="mt-3 text-[1.5rem] font-semibold tracking-tight">{formatMoney(job.budgetCents, job.currency)}</p>
            <p className="mt-2 text-muted">Due {formatWhen(job.dueAt)} · Client {job.client.name}</p>
            {job.freelancer ? <p className="text-muted">Freelancer {job.freelancer.name}</p> : null}
          </div>
          <StatusBadge status={job.status} />
        </div>

        <div className="mt-5 grid gap-3">
          {job.status === "FUNDED" || job.status === "IN_PROGRESS" || job.status === "SUBMITTED" || job.status === "VERIFYING" || job.status === "FAILED" || job.status === "PASSED" ? (
            <p className="callout callout-warning">
              Authorization hold. Capture ID {job.paypalCaptureId || "none"}. Authorization ID {job.paypalAuthorizationId || "none"}.
              The capture ID stays empty until this is a final payout.
            </p>
          ) : null}
          {job.status === "PAID" ? (
            <p className="callout callout-success">
              Capture completed. Capture ID {job.paypalCaptureId}.
              {job.paypalInvoiceId ? ` Receipt invoice ${job.paypalInvoiceId}.` : " No receipt invoice yet."}
            </p>
          ) : null}
          {job.status === "CANCELED" ? (
            <p className="callout callout-neutral">The authorization hold was released, or a captured payment was refunded.</p>
          ) : null}
          {mock && job.paypalAuthorizationId?.startsWith("MOCK-") ? (
            <p className="text-muted">This hold is a local simulation used when PayPal sandbox keys are missing.</p>
          ) : null}
        </div>

        <section className="mt-8">
          <h2 className="section-title">Brief</h2>
          <p className="mt-3 whitespace-pre-wrap leading-7">{job.brief}</p>
          <h2 className="section-title mt-6">Acceptance criteria</h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[8px] border border-line">
            {job.criteria.map((criterion) => (
              <li key={criterion.id} className="px-3 py-2.5">
                {criterion.label}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          {!viewer ? <p>Choose the client or freelancer role above to open the next step.</p> : null}
          {isClient && job.status === "DRAFT" ? (
            <PayPalFundButton jobId={job.id} clientId={paypalClientId} mock={mock} />
          ) : null}
          {isFreelancer && job.status === "FUNDED" ? (
            <button type="button" className="btn" disabled={pending !== ""} onClick={() => run("accept", () => post(`/api/jobs/${job.id}/accept`))}>
              {pending === "accept" ? "Accepting" : "Accept job"}
            </button>
          ) : null}
          {viewer?.role === "FREELANCER" && viewer.id === job.freelancer?.id && (job.status === "IN_PROGRESS" || job.status === "FAILED") ? (
            <form
              className="grid max-w-xl gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void run("submit", () => post(`/api/jobs/${job.id}/submit`, { deliveryUrl, notes }));
              }}
            >
              <label className="grid gap-2 text-sm">
                Delivery URL
                <input className="field" value={deliveryUrl} onChange={(event) => setDeliveryUrl(event.target.value)} required />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-quiet" onClick={() => setDeliveryUrl(passUrl)}>
                  Pass example
                </button>
                <button type="button" className="btn-quiet" onClick={() => setDeliveryUrl(failUrl)}>
                  Fail example
                </button>
              </div>
              <label className="grid gap-2 text-sm">
                Notes
                <textarea className="field min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
              <button className="btn w-fit" disabled={pending !== ""} type="submit">
                {pending === "submit" ? "Submitting" : "Submit delivery"}
              </button>
            </form>
          ) : null}
          {(isClient || viewer?.id === job.freelancer?.id) && (job.status === "SUBMITTED" || job.status === "VERIFYING") ? (
            <button type="button" className="btn" disabled={pending !== ""} onClick={() => void verify()}>
              {pending === "verify" ? "Verifying" : "Run AI review"}
            </button>
          ) : null}
          {logs.length > 0 ? (
            <ol className="mt-4 space-y-2 rounded-[8px] border border-line bg-paper p-4 leading-6" aria-live="polite">
              {logs.map((line, index) => (
                <li key={`${index}-${line}`}>{line}</li>
              ))}
            </ol>
          ) : null}
          {isClient && job.status === "PASSED" ? (
            <button type="button" className="btn mt-4" disabled={pending !== ""} onClick={() => run("capture", () => post(`/api/jobs/${job.id}/capture`))}>
              {pending === "capture" ? "Capturing" : "Confirm payout"}
            </button>
          ) : null}
          {isClient && job.status === "FAILED" ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {confirm === "force" ? (
                <button type="button" className="btn" disabled={pending !== ""} onClick={() => run("force", () => post(`/api/jobs/${job.id}/capture`, { force: true }))}>
                  Review failed. Capture the full amount
                </button>
              ) : (
                <button type="button" className="btn-quiet" onClick={() => setConfirm("force")}>
                  Force payout
                </button>
              )}
              {confirm === "void" ? (
                <button type="button" className="btn-danger" disabled={pending !== ""} onClick={() => run("void", () => post(`/api/jobs/${job.id}/void`))}>
                  Release the authorization hold
                </button>
              ) : (
                <button type="button" className="btn-danger" onClick={() => setConfirm("void")}>
                  Cancel job
                </button>
              )}
            </div>
          ) : null}
          {isClient && ["FUNDED", "IN_PROGRESS", "SUBMITTED", "PASSED"].includes(job.status) ? (
            <div className="mt-4">
              {confirm === "void" ? (
                <button type="button" className="btn-danger" disabled={pending !== ""} onClick={() => run("void", () => post(`/api/jobs/${job.id}/void`))}>
                  Release the authorization hold
                </button>
              ) : (
                <button type="button" className="btn-danger" onClick={() => setConfirm("void")}>
                  Cancel job
                </button>
              )}
            </div>
          ) : null}
          {error ? <p className="mt-4 text-sm text-fail">{error}</p> : null}
        </section>

        <VerificationReport job={job} />
      </article>

      <section className="sheet mt-6 p-4 sm:p-6">
        <h2 className="section-title">Milestones</h2>
        <p className="mt-1 mb-4 text-muted">Status history is shown on a Bryntum Scheduler timeline.</p>
        <JobTimeline jobId={job.id} version={`${job.status}-${job.events.length}`} />
      </section>
    </div>
  );
}
