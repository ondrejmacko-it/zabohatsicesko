import { isLiveWiki, liveWikiConfigProblems } from "@/server/config";

// Při startu serveru ostrá Wiki ověří, že má přihlášení Googlem i Kalendář. Neúplná konfigurace
// server nespustí, místo aby Wiki běžela bez přihlášení nebo nad simulací. Vypisují se jen názvy proměnných.
export function register() {
  if (!isLiveWiki()) return;
  const problems = liveWikiConfigProblems();
  if (problems.length) throw new Error(`Ostré Wiki (WIKI_MODE=production) chybí nebo nesedí: ${problems.join(", ")}`);
}
