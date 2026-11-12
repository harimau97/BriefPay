import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JobWorkspace } from "@/components/JobWorkspace";
import { getViewer } from "@/lib/auth";
import { serializeJob } from "@/lib/dto";
import { appBaseUrl } from "@/lib/format";
import { getJob } from "@/lib/jobs";
import { paypalMockEnabled } from "@/lib/paypal";

export const instant = false;

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Loading job</p>}>
      <JobScreen params={params} />
    </Suspense>
  );
}

async function JobScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, viewer] = await Promise.all([getJob(id), getViewer()]);
  if (!job) notFound();
  const base = appBaseUrl();
  return (
    <JobWorkspace
      job={serializeJob(job)}
      viewer={viewer}
      paypalClientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || null}
      mock={paypalMockEnabled()}
      passUrl={`${base}/demo/pass`}
      failUrl={`${base}/demo/fail`}
    />
  );
}
