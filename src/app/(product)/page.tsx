import Link from "next/link";
import { Suspense } from "react";
import { DemoStart } from "@/components/DemoStart";
import { StatusBadge } from "@/components/StatusBadge";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const instant = false;

const steps = [
  ["Authorization hold", "Checkout uses authorize. The balance is not a final payout yet."],
  ["Page review", "The agent opens the delivery URL and records evidence for each criterion."],
  ["Capture or hold", "If every criterion passes, the server captures. If any fails, the hold stays and a revision request goes out."],
];

export default function HomePage() {
  return (
    <main>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="pt-2">
          <h1 className="max-w-xl text-[2.1875rem] font-semibold leading-[1.25] tracking-[-0.02em] text-ink sm:text-[2.625rem]">
            Payment waits
            <br />
            until the work matches the brief.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            The client authorizes the amount with PayPal. When the freelancer submits a URL, an agent opens the page
            and checks it against the acceptance criteria. Nothing is captured before it passes.
          </p>
          <DemoStart />
        </div>
        <aside className="sheet p-6">
          <p className="text-muted">Sample slip</p>
          <p className="mt-4 text-[2rem] font-semibold leading-none tracking-tight">USD 150.00</p>
          <p className="mt-3">
            <span className="badge badge-warning">Authorized, not captured</span>
          </p>
          <p className="mt-4 leading-6 text-muted">
            Landing page redesign. This amount is captured only after the hero CTA, three plans, the mobile check, and a contact form all pass.
          </p>
          <Suspense fallback={<p className="mt-6 text-muted">Loading jobs</p>}>
            <HomeJobs />
          </Suspense>
        </aside>
      </div>
      <section className="sheet mt-6 divide-y divide-line">
        {steps.map(([title, body]) => (
          <div key={title} className="grid gap-1 px-5 py-4 sm:grid-cols-[9.5rem_1fr] sm:items-baseline sm:gap-6 sm:px-6">
            <h2 className="font-semibold">{title}</h2>
            <p className="leading-6 text-muted">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

async function HomeJobs() {
  const viewer = await getViewer();
  const jobs = await prisma.job.findMany({ orderBy: { updatedAt: "desc" }, take: 4, include: { client: true } });
  if (jobs.length === 0) {
    return <p className="mt-6">No jobs yet.</p>;
  }
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="text-muted">{viewer ? `Recent jobs for ${viewer.name}` : "Recent jobs"}</p>
      <ul className="mt-2 divide-y divide-line">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link href={`/jobs/${job.id}`} className="row-link flex items-center justify-between gap-3 py-3">
              <span>
                <span className="block font-medium">{job.title}</span>
                <span className="mt-0.5 block text-muted">{formatMoney(job.budgetCents, job.currency)}</span>
              </span>
              <StatusBadge status={job.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
