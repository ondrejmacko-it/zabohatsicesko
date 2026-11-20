"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { getCurrentUser } from "@/server/auth/session";
import { config, feedbackWebhook, wikiMode } from "@/server/config";
import { getDb } from "@/server/db/client";
import { submitFeedbackCore } from "@/server/feedback";
import { currentPreview } from "@/server/services/preview-context";
import type { FeedbackResult } from "@/lib/feedback";

/**
 * Odeslání zpětné vazby z broučka. Prohlížeč zná jen tuto akci. Adresa webhooku Make.com a tajemství zůstávají
 * na serveru. Kdo hlášení posílá, roli a aktivní „Pohled“ doplní server z ověřené session, klientu v nich nevěří.
 */
export async function submitFeedback(formData: FormData): Promise<FeedbackResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthorized" };
  const [headerStore, preview] = await Promise.all([headers(), currentPreview(user)]);
  const screenshot = formData.get("screenshot");
  return submitFeedbackCore(
    {
      draftJson: formData.get("draft"),
      screenshot: screenshot instanceof Blob && screenshot.size > 0 ? screenshot : null,
      screenshotGrant: formData.get("screenshotGrant"),
      facts: {
        id: randomUUID(),
        createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        // Veřejná proměnná Vercelu s commitem nasazení. Mimo Vercel není.
        appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        userAgent: headerStore.get("user-agent")?.slice(0, 300) ?? null,
        wikiMode: wikiMode(),
        reporter: { userId: user.id, role: user.role, signedInWith: user.signedInWith },
        preview: preview ? { key: preview.key, label: preview.label } : null,
      },
    },
    { db: await getDb(), webhook: feedbackWebhook(), fetchImpl: fetch, grantSecret: config.sessionSecret },
  );
}
