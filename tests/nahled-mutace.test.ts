import { beforeEach, describe, expect, test, vi } from "vitest";
import { DOMAIN_ERROR_MESSAGES } from "@/server/services/errors";
import { encodePreviewCookie, PREVIEW_COOKIE } from "@/server/services/preview-context";
import { organizer, resetDemo } from "./helpers";

// Fáze D: náhled „Zobrazit jako“ je jen ke čtení na serveru, ne jen zamčeným tlačítkem. Test projde
// všechny exportované serverové akce Vzdělávání a Správy a s aktivní cookie náhledu čeká odmítnutí.
vi.mock("next/cache", () => ({ refresh: () => undefined }));
vi.mock("next/headers", async (original) => ({
  ...(await original<typeof import("next/headers")>()),
  cookies: async () => ({
    get: (name: string) => (name === PREVIEW_COOKIE ? { name, value: encodePreviewCookie(organizer.id, "skupina-fp") } : undefined),
  }),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: async () => ({ ...organizer, name: "Správce" }) }));

const modules = {
  vzdelavani: await import("@/features/vzdelavani/actions"),
  sprava: await import("@/features/sprava/actions"),
};

type Action = (...args: unknown[]) => Promise<unknown>;

beforeEach(resetDemo);

describe("náhled odmítne všechny serverové akce", () => {
  for (const [name, mod] of Object.entries(modules)) {
    const actions = Object.entries(mod).filter(([, value]) => typeof value === "function") as [string, Action][];
    test(`${name}: ${actions.length} akcí vrací preview_read_only`, async () => {
      expect(actions.length).toBeGreaterThan(5);
      for (const [key, action] of actions) {
        const form = new FormData();
        form.set("id", "neexistuje");
        const result = await (action.length >= 2 ? action(null, form) : action(form));
        expect({ key, result }).toEqual({ key, result: { ok: false, error: DOMAIN_ERROR_MESSAGES.preview_read_only } });
      }
    });
  }
});
