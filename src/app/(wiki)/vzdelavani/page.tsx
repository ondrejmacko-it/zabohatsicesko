import { redirect } from "next/navigation";

export default function EducationIndex() {
  // Výchozí stránka modulu je osobní přehled. Harmonogram je o klik vedle.
  redirect("/vzdelavani/moje-cesta");
}
