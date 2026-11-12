import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { listPersonas } from "@/server/auth/personas";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { canManageUsers } from "@/server/policy";
import { pendingTaskCount } from "@/server/services/overview";
import { pendingRequestCount } from "@/server/services/users";

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await getDb();
  const [personas, badge, pendingRequests] = await Promise.all([
    listPersonas(),
    pendingTaskCount(user),
    pendingRequestCount(db, user),
  ]);
  return (
    <>
      <Topbar user={user} personas={personas} />
      <div className="shell">
        <Sidebar badge={badge} canManageUsers={canManageUsers(user)} pendingRequests={pendingRequests} />
        <main className="panel" id="obsah">
          {children}
        </main>
      </div>
    </>
  );
}
