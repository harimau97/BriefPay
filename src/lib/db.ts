import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export const jobInclude = {
  criteria: { orderBy: { sortOrder: "asc" as const } },
  submissions: {
    orderBy: { createdAt: "desc" as const },
    include: {
      verification: { include: { results: true } },
    },
  },
  events: { orderBy: { at: "asc" as const } },
  client: true,
  freelancer: true,
};
