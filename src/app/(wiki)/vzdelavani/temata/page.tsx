import { redirect } from "next/navigation";

export default function TopicsRedirect() {
  // Témata jsou na jedné stránce se zápisy. Starší odkazy dál fungují.
  redirect("/vzdelavani/zapisy#temata");
}
