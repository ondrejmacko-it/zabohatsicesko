import { ModeStrip } from "@/features/vzdelavani/components/ModeStrip";
import { SubNav } from "@/features/vzdelavani/components/SubNav";
import { requireUser } from "@/server/auth/session";
import { isOrganizer } from "@/server/policy";

export default async function EducationLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Vzdělávání</h1>
          <p className="page-sub">Plán vzdělávání týmu, témata a zápisy z proběhlých akcí na jednom místě.</p>
        </div>
        <ModeStrip />
      </div>
      <SubNav showIntegrations={isOrganizer(user)} />
      <div className="education-content">{children}</div>
    </>
  );
}
