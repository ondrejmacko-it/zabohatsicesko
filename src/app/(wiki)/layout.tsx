import { isLiveWiki, salutationsEnabled } from "@/server/config";
import { getSalutation } from "@/server/services/salutation";
import { loadPersonalCalendar } from "@/server/services/calendar-status";
import { FeedbackRoot } from "@/components/feedback/FeedbackRoot";
import { FlashMessage } from "@/components/FlashMessage";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { listPersonas } from "@/server/auth/personas";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { PreviewBar } from "@/components/PreviewSwitch";
import { PreviewLockProvider } from "@/components/PreviewLock";
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
  // Oslovení je nastavení skutečného účtu, proto je v menu Účet; v náhledu se nenabízí (nic se tam neukládá).
  const salutation = salutationsEnabled() && !preview ? { current: await getSalutation(user.id) } : null;
  // Stejně tak propojení Kalendáře: patří skutečnému účtu, v náhledu kolegy by ukazovalo cizí stav.
  const calendar = preview ? null : await loadPersonalCalendar(user);
  return (
    <>
      <Topbar user={user} personas={personas} inPreview={Boolean(preview)} salutation={salutation} calendar={calendar} preview={options && { ...options, active: preview?.key ?? null }} />
      {preview && <PreviewBar label={preview.label} />}
      <div className="shell">
        {/* V náhledu navigace odpovídá pohledu, který se ukazuje: poradce Správu systému nevidí (F16). Stránka /sprava
            sama dál používá skutečný účet, náhled ji neotevírá ani nezavírá. */}
        <Sidebar badge={badge} canManageUsers={canManageUsers(preview?.viewer ?? user)} pendingRequests={pendingRequests} live={isLiveWiki()} />
        <main className="panel" id="obsah">
          <FlashMessage />
          <PreviewLockProvider active={Boolean(preview)}>{children}</PreviewLockProvider>
        </main>
      </div>
      <FeedbackRoot />
    </>
  );
}
