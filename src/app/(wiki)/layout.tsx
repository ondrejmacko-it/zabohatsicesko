import { isLiveWiki } from "@/server/config";
import { FeedbackRoot } from "@/components/feedback/FeedbackRoot";
import { FlashMessage } from "@/components/FlashMessage";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { listPersonas } from "@/server/auth/personas";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { PreviewBar } from "@/components/PreviewSwitch";
import { canManageUsers, isOrganizer } from "@/server/policy";
import { listPreviewOptions } from "@/server/services/preview";
import { currentPreview } from "@/server/services/preview-context";
import { pendingTaskCount } from "@/server/services/overview";
import { pendingRequestCount } from "@/server/services/users";

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await getDb();
  const organizer = isOrganizer(user);
  const [personas, badge, pendingRequests, options, preview] = await Promise.all([
    listPersonas(),
    pendingTaskCount(user),
    pendingRequestCount(db, user),
    organizer ? listPreviewOptions(user) : null,
    currentPreview(user),
  ]);
  return (
    <>
      <Topbar user={user} personas={personas} preview={options && { ...options, active: preview?.key ?? null }} />
      {preview && <PreviewBar label={preview.label} />}
      <div className="shell">
        {/* V náhledu navigace odpovídá pohledu, který se ukazuje: poradce Správu systému nevidí (F16). Stránka /sprava
            sama dál používá skutečný účet, náhled ji neotevírá ani nezavírá. */}
        <Sidebar badge={badge} canManageUsers={canManageUsers(preview?.viewer ?? user)} pendingRequests={pendingRequests} live={isLiveWiki()} />
        <main className="panel" id="obsah">
          <FlashMessage />
          {children}
        </main>
      </div>
      <FeedbackRoot />
    </>
  );
}
