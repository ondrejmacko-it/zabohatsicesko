"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { isOrganizer } from "@/server/policy";
import { resolvePreview } from "@/server/services/preview";
import {
  PREVIEW_COOKIE,
  encodePreviewCookie,
  expiredPreviewCookieOptions,
  previewCookieOptions,
} from "@/server/services/preview-context";

const keySchema = z.string().max(120);

/** Návrat na stránku, ze které správce přepnul pohled. Jen cesta téže Wiki, nikdy jiný web. */
async function backPath(): Promise<string> {
  const referer = (await headers()).get("referer");
  if (!referer) return "/";
  try {
    const url = new URL(referer);
    const path = url.pathname + url.search;
    return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/vstup") ? path : "/";
  } catch {
    return "/";
  }
}

/** Zapne náhled skupiny nebo kolegy. Smí jen správce a jen s platným klíčem; prázdná volba = můj pohled. */
export async function startPreview(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = keySchema.safeParse(formData.get("pohled") ?? "");
  const jar = await cookies();
  const back = await backPath();
  if (!parsed.success || !parsed.data || !isOrganizer(user)) {
    jar.set(PREVIEW_COOKIE, "", expiredPreviewCookieOptions);
    redirect(back);
  }
  const preview = await resolvePreview(user, parsed.data);
  if (preview) jar.set(PREVIEW_COOKIE, encodePreviewCookie(user.id, parsed.data), previewCookieOptions);
  else jar.set(PREVIEW_COOKIE, "", expiredPreviewCookieOptions);
  redirect(back);
}

/** Ukončí náhled a vrátí správce na vlastní pohled stejné stránky. */
export async function endPreview(): Promise<void> {
  await requireUser();
  (await cookies()).set(PREVIEW_COOKIE, "", expiredPreviewCookieOptions);
  redirect(await backPath());
}
