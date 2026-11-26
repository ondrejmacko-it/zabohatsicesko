import { describe, expect, test } from "vitest";
import { NETWORK_ERROR, callAction } from "@/components/ActionForm";

// Fáze B, chyby sítě: výpadek spojení u tlačítka akce nesmí skončit chybovou stránkou.
describe("callAction", () => {
  test("síťová chyba = zpráva u tlačítka, která nic neslibuje", async () => {
    const failing = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await callAction(failing, null, new FormData())).toEqual({ ok: false, error: NETWORK_ERROR });
  });

  test("výsledek serveru projde beze změny", async () => {
    const ok = async () => ({ ok: true as const, message: "Uloženo" });
    expect(await callAction(ok, null, new FormData())).toEqual({ ok: true, message: "Uloženo" });
  });
});
