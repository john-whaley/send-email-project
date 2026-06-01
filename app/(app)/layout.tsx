import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const pools = await prisma.pool.findMany({
    select: {
      id: true,
      name: true,
      slug: true
    },
    orderBy: { createdAt: "asc" }
  });

  return (
    <AppShell
      user={{
        username: user.username,
        role: user.role
      }}
      pools={pools}
    >
      {children}
    </AppShell>
  );
}
