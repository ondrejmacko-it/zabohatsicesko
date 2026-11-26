"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { DomainError } from "@/server/services/errors";
import { setSalutation } from "@/server/services/salutation";

/** D03: uloží vlastní oslovení přihlášeného (prázdné pole vrátí tvar podle jména). */
export async function saveSalutation(formData: FormData): Promise<void> {
  const user = await requireUser();
  const raw = formData.get("osloveni");
  try {
    await setSalutation(user, typeof raw === "string" ? raw : "");
  } catch (error) {
    if (error instanceof DomainError) redirect("/?osloveni=chyba");
    throw error;
  }
  revalidatePath("/");
  redirect("/");
}
