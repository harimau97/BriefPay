import { prisma } from "@/lib/db";
import { readSession, type SessionRole } from "@/lib/session";

export type Viewer = {
  id: string;
  email: string;
  name: string;
  role: SessionRole;
};

export async function getViewer(): Promise<Viewer | null> {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;
  if (user.role !== session.role) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
