import type { FeedbackShotPage } from "@/lib/feedback";
import { getCurrentUser } from "@/server/auth/session";
import { config } from "@/server/config";
import { issueShotGrant } from "@/server/feedback-grant";

/**
 * Serverová značka „na této stránce smí zpětná vazba nabídnout snímek“. Vkládá se jen do stránek ověřených
 * pro snímek (`FEEDBACK_SHOT_PAGES`). Okno zpětné vazby snímek nabídne, jen když značku na stránce najde.
 */
export async function ShotGrant({ page }: { page: FeedbackShotPage }) {
  const user = await getCurrentUser();
  if (!user) return null;
  return <span hidden data-feedback-shot-grant={issueShotGrant(config.sessionSecret, user.id, page)} />;
}
