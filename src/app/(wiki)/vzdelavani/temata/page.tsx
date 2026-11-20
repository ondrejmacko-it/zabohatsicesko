import type { Metadata } from "next";
import { TopicsSection } from "@/features/vzdelavani/components/TopicsSection";
import { requireUser } from "@/server/auth/session";
import { currentPreview } from "@/server/services/preview-context";

export const metadata: Metadata = { title: "Témata" };

export default async function TopicsPage() {
  const user = await requireUser();
  // V náhledu (lišta Pohled) se témata ukážou očima skupiny nebo kolegy a bez ovládání.
  const preview = await currentPreview(user);
  return <TopicsSection user={preview?.viewer ?? user} readOnly={Boolean(preview)} />;
}
