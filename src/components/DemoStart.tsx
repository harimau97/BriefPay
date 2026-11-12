"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { appPath } from "@/lib/base-path";
import { notifyRoleChange } from "@/lib/notify";

export function DemoStart() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function start(role: "CLIENT" | "FREELANCER") {
    setPending(role);
    setError("");
    const response = await fetch(appPath("/api/demo/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setPending(null);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Sign-in failed. Check that the database seed has been run.");
      return;
    }
    notifyRoleChange();
    router.push("/jobs");
    router.refresh();
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn" disabled={pending !== null} onClick={() => start("CLIENT")}>
          {pending === "CLIENT" ? "Signing in" : "Start as client"}
        </button>
        <button type="button" className="btn-quiet" disabled={pending !== null} onClick={() => start("FREELANCER")}>
          {pending === "FREELANCER" ? "Signing in" : "Start as freelancer"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-fail">{error}</p> : null}
    </div>
  );
}
