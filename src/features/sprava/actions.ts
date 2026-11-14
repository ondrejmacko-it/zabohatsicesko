"use server";

import { after } from "next/server";
import { z } from "zod";
import { GROUPS, ROLES } from "@/lib/types";
import { runAction, type ActionResult } from "@/features/shared/run-action";
import { logError } from "@/server/audit";
import { createAccess } from "@/server/auth/access-links";
import { syncPending } from "@/server/calendar/sync";
import { BULK_INVITE_MAX, inviteUser, inviteUsers, previewBulkInvite, rejectRequest, updateAccess, type BulkInviteRow } from "@/server/services/users";

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

export async function inviteUserAction(_prev: ActionResult | null, formData: FormData): Promise<AccessResult> {
  return runAction(async (user) => {
    const data = z
      .object({ ...access, email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().min(2).max(80) })
      .parse({ ...accessOf(formData), email: formData.get("email"), name: formData.get("name") });
    const id = await inviteUser(user, data);
    // Pozvaný rovnou dostane osobní odkaz, správce ho pošle ve zprávě.
    const created = await createAccess(user, id, false);
    after(() => syncPending());
    return { ok: true, message: `Pozvánka je uložená: ${data.name}. Pošlete kolegovi jeho osobní odkaz.`, access: accessOfCreated(created) };
  });
}

export type AccessMessage = { link: string; code: string | null; expires: string; name: string; email: string };
export type AccessResult = ActionResult & { access?: AccessMessage };

const accessOfCreated = (created: Awaited<ReturnType<typeof createAccess>>): AccessMessage => ({
  link: created.link,
  code: created.code,
  expires: created.expiresAt.toISOString(),
  name: created.name,
  email: created.email,
});

/** Nový osobní odkaz k přihlášení, volitelně s jednorázovým kódem. Starší nepoužité přestanou platit. */
export async function createAccessAction(_prev: AccessResult | null, formData: FormData): Promise<AccessResult> {
  return runAction(async (user) => {
    const created = await createAccess(user, userId.parse(formData.get("userId")), formData.get("withCode") === "1");
    return { ok: true, access: accessOfCreated(created) } as AccessResult;
  });
}

export async function updateAccessAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = z
      .object({ ...access, userId, status: z.enum(["active", "disabled"]) })
      .parse({ ...accessOf(formData), userId: formData.get("userId"), status: formData.get("status") });
    await updateAccess(user, data.userId, data);
    after(() => syncPending());
    return { ok: true, message: data.status === "active" ? "Uloženo." : "Přístup je odebraný." };
  });
}

export async function rejectRequestAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    await rejectRequest(user, userId.parse(formData.get("userId")));
    return { ok: true, message: "Žádost je zamítnutá." };
  });
}

export type BulkInviteResultRow = BulkInviteRow & { access?: AccessMessage };
export type BulkInviteResult = { ok: true; rows: BulkInviteResultRow[]; saved: boolean } | { ok: false; error: string };

/** Hromadné pozvání ve dvou krocích jedním formulářem: „preview“ jen vyhodnotí seznam, „save“ pozve. */
export async function bulkInviteAction(_prev: BulkInviteResult | null, formData: FormData): Promise<BulkInviteResult> {
  let rows: BulkInviteResultRow[] = [];
  const saved = formData.get("step") === "save";
  const result = await runAction(async (user) => {
    const data = z.object({ ...access, text: z.string().max(BULK_INVITE_MAX * 300) }).parse({ ...accessOf(formData), text: formData.get("text") });
    if (!saved) {
      rows = await previewBulkInvite(user, data.text, data.role);
      return { ok: true };
    }
    // Každý pozvaný hned dostane svůj osobní odkaz. Když se odkaz jednomu nepovede vytvořit, ostatní pozvání
    // platí dál a správce mu odkaz vytvoří v menu účtu.
    rows = [];
    for (const row of await inviteUsers(user, data)) {
      if (!row.userId) {
        rows.push(row);
        continue;
      }
      try {
        rows.push({ ...row, access: accessOfCreated(await createAccess(user, row.userId, false)) });
      } catch (error) {
        logError("sprava.bulk_invite", "access_failed", error);
        rows.push(row);
      }
    }
    after(() => syncPending());
    return { ok: true };
  });
  return result.ok ? { ok: true, rows, saved } : result;
}
