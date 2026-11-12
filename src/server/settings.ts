import { and, eq } from "drizzle-orm";
import { config } from "@/server/config";
import type { Executor } from "@/server/db/client";
import { integrationSettings } from "@/server/db/schema";

/** Přepínače simulace pro předvedení chyb. Mění je jen organizátor v přehledu integrací. */
export const SIMULATION_SWITCHES = ["calendar.outage", "calendar.revoked", "transcription.outage"] as const;
export type SimulationSwitch = (typeof SIMULATION_SWITCHES)[number];

export async function readSwitch(db: Executor, key: SimulationSwitch): Promise<boolean> {
  const [row] = await db
    .select({ value: integrationSettings.value })
    .from(integrationSettings)
    .where(and(eq(integrationSettings.orgId, config.orgId), eq(integrationSettings.key, key)))
    .limit(1);
  return row?.value === true;
}

export async function readSwitches(db: Executor): Promise<Record<SimulationSwitch, boolean>> {
  const rows = await db.select().from(integrationSettings).where(eq(integrationSettings.orgId, config.orgId));
  const map = new Map(rows.map((r) => [r.key, r.value === true]));
  return Object.fromEntries(SIMULATION_SWITCHES.map((key) => [key, map.get(key) ?? false])) as Record<SimulationSwitch, boolean>;
}

export async function writeSwitch(db: Executor, key: SimulationSwitch, value: boolean): Promise<void> {
  await db
    .insert(integrationSettings)
    .values({ orgId: config.orgId, key, value })
    .onConflictDoUpdate({ target: [integrationSettings.orgId, integrationSettings.key], set: { value } });
}

/** Umělé zpoždění simulace, aby byl v UI vidět průběžný stav. V testech 0. */
export async function simulatedLatency(): Promise<void> {
  const ms = Number(process.env.SIM_LATENCY_MS ?? 1200);
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}
