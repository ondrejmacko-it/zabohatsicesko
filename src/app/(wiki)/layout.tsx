import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { listPersonas } from "@/server/auth/personas";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { canManageUsers } from "@/server/policy";
import { PublishUndoBar } from "@/features/vzdelavani/components/PublishUndoBar";
import { listUndoable } from "@/server/services/events";
import { pendingTaskCount } from "@/server/services/overview";
import { pendingRequestCount } from "@/server/services/users";

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await getDb();
  const [personas, badge, pendingRequests, undoable] = await Promise.all([
    listPersonas(),
    pendingTaskCount(user),
    pendingRequestCount(db, user),
    listUndoable(user),
  ]);
  return (
    <>
      <Topbar user={user} personas={personas} />
      <div className="shell">
        <Sidebar badge={badge} canManageUsers={canManageUsers(user)} pendingRequests={pendingRequests} />
        <main className="panel" id="obsah">
          {user.signedInWith === "code" && (
            <p className="notice" role="status">
              Jste přihlášeni jednorázovým kódem. Pozvánky na akce chodí na adresu {user.email}. Pokud tam nechodí, dejte
              správci vědět správný e-mail. S účtem Google se příště přihlásíte bez kódu.
            </p>
          )}
          {children}
        </main>
      </div>
      <PublishUndoBar items={undoable} />
    </>
  );
}
