import type { Metadata } from "next";
import { TopicsSection } from "@/features/vzdelavani/components/TopicsSection";
import { requireUser } from "@/server/auth/session";
import { currentPreview } from "@/server/services/preview-context";
import { ShotGrant } from "@/components/feedback/ShotGrant";

export const metadata: Metadata = { title: "Témata" };

export default async function TopicsPage({ searchParams }: { searchParams: Promise<{ filtr?: string }> }) {
  const user = await requireUser();
  // V náhledu (lišta Pohled) se témata ukážou očima skupiny nebo kolegy a bez ovládání.
  const [preview, params] = await Promise.all([currentPreview(user), searchParams]);
  return (
    <>
      <ShotGrant page="/vzdelavani/temata" />
      <TopicsSection user={preview?.viewer ?? user} readOnly={Boolean(preview)} filter={params.filtr} />
    </>
  );
}
