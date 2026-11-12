"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { appPath } from "@/lib/base-path";
import { notifyRoleChange } from "@/lib/notify";

type Viewer = { id: string; name: string; email: string; role: "CLIENT" | "FREELANCER" } | null;

export function RoleSwitch() {
  const router = useRouter();
  const [viewer, setViewer] = useState<Viewer>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    const load = () => {
      fetch(appPath("/api/me"))
        .then((response) => response.json())
        .then((data) => {
          if (!cancel) setViewer(data.user ?? null);
        })
        .catch(() => {
          if (!cancel) setViewer(null);
        });
    };
    load();
    window.addEventListener("briefpay-role", load);
    return () => {
      cancel = true;
      window.removeEventListener("briefpay-role", load);
    };
  }, []);

  async function choose(role: "CLIENT" | "FREELANCER") {
    setPending(role);
    const response = await fetch(appPath("/api/demo/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setPending(null);
    if (!response.ok) return;
    const data = await response.json();
    setViewer(data.user);
    notifyRoleChange();
    router.refresh();
  }

  const roleLabel = viewer?.role === "CLIENT" ? "Client" : viewer?.role === "FREELANCER" ? "Freelancer" : "Signed out";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted">{viewer ? viewer.name : roleLabel}</span>
      <div className="segment" role="group" aria-label="Switch role">
        <button
          type="button"
          aria-pressed={viewer?.role === "CLIENT"}
          disabled={pending !== null}
          onClick={() => choose("CLIENT")}
        >
          {pending === "CLIENT" ? "Switching" : "Client"}
        </button>
        <button
          type="button"
          aria-pressed={viewer?.role === "FREELANCER"}
          disabled={pending !== null}
          onClick={() => choose("FREELANCER")}
        >
          {pending === "FREELANCER" ? "Switching" : "Freelancer"}
        </button>
      </div>
    </div>
  );
}
