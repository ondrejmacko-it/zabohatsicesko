"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { DomainError } from "@/server/services/errors";
import { currentPreview } from "@/server/services/preview-context";
import { setSalutation } from "@/server/services/salutation";

/** D03: uloží vlastní oslovení přihlášeného (prázdné pole vrátí tvar podle jména). */
export async function saveSalutation(formData: FormData): Promise<void> {
  const user = await requireUser();
  // Náhled je jen ke čtení; bez této pojistky by si správce v náhledu kolegy přepsal vlastní oslovení.
  if (await currentPreview(user)) redirect("/");
  // „Vrátit podle jména“ smaže vlastní podobu bez ohledu na rozepsaný text v poli.
  const raw = formData.get("vratit") ? "" : formData.get("osloveni");
  try {
    await setSalutation(user, typeof raw === "string" ? raw : "");
  } catch (error) {
    if (error instanceof DomainError) redirect("/?osloveni=chyba");
    throw error;
  }
  revalidatePath("/");
  redirect("/");
}
