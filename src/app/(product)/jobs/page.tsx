import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatWhen } from "@/lib/format";

export const instant = false;

export default function JobsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading jobs</p>}>
      <JobList />
    </Suspense>
  );
}

async function JobList() {
  const viewer = await getViewer();
  const jobs = await prisma.job.findMany({
    orderBy: { updatedAt: "desc" },
    include: { client: true, freelancer: true },
  });

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="mt-1 text-muted">
            {viewer ? `${viewer.name} · ${viewer.role === "CLIENT" ? "Client" : "Freelancer"}` : "Choose a role to work on a job."}
          </p>
        </div>
        {viewer?.role === "CLIENT" ? (
          <Link href="/jobs/new" className="btn">
            New job
          </Link>
        ) : null}
      </div>
      {jobs.length === 0 ? (
        <p className="sheet mt-6 p-6">No seeded jobs. Run `npx prisma db seed`.</p>
      ) : (
        <ul className="sheet mt-6 divide-y divide-line overflow-hidden">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/jobs/${job.id}`}
                className="row-link grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
              >
                <span>
                  <span className="block font-medium">{job.title}</span>
                  <span className="mt-0.5 block text-muted">
                    Client {job.client.name} · Due {formatWhen(job.dueAt)}
                  </span>
                </span>
                <span className="flex items-center gap-3 sm:justify-end">
                  <span className="font-medium">{formatMoney(job.budgetCents, job.currency)}</span>
                  <StatusBadge status={job.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
