"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { appPath } from "@/lib/base-path";

const starterCriteria = [
  "The hero shows the product name and a call-to-action button",
  "A pricing section lists 3 plans",
  "The call-to-action stays visible at a mobile width",
  "The page includes a contact form",
];

export function NewJobForm() {
  const router = useRouter();
  const due = new Date();
  due.setDate(due.getDate() + 3);
  const dueValue = due.toISOString().slice(0, 16);
  const [title, setTitle] = useState("Landing page redesign");
  const [budget, setBudget] = useState("150");
  const [dueAt, setDueAt] = useState(dueValue);
  const [brief, setBrief] = useState(
    "Rebuild the Sori practice-room landing page. It needs the product name and a CTA, three pricing plans, a button that stays visible on mobile, and a contact form.",
  );
  const [criteria, setCriteria] = useState(starterCriteria);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const dollars = Number(budget);
    const response = await fetch(appPath("/api/jobs"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        brief,
        currency: "USD",
        dueAt: new Date(dueAt).toISOString(),
        budgetCents: Math.round(dollars * 100),
        criteria,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Could not create the job.");
      return;
    }
    router.push(`/jobs/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="sheet mt-6 grid max-w-2xl gap-4 p-6">
      <label className="grid gap-2">
        Title
        <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <label className="grid gap-2">
        Budget (USD)
        <input className="field" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} required />
      </label>
      <label className="grid gap-2">
        Due
        <input className="field" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required />
      </label>
      <label className="grid gap-2">
        Brief
        <textarea className="field min-h-32" value={brief} onChange={(event) => setBrief(event.target.value)} required />
      </label>
      <fieldset className="grid gap-3">
        <legend>Acceptance criteria</legend>
        {criteria.map((criterion, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              className="field min-w-0 flex-1"
              value={criterion}
              aria-label={`Acceptance criterion ${index + 1}`}
              onChange={(event) => {
                const next = [...criteria];
                next[index] = event.target.value;
                setCriteria(next);
              }}
            />
            <button
              type="button"
              className="btn-quiet shrink-0"
              onClick={() => setCriteria(criteria.filter((_, item) => item !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-quiet w-fit" onClick={() => setCriteria([...criteria, ""])}>
          Add criterion
        </button>
      </fieldset>
      {error ? <p className="text-sm text-fail">{error}</p> : null}
      <button className="btn w-fit" disabled={pending} type="submit">
        {pending ? "Creating" : "Create job"}
      </button>
    </form>
  );
}
