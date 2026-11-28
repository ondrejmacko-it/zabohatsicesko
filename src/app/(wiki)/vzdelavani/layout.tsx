import { SubNav } from "@/features/vzdelavani/components/SubNav";
import { requireUser } from "@/server/auth/session";
import { attendanceScope } from "@/server/services/attendance";
import { currentPreview } from "@/server/services/preview-context";

export default async function EducationLayout({ children }: { children: React.ReactNode }) {
  // Odkaz na Účast jen pro toho, komu ji stránka i ukáže (správce, určený nadřízený, mimo náhled).
  const user = await requireUser();
  const showAttendance = (await attendanceScope(user, Boolean(await currentPreview(user)))) !== null;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Vzdělávání</h1>
        </div>
      </div>
      <SubNav showAttendance={showAttendance} />
      <div className="education-content">{children}</div>
    </>
  );
}
