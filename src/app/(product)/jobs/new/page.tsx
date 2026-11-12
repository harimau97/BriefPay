import { Suspense } from "react";
import { NewJobForm } from "@/components/NewJobForm";
import { getViewer } from "@/lib/auth";

export const instant = false;

export default function NewJobPage() {
  return (
    <Suspense fallback={<p>Checking role</p>}>
      <NewJobScreen />
    </Suspense>
  );
}

async function NewJobScreen() {
  const viewer = await getViewer();
  return (
    <main>
      <h1 className="page-title">New job</h1>
      <p className="mt-2 max-w-2xl leading-6 text-muted">
        The budget is placed on a PayPal authorization hold later. This screen does not charge anything.
      </p>
      {viewer?.role !== "CLIENT" ? (
        <p className="sheet mt-6 max-w-2xl p-6">Switch to the client role above before creating a job.</p>
      ) : (
        <NewJobForm />
      )}
    </main>
  );
}
