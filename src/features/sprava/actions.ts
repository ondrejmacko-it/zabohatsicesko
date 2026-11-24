"use server";

import { after } from "next/server";
import { z } from "zod";
import { GROUPS, ROLES } from "@/lib/types";
import { runAction, type ActionResult } from "@/features/shared/run-action";
import { cleanupLegacyInvites } from "@/server/calendar/legacy-invites";
import { syncPending } from "@/server/calendar/sync";
import { config } from "@/server/config";
import { formatDayMonth, toDateKey } from "@/lib/time";
import { setExcuseManagers } from "@/server/services/excuse-managers";
import { createLoginLink, inviteUser, rejectRequest, revokeLoginLink, revokeUserDevice, updateAccess } from "@/server/services/users";

/** Odkaz s tokenem ve fragmentu: prohlížeč ho na server sám nepošle ani při kliknutí. */
const linkFor = (token: string) => `${config.appUrl}/vstup#${token}`;

// Každá akce znovu ověří session a oprávnění na serveru (services/users.ts) a validuje vstup.

const access = {
  role: z.enum(ROLES),
  groups: z.array(z.enum(GROUPS)).max(GROUPS.length),
};

const userId = z.string().min(1).max(64);

const accessOf = (formData: FormData) => ({
  role: formData.get("role"),
  groups: [...new Set(formData.getAll("groups"))],
});

export async function inviteUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = z
      .object({ ...access, email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().min(2).max(80) })
      .parse({ ...accessOf(formData), email: formData.get("email"), name: formData.get("name") });
    const { link } = await inviteUser(user, data);
    after(() => syncPending());
    if (!link) return { ok: true, message: `Účet je založený: ${data.name}.` };
    return { ok: true, message: `Odkaz pro ${data.name} platí do ${formatDayMonth(toDateKey(link.expiresAt))}.`, link: linkFor(link.token) };
  });
}

export async function updateAccessAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = z
      .object({ ...access, userId, status: z.enum(["active", "disabled"]) })
      .parse({ ...accessOf(formData), userId: formData.get("userId"), status: formData.get("status") });
    await updateAccess(user, data.userId, data);
    after(() => syncPending());
    if (data.status === "disabled") return { ok: true, message: "Přístup je odebraný." };
    const intent = formData.get("intent");
    return { ok: true, message: intent === "approve" ? "Přístup schválen." : intent === "restore" ? "Přístup vrácen." : "Role a skupiny uloženy." };
  });
}

export async function setExcuseManagersAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = z
      .object({ userId, managerIds: z.array(userId).max(5) })
      .parse({ userId: formData.get("userId"), managerIds: [...new Set(formData.getAll("managerIds"))] });
    await setExcuseManagers(user, data.userId, data.managerIds);
    return { ok: true, message: data.managerIds.length ? "Nadřízení pro omluvy uloženi." : "Omluvy teď nevidí žádný nadřízený." };
  });
}

export async function rejectRequestAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    await rejectRequest(user, userId.parse(formData.get("userId")));
    return { ok: true, message: "Žádost je zamítnutá." };
  });
}

export async function createLoginLinkAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const link = await createLoginLink(user, userId.parse(formData.get("userId")));
    return { ok: true, message: `Odkaz platí do ${formatDayMonth(toDateKey(link.expiresAt))}. Starší nepoužitý odkaz už neplatí.`, link: linkFor(link.token) };
  });
}

export async function revokeLoginLinkAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    await revokeLoginLink(user, userId.parse(formData.get("userId")));
    return { ok: true, message: "Odkaz už neplatí." };
  });
}

export async function revokeDeviceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    await revokeUserDevice(user, userId.parse(formData.get("userId")), z.string().min(1).max(64).parse(formData.get("deviceId")));
    return { ok: true, message: "Zařízení je odhlášené." };
  });
}

/** Úklid starých pozvánek z kalendáře správce po přechodu na osobní kalendáře. Oprávnění ověří služba. */
export async function cleanupLegacyInvitesAction(): Promise<ActionResult> {
  return runAction(async (user) => {
    const result = await cleanupLegacyInvites(user);
    const parts = [`Smazáno pozvánek: ${result.deleted}.`];
    if (result.keptForeign) parts.push(`Spárované události, které Wiki nezaložila, zůstaly v kalendáři beze změny: ${result.keptForeign}.`);
    if (result.failed) return { ok: false, error: `${parts.join(" ")} Google teď neodpověděl u ${result.failed} pozvánek, zkus to prosím za chvíli znovu.` };
    return { ok: true, message: parts.join(" ") };
  });
}
