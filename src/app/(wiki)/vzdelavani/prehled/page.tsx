import { redirect } from "next/navigation";

export default function LegacyOverviewRedirect() {
  // Přehled je součástí Plánu. Starší odkazy a záložky dál fungují.
  redirect("/vzdelavani/harmonogram");
}
