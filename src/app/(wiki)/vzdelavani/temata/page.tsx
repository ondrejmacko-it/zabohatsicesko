import type { Metadata } from "next";
import { TopicsSection } from "@/features/vzdelavani/components/TopicsSection";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Témata" };

export default async function TopicsPage() {
  const user = await requireUser();
  return <TopicsSection user={user} />;
}
