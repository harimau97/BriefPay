import { EVENT_COLOR, EVENT_LABEL } from "@/lib/format";

export type TimelineEvent = {
  id: string;
  type: string;
  at: Date | string;
};

export function buildTimeline(input: { title: string; events: TimelineEvent[] }) {
  const stamps = input.events.map((event) => new Date(event.at).getTime()).filter((n) => !Number.isNaN(n));
  const now = Date.now();
  const min = stamps.length ? Math.min(...stamps) : now;
  const max = stamps.length ? Math.max(...stamps) : now;
  const startDate = new Date(min - 40 * 60 * 1000);
  const endDate = new Date(Math.max(max + 100 * 60 * 1000, startDate.getTime() + 3 * 60 * 60 * 1000));

  return {
    resources: input.events.map((event) => ({
      id: event.id,
      name: EVENT_LABEL[event.type] || event.type,
    })),
    events: input.events.map((event) => {
      const start = new Date(event.at);
      const end = new Date(start.getTime() + 18 * 60 * 1000);
      return {
        id: event.id,
        resourceId: event.id,
        name: EVENT_LABEL[event.type] || event.type,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        eventColor: EVENT_COLOR[event.type] || "blue",
      };
    }),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}
