import { SubNav } from "@/features/vzdelavani/components/SubNav";

export default function EducationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Vzdělávání</h1>
        </div>
      </div>
      <SubNav />
      <div className="education-content">{children}</div>
    </>
  );
}
