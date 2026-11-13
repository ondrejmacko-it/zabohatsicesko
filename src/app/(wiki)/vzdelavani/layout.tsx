import { SubNav } from "@/features/vzdelavani/components/SubNav";

export default function EducationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Vzdělávání</h1>
          <p className="page-sub">Plán vzdělávání týmu, témata a zápisy z proběhlých akcí na jednom místě.</p>
        </div>
      </div>
      <SubNav />
      <div className="education-content">{children}</div>
    </>
  );
}
