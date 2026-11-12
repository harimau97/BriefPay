"use client";

import { useEffect, useRef, useState } from "react";
import { appPath } from "@/lib/base-path";
import { formatWhen } from "@/lib/format";

type TimelinePayload = {
  resources: { id: string; name: string }[];
  events: {
    id: string;
    resourceId: string;
    name: string;
    startDate: string;
    endDate: string;
    eventColor: string;
  }[];
  startDate: string;
  endDate: string;
};

type SchedulerInstance = { destroy?: () => void };

type SchedulerNamespace = {
  Scheduler?: new (config: Record<string, unknown>) => SchedulerInstance;
  LocaleManager?: { applyLocale?: (name: string) => Promise<unknown> | unknown };
};

function schedulerNamespace() {
  return (globalThis as { bryntum?: { scheduler?: SchedulerNamespace } }).bryntum?.scheduler;
}

function ensureCss(href: string) {
  if (document.querySelector(`link[data-briefpay-bryntum="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-briefpay-bryntum", href);
  document.head.appendChild(link);
}

function loadScript(src: string) {
  const existing = document.querySelector(`script[data-briefpay-bryntum="${src}"]`);
  if (existing?.getAttribute("data-loaded") === "1") return Promise.resolve();
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(src)), { once: true });
    });
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.setAttribute("data-briefpay-bryntum", src);
    script.onload = () => {
      script.setAttribute("data-loaded", "1");
      resolve();
    };
    script.onerror = () => reject(new Error(src));
    document.head.appendChild(script);
  });
}

let assetsPromise: Promise<void> | null = null;

function loadBryntumAssets() {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      ensureCss(appPath("/bryntum/scheduler.css"));
      ensureCss(appPath("/bryntum/stockholm-light.css"));
      await loadScript(appPath("/bryntum/scheduler.umd.js"));
      const namespace = schedulerNamespace();
      if (!namespace?.Scheduler) throw new Error("Could not find the Scheduler constructor.");
    })().catch((error) => {
      assetsPromise = null;
      throw error;
    });
  }
  return assetsPromise;
}

export default function JobTimeline({ jobId, version }: { jobId: string; version: string }) {
  const [data, setData] = useState<TimelinePayload | null>(null);
  const [error, setError] = useState("");
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancel = false;
    fetch(appPath(`/api/jobs/${jobId}/timeline`))
      .then((response) => response.json())
      .then((payload) => {
        if (!cancel) setData(payload);
      })
      .catch(() => {
        if (!cancel) setError("Could not load the timeline data.");
      });
    return () => {
      cancel = true;
    };
  }, [jobId, version]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !data) return;
    let cancel = false;
    let widget: SchedulerInstance | null = null;

    loadBryntumAssets()
      .then(() => {
        if (cancel) return;
        const Scheduler = schedulerNamespace()?.Scheduler;
        if (!Scheduler) throw new Error("Could not find the Scheduler constructor.");
        host.replaceChildren();
        const rowHeight = 46;
        widget = new Scheduler({
          appendTo: host,
          height: Math.max(220, data.events.length * rowHeight + 78),
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          viewPreset: "hourAndDay",
          rowHeight,
          barMargin: 4,
          readOnly: true,
          autoCreate: false,
          zoomOnMouseWheel: false,
          features: {
            eventDrag: false,
            eventResize: false,
            eventEdit: false,
            eventDragCreate: false,
            eventMenu: false,
            scheduleMenu: false,
          },
          columns: [{ text: "Record", field: "name", width: 160 }],
          eventRenderer: () => "",
          resources: data.resources,
          events: data.events.map((event) => ({
            ...event,
            startDate: new Date(event.startDate),
            endDate: new Date(event.endDate),
          })),
        });
      })
      .catch(() => {
        if (!cancel) setError("Could not load the timeline chart. The record below is still available.");
      });

    return () => {
      cancel = true;
      widget?.destroy?.();
      host.replaceChildren();
    };
  }, [data]);

  return (
    <div>
      {error ? <p className="text-sm text-fail">{error}</p> : null}
      <div ref={hostRef} className="overflow-hidden rounded-[12px] border border-line bg-white" />
      {!data && !error ? <p className="text-sm text-muted">Preparing the timeline</p> : null}
      {data ? (
        <ol className="mt-4 space-y-2 text-sm">
          {data.events.map((event) => (
            <li key={event.id}>
              {formatWhen(event.startDate)} · {event.name}
            </li>
          ))}
          {data.events.length === 0 ? <li>No records yet.</li> : null}
        </ol>
      ) : null}
    </div>
  );
}
