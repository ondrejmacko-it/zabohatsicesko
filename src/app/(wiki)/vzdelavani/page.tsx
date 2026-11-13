import { redirect } from "next/navigation";

export default function EducationIndex() {
  // Výchozí stránka modulu je Plán: úkoly, nejbližší akce a harmonogram na jednom místě.
  redirect("/vzdelavani/harmonogram");
}
