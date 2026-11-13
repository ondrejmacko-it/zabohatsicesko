import { redirect } from "next/navigation";

/** Stará adresa stránky Přehled. Odkazy z dřívějších pozvánek a záložek dál fungují. */
export default function OldJourneyPage() {
  redirect("/vzdelavani/prehled");
}
