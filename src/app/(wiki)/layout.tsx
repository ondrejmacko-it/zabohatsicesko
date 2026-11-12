import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { listPersonas } from "@/server/auth/personas";
import { requireUser } from "@/server/auth/session";
import { pendingTaskCount } from "@/server/services/overview";

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [personas, badge] = await Promise.all([listPersonas(), pendingTaskCount(user)]);
  return (
    <>
      <Topbar user={user} personas={personas} />
      <div className="shell">
        <Sidebar badge={badge} />
        <main className="panel" id="obsah">
          {children}
        </main>
      </div>
    </>
  );
}
