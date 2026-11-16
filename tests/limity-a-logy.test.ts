import { afterEach, describe, expect, test, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { clearRateLimit, logError, safeLogCode } from "@/server/audit";
import { organizer } from "./helpers";

vi.mock("next/cache", () => ({ refresh: () => undefined }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: async () => ({ ...organizer, name: "Správce" }) }));

const { ACTION_LIMIT, runAction } = await import("@/features/shared/run-action");

afterEach(async () => clearRateLimit(await getDb(), `action:${organizer.id}`));

describe("limit serverových akcí a provozní logy", () => {
  test("po vyčerpání limitu akce neproběhne a vrátí srozumitelnou chybu", async () => {
    let runs = 0;
    const task = async () => (runs++, { ok: true as const });
    for (let i = 0; i < ACTION_LIMIT.count; i++) expect((await runAction(task)).ok).toBe(true);
    expect(await runAction(task)).toEqual({ ok: false, error: "Příliš mnoho pokusů. Zkuste to prosím za chvíli." });
    expect(runs).toBe(ACTION_LIMIT.count);
  });

  test("log nezapíše e-mail, token ani text chyby, jen bezpečný kód", () => {
    expect(safeLogCode("invalid_grant")).toBe("invalid_grant");
    expect(safeLogCode("http_403_rateLimitExceeded")).toBe("http_403_rateLimitExceeded");
    expect(safeLogCode("jan.novak@example.com")).toBe("unknown");
    expect(safeLogCode("Bearer ya29.a0AfH6")).toBe("unknown");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logError("google.oauth", "token pro jan.novak@example.com", new Error("tajný obsah"));
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ scope: "google.oauth", code: "unknown", kind: "Error" }));
    spy.mockRestore();
  });
});
