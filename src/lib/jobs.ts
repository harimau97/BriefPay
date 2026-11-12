import { prisma, jobInclude } from "@/lib/db";

export async function getJob(id: string) {
  return prisma.job.findUnique({ where: { id }, include: jobInclude });
}

export type JobRecord = NonNullable<Awaited<ReturnType<typeof getJob>>>;

type EventWriter = {
  jobEvent: {
    create: (args: { data: { jobId: string; type: string; payload: string } }) => Promise<unknown>;
  };
};

export async function addEvent(
  jobId: string,
  type: string,
  payload: Record<string, unknown> = {},
  db: EventWriter = prisma,
) {
  await db.jobEvent.create({
    data: { jobId, type, payload: JSON.stringify(payload) },
  });
}
