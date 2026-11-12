import type { JobDTO } from "@/lib/dto";

const verdictLabel: Record<string, string> = {
  PASS: "Pass",
  FAIL: "Fail",
  UNSURE: "Unsure",
};

const verdictTone: Record<string, string> = {
  PASS: "badge badge-success",
  FAIL: "badge badge-error",
  UNSURE: "badge badge-warning",
};

export function VerificationReport({ job }: { job: JobDTO }) {
  const submission = job.submissions[0];
  const verification = submission?.verification;
  if (!submission) return null;
  return (
    <section className="mt-8 border-t border-line pt-8">
      <h2 className="section-title">Review</h2>
      <p className="mt-2 break-all leading-6 text-muted">
        Delivery URL {submission.deliveryUrl}
        {submission.notes ? ` · ${submission.notes}` : ""}
      </p>
      {!verification ? (
        <p className="mt-4 text-muted">This submission has not been reviewed yet.</p>
      ) : (
        <>
          <p className={`mt-4 ${verification.status === "PASS" ? "callout callout-success" : "callout callout-error"}`}>
            {verification.status === "PASS" ? "Passed overall" : "Failed overall"} · {verification.summary}
          </p>
          <div className="mt-4 overflow-x-auto rounded-[12px] border border-line">
            <table className="w-full border-collapse text-left">
              <thead className="bg-paper text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Criterion</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Verdict</th>
                  <th className="px-3 py-2 font-medium">Evidence</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {job.criteria.map((criterion) => {
                  const result = verification.results.find((item) => item.criterionId === criterion.id);
                  const verdict = result?.verdict || "";
                  return (
                    <tr key={criterion.id} className="border-t border-line align-top">
                      <td className="px-3 py-3">{criterion.label}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={verdictTone[verdict] || "badge"}>{verdictLabel[verdict] || verdict || "None"}</span>
                      </td>
                      <td className="px-3 py-3 leading-6 text-muted">{result?.evidence || "No evidence"}</td>
                      <td className="whitespace-nowrap px-3 py-3">{result ? Math.round(result.confidence * 100) + "%" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {verification.status === "FAIL" ? (
            <div className="callout callout-error mt-4">
              <h3 className="font-semibold">Revision requested</h3>
              <p className="mt-1 leading-6">
                Fix the failed criteria, then submit a URL on this job again. The funds stay on the authorization hold until then.
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
