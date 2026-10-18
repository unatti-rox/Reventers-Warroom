import { Sidebar, MobileNav } from "@/components/Nav";
import { requireUser, ROLE_LABEL } from "@/lib/auth";

// Every page here reads the signed-in user, so all of them render live on each request.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const navUser = {
    name: user.name,
    roleLabel: ROLE_LABEL[user.appRole],
    isAdmin: user.isAdmin,
    isIpcs: user.ipcsIpIds.length > 0,
    isCohortLeader: user.cohortIds.length > 0,
  };
  return (
    <div className="flex min-h-screen">
      <Sidebar user={navUser} />
      <main className="flex-1 min-w-0">
        <MobileNav user={navUser} />
        <div className="mx-auto max-w-[1500px] px-4 py-5 md:px-8 md:py-7">{children}</div>
      </main>
    </div>
  );
}
