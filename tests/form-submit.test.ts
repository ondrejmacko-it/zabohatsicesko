import type { FormEvent } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { submitKeepingValues } from "@/features/shared/keep-values";

/**
 * Chyba z 12. 11.: po neúspěšném zveřejnění React formulář resetoval a Typ se přepnul na první možnost.
 * Test hlídá smlouvu, na které oprava stojí. V prohlížeči se ověřuje ručně: Přidat akci, změnit Typ, Zveřejnit bez tématu.
 */
describe("odeslání formuláře bez resetu", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("zastaví výchozí odeslání (a tím reset) a předá data včetně stisknutého tlačítka", async () => {
    const built: unknown[][] = [];
    class FakeFormData {
      constructor(...args: unknown[]) {
        built.push(args);
      }
    }
    vi.stubGlobal("FormData", FakeFormData);

    const form = { name: "formulář" };
    const publishButton = { name: "intent", value: "publish" };
    const preventDefault = vi.fn();
    const action = vi.fn();

    submitKeepingValues(action)({
      preventDefault,
      currentTarget: form,
      nativeEvent: { submitter: publishButton },
    } as unknown as FormEvent<HTMLFormElement>);

    // React akci z atributu `action` (a následný reset) přeskočí, jen když je výchozí odeslání zastavené.
    expect(preventDefault).toHaveBeenCalledOnce();
    // Bez tlačítka by server nepoznal rozdíl mezi „Uložit návrh“ a „Zveřejnit“.
    expect(built).toEqual([[form, publishButton]]);
    await vi.waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(action.mock.calls[0]![0]).toBeInstanceOf(FakeFormData);
  });
});
