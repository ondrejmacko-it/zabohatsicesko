"use server";

import { z } from "zod";
import { GROUPS, ROLES } from "@/lib/types";
import { runAction, type ActionResult } from "@/features/shared/run-action";
import { inviteUser, rejectRequest, updateAccess } from "@/server/services/users";

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
    await inviteUser(user, data);
    return { ok: true, message: `Pozvánka pro ${data.name} je uložená. Pošlete kolegovi odkaz na Wiki.` };
  });
}

export async function updateAccessAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = z
      .object({ ...access, userId, status: z.enum(["active", "disabled"]) })
      .parse({ ...accessOf(formData), userId: formData.get("userId"), status: formData.get("status") });
    await updateAccess(user, data.userId, data);
    return { ok: true, message: data.status === "active" ? "Uloženo." : "Přístup je odebraný." };
  });
}

export async function rejectRequestAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    await rejectRequest(user, userId.parse(formData.get("userId")));
    return { ok: true, message: "Žádost je zamítnutá." };
  });
}
