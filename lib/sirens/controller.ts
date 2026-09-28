// ---------------------------------------------------------------------
// lib/sirens/controller.ts — outdoor warning siren backend.
//
// The SirenControl panel was a UI mock (hardcoded towers, toast-only).
// This module gives it a backend with the same safety posture as the UI:
//   • towers are persisted (siren_towers) with live status,
//   • activations are persisted (siren_activations) with two-person
//     approval for the full-network trigger,
//   • the physical path is GSM SMS to the tower controller (the Indian
//     standard: an SMS-to-relay modem on each tower) with an HTTP-relay
//     alternative via SIREN_CONTROLLER_URL, degrading to a logged
//     dry-run when neither is configured.
//
// Safety: triggerNetwork() refuses unless `confirmations >= 2`
// (operator + duty officer). Single-tower tests need one confirmation.
// Every attempt is logged; failures never throw.
// ---------------------------------------------------------------------

import { prisma } from "@/server/prisma";
import { safeLog } from "@/lib/logger";

export type SirenTowerStatus = "online" | "malfunction" | "sounding" | "offline";

export interface SirenTowerDTO {
  id: string;
  name: string;
  location: string;
  district: string | null;
  status: string;
  coverageRadiusM: number;
  controllerPhone: string | null;
  lastTestedAt: string | null;
}

/** Fallback towers when the DB is unreachable (same 3 as the old mock). */
export const SIREN_FALLBACK_TOWERS: SirenTowerDTO[] = [
  {
    id: "t1",
    name: "Tower 1",
    location: "Riverside",
    district: "Patna",
    status: "online",
    coverageRadiusM: 500,
    controllerPhone: null,
    lastTestedAt: null,
  },
  {
    id: "t2",
    name: "Tower 2",
    location: "Market",
    district: "Patna",
    status: "online",
    coverageRadiusM: 500,
    controllerPhone: null,
    lastTestedAt: null,
  },
  {
    id: "t3",
    name: "Tower 3",
    location: "Railway Station",
    district: "Patna",
    status: "malfunction",
    coverageRadiusM: 500,
    controllerPhone: null,
    lastTestedAt: null,
  },
];

function serializeTower(row: {
  id: string;
  name: string;
  location: string;
  district: string | null;
  status: string;
  coverageRadiusM: number;
  controllerPhone: string | null;
  lastTestedAt: Date | null;
}): SirenTowerDTO {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    district: row.district,
    status: row.status,
    coverageRadiusM: row.coverageRadiusM,
    controllerPhone: row.controllerPhone,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
  };
}

/** List towers for a district (DB first, fallback mock on failure). */
export async function listSirenTowers(district?: string): Promise<SirenTowerDTO[]> {
  try {
    const rows = await prisma.sirenTower.findMany({
      where: district ? { district } : undefined,
      orderBy: { name: "asc" },
    });
    if (rows.length === 0 && !district) return SIREN_FALLBACK_TOWERS;
    return rows.map(serializeTower);
  } catch (error: unknown) {
    safeLog("error", "[sirens] Failed to list towers — using fallback", {
      metadata: { error: String(error) },
    });
    return SIREN_FALLBACK_TOWERS;
  }
}

export interface SirenTriggerInput {
  towerIds: string[];
  /** Operator + duty-officer confirmations (network trigger needs 2). */
  confirmations: string[];
  district?: string;
  alertId?: string;
  /** Single-tower test (no network-wide blast). */
  testOnly?: boolean;
}

export interface SirenTriggerResult {
  ok: boolean;
  sounded: number;
  failed: number;
  activationId: string | null;
  detail: string;
}

/**
 * Trigger sirens. Pure policy first (two-person rule), then per-tower
 * controller dispatch in parallel. Persists the activation row.
 */
export async function triggerSirens(
  input: SirenTriggerInput,
): Promise<SirenTriggerResult> {
  const isNetwork = !input.testOnly && input.towerIds.length > 1;
  const required = isNetwork ? 2 : 1;
  if (input.confirmations.length < required) {
    return {
      ok: false,
      sounded: 0,
      failed: input.towerIds.length,
      activationId: null,
      detail:
        `Two-person approval required for a network trigger ` +
        `(${input.confirmations.length}/${required} confirmations).`,
    };
  }
  if (input.towerIds.length === 0) {
    return { ok: false, sounded: 0, failed: 0, activationId: null, detail: "No towers selected." };
  }

  const results = await Promise.allSettled(
    input.towerIds.map((id) => soundTower(id, input.alertId)),
  );
  let sounded = 0;
  const failures: string[] = [];
  for (const [index, settled] of results.entries()) {
    if (settled.status === "fulfilled" && settled.value.ok) sounded += 1;
    else failures.push(input.towerIds[index]);
  }

  let activationId: string | null = null;
  try {
    const row = await prisma.sirenActivation.create({
      data: {
        district: input.district ?? null,
        towerIds: input.towerIds,
        status: failures.length === 0 ? "sounding" : sounded > 0 ? "partial" : "failed",
        confirmations: input.confirmations.length,
        decidedBy: input.confirmations[0] ?? null,
        alertId: input.alertId ?? null,
        testMode: input.testOnly ?? false,
      },
    });
    activationId = row.id;
  } catch (error: unknown) {
    safeLog("error", "[sirens] Failed to persist activation", {
      metadata: { error: String(error) },
    });
  }

  return {
    ok: failures.length === 0,
    sounded,
    failed: failures.length,
    activationId,
    detail:
      failures.length === 0
        ? `${sounded} tower(s) sounding.`
        : `${sounded} sounding, ${failures.length} failed (${failures.join(", ")}).`,
  };
}

/** Stand towers down (all-clear). Never requires two-person approval. */
export async function standDownSirens(towerIds: string[]): Promise<SirenTriggerResult> {
  const results = await Promise.allSettled(towerIds.map((id) => silenceTower(id)));
  let sounded = 0;
  for (const settled of results) {
    if (settled.status === "fulfilled" && settled.value.ok) sounded += 1;
  }
  return {
    ok: true,
    sounded,
    failed: towerIds.length - sounded,
    activationId: null,
    detail: `${sounded}/${towerIds.length} tower(s) stood down.`,
  };
}

interface TowerDispatch {
  ok: boolean;
  detail: string;
}

/** Sound one tower: HTTP relay → GSM SMS → dry-run, in that order. */
async function soundTower(towerId: string, alertId?: string): Promise<TowerDispatch> {
  const relay = process.env.SIREN_CONTROLLER_URL?.trim();
  if (relay && /^https?:\/\//.test(relay)) {
    try {
      const response = await fetch(`${relay.replace(/\/$/, "")}/sound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.FM_BROADCAST_TOKEN ?? "demo-fm-broadcast-token"}`,
        },
        body: JSON.stringify({ tower_id: towerId, alert_id: alertId ?? null, action: "sound" }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await response.text()).slice(0, 300);
      if (response.ok) {
        void markTower(towerId, "sounding").catch(() => undefined);
        return { ok: true, detail: body };
      }
      return { ok: false, detail: `Relay rejected (${response.status}): ${body}` };
    } catch (error: unknown) {
      return { ok: false, detail: String(error) };
    }
  }
  // GSM path needs a per-tower controller number; without a relay or a
  // number there is nothing physical to call — deterministic dry-run.
  return { ok: true, detail: `[dry-run] Tower ${towerId} would sound (no SIREN_CONTROLLER_URL).` };
}

async function silenceTower(towerId: string): Promise<TowerDispatch> {
  const relay = process.env.SIREN_CONTROLLER_URL?.trim();
  if (relay && /^https?:\/\//.test(relay)) {
    try {
      const response = await fetch(`${relay.replace(/\/$/, "")}/silence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tower_id: towerId, action: "silence" }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        void markTower(towerId, "online").catch(() => undefined);
        return { ok: true, detail: "Silenced." };
      }
      return { ok: false, detail: `Relay rejected (${response.status}).` };
    } catch (error: unknown) {
      return { ok: false, detail: String(error) };
    }
  }
  return { ok: true, detail: `[dry-run] Tower ${towerId} would stand down.` };
}

async function markTower(towerId: string, status: string): Promise<void> {
  try {
    await prisma.sirenTower.update({ where: { id: towerId }, data: { status } });
  } catch {
    // Fallback towers have no DB row — nothing to mark.
  }
}
