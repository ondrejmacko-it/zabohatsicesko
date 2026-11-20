import { afterEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

// Výjimka pro e2e (http://localhost ve WebKitu) nesmí oslabit CSP produkce ani Preview.

afterEach(() => {
  vi.unstubAllEnvs();
});

function csp(): string {
  return proxy(new NextRequest("https://wiki.example.invalid/")).headers.get("Content-Security-Policy") ?? "";
}

describe("CSP upgrade-insecure-requests", () => {
  test("produkční build bez proměnné direktivu má", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CSP_UPGRADE_INSECURE", "");
    expect(csp()).toContain("upgrade-insecure-requests");
  });

  test("jen hodnota 0 (e2e server) ji vypne, ostatní direktivy zůstanou", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CSP_UPGRADE_INSECURE", "0");
    expect(csp()).not.toContain("upgrade-insecure-requests");
    expect(csp()).toContain("frame-ancestors 'none'");
    vi.stubEnv("CSP_UPGRADE_INSECURE", "false");
    expect(csp()).toContain("upgrade-insecure-requests");
  });
});
