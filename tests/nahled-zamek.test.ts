import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const path = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

import { ActionForm } from "@/components/ActionForm";
import { PreviewLockProvider } from "@/components/PreviewLock";
import { InterestButton } from "@/features/vzdelavani/components/TopicActions";

// D1: v náhledu zůstávají akční tlačítka na stejném místě, jen zamčená. Server mutaci odmítne i tak (nahled-mutace).
const action = async () => ({ ok: true as const });
const render = (active: boolean, child: React.ReactElement) => renderToStaticMarkup(createElement(PreviewLockProvider, { active, children: child }));
const button = (html: string, label: string) => html.match(new RegExp(`<button[^>]*>(?:<[^>]+>)*${label}`))?.[0] ?? "";

describe("D1: zámek akčních tlačítek v náhledu", () => {
  test("ActionForm s potvrzením i bez je v náhledu zamčený", () => {
    path.current = "/vzdelavani/akce/e1";
    for (const confirm of [undefined, { title: "T", text: "X", confirmLabel: "Ano" }]) {
      const html = button(render(true, createElement(ActionForm, { action, label: "Přihlásit se", confirm })), "Přihlásit se");
      expect(html).toContain('disabled=""');
      expect(html).toContain('aria-disabled="true"');
      expect(html).toContain('title="Náhled je jen ke čtení"');
    }
  });

  test("bez náhledu a mimo stránky náhledu tlačítko funguje", () => {
    path.current = "/vzdelavani/akce/e1";
    expect(button(render(false, createElement(ActionForm, { action, label: "Přihlásit se" })), "Přihlásit se")).not.toContain("disabled");
    path.current = "/sprava";
    expect(button(render(true, createElement(ActionForm, { action, label: "Uložit" })), "Uložit")).not.toContain("disabled");
  });

  test("Mám zájem se v náhledu zamkne i bez parametru locked", () => {
    path.current = "/vzdelavani/temata";
    const html = render(true, createElement(InterestButton, { topicId: "t1", interested: true, titleId: "x" }));
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('title="Náhled je jen ke čtení"');
    expect(html).not.toContain("<form");
  });
});
