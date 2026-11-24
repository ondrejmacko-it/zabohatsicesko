import { afterEach, describe, expect, test, vi } from "vitest";
import { PARTICIPATION_MIGRATIONS, markParticipationSchema, participationEnabled, participationReadiness } from "@/server/config";
import { getDb } from "@/server/db/client";

// Aktivace účasti: PARTICIPATION=on platí v ukázce i v ostré Wiki, ale jen nad databází s migracemi 0016 a 0017.
describe("aktivace účasti podle konfigurace a schématu", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    markParticipationSchema(new Set(PARTICIPATION_MIGRATIONS));
  });

  test("bez PARTICIPATION=on je účast vypnutá v obou režimech", async () => {
    await getDb();
    for (const mode of ["demo", "production"]) {
      vi.stubEnv("WIKI_MODE", mode);
      vi.stubEnv("PARTICIPATION", "");
      expect(participationReadiness()).toBe("off");
      expect(participationEnabled()).toBe(false);
    }
  });

  test("ostrá Wiki s PARTICIPATION=on a provedeným schématem účast zapne", async () => {
    await getDb();
    vi.stubEnv("WIKI_MODE", "production");
    vi.stubEnv("PARTICIPATION", "on");
    expect(participationReadiness()).toBe("on");
    expect(participationEnabled()).toBe(true);
  });

  test("chybějící migrace účast nezapne ani při PARTICIPATION=on", () => {
    vi.stubEnv("WIKI_MODE", "production");
    vi.stubEnv("PARTICIPATION", "on");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    markParticipationSchema(new Set(["0016_event_participation"]));
    expect(participationReadiness()).toBe("missing-schema");
    expect(participationEnabled()).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
