import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { requireRole } from "@/lib/security/require-role";
import { GOV_ROLES } from "@/lib/validations/user";
import {
  runGreedyAllocation,
  type AllocationCandidateResource,
  type AllocationDemand,
  type LockedAllocation,
  type ProposedAllocation,
} from "@/lib/allocation/optimizer";

export const dynamic = "force-dynamic";

type OptimizeBody = {
  event_id?: string;
  locked_allocations?: { resource_id?: string; demand_id?: string }[];
  fleet_availability?: number; // 0–100, % of the fleet still usable
  demand_surge?: number; // % extra demand on top of current needs
};

type UnmetDemand = {
  demandId: string;
  category: string;
  quantityNeeded: number;
  quantityAllocated: number;
  unmet: number;
  lat: number;
  lng: number;
  priorityScore: number;
};

function buildUnmet(
  demands: AllocationDemand[],
  plan: ProposedAllocation[],
): UnmetDemand[] {
  const allocated: Record<string, number> = {};
  for (const a of plan) {
    allocated[a.demandId] = (allocated[a.demandId] ?? 0) + a.quantityAllocated;
  }

  const unmet: UnmetDemand[] = [];
  for (const d of demands) {
    const quantityAllocated = allocated[d.id] ?? 0;
    const shortfall = d.quantityNeeded - quantityAllocated;
    if (shortfall > 0) {
      unmet.push({
        demandId: d.id,
        category: d.category,
        quantityNeeded: d.quantityNeeded,
        quantityAllocated,
        unmet: shortfall,
        lat: d.lat,
        lng: d.lng,
        priorityScore: calculatePriorityScore(d),
      });
    }
  }
  return unmet.sort((a, b) => b.priorityScore - a.priorityScore);
}

function calculatePriorityScore(d: AllocationDemand): number {
  const pop = d.affectedPopulation ?? 0;
  const severity = d.severityRisk ?? 0;
  const access = d.accessibilityFactor ?? 1;
  return (
    Math.log10(Math.max(pop, 0) + 1) * 30 +
    Math.max(0, Math.min(1, severity)) * 45 -
    (1 - Math.max(0, Math.min(1, access))) * 10
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  // Security: the optimizer PERSISTS allocation plans (and can create stand-in
  // disaster events). Only gov roles may mutate operational allocations — an
  // anonymous caller must never write to resource_allocations. Guests (no role
  // cookie) are rejected too.
  const auth = await requireRole(GOV_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: OptimizeBody = {};
  try {
    body = (await request.json()) as OptimizeBody;
  } catch {
    // Empty/invalid body → run with defaults (still works for the demo).
  }

  let resources: AllocationCandidateResource[] = [];
  let demands: AllocationDemand[] = [];
  let eventId = body.event_id ?? "";

  try {
    const [resRows, reqRows, events] = await Promise.all([
      prisma.resource.findMany({
        where: { status: "available" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.resourceRequest.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.disasterEvent.findMany({ select: { id: true }, take: 1 }),
    ]);

    resources = resRows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      quantity: r.quantity,
      lat: r.lat,
      lng: r.lng,
    }));
    demands = reqRows.map((r) => ({
      id: r.id,
      disasterEventId: eventId || events[0]?.id || "",
      category: r.category,
      quantityNeeded: r.quantityNeeded,
      lat: r.lat,
      lng: r.lng,
      affectedPopulation: 20000,
      severityRisk: r.urgency === "critical" ? 0.9 : r.urgency === "high" ? 0.7 : 0.4,
      accessibilityFactor: 0.8,
    }));

    if (!eventId) eventId = events[0]?.id ?? "";
  } catch (error: unknown) {
    console.error("[allocations] inventory unavailable", error);
    return NextResponse.json(
      {
        ok: false,
        source: "unavailable",
        error: "Live resource inventory is unavailable",
      },
      { status: 503 },
    );
  }

  const locked: LockedAllocation[] = (body.locked_allocations ?? [])
    .filter((l) => l.resource_id && l.demand_id)
    .map((l) => ({ resourceId: l.resource_id!, demandId: l.demand_id! }));

  // Scenario knobs: scale fleet availability down and demand surge up before
  // running the greedy algorithm ("What if 5 boats break down?").
  const fleetAvailability =
    Math.max(0, Math.min(100, Number(body.fleet_availability ?? 100))) / 100;
  const demandSurge = Math.max(0, Number(body.demand_surge ?? 0)) / 100;

  if (fleetAvailability < 1) {
    resources = resources.map((r) => ({
      ...r,
      quantity: Math.floor(r.quantity * fleetAvailability),
    }));
  }
  if (demandSurge > 0) {
    demands = demands.map((d) => ({
      ...d,
      quantityNeeded: Math.ceil(d.quantityNeeded * (1 + demandSurge)),
    }));
  }

  if (!eventId && demands.length > 0) {
    return NextResponse.json(
      { ok: false, error: "An existing disaster event is required" },
      { status: 422 },
    );
  }

  const plan = await runGreedyAllocation(resources, demands, locked);
  const unmetDemand = buildUnmet(demands, plan);

  let persisted = false;
  if (plan.length > 0 && eventId) {
    try {
      persisted = await persistAllocations(plan, eventId);
    } catch (error) {
      console.error("[allocations] failed to persist allocation plan", error);
    }
  }

  return NextResponse.json({
    ok: true,
    event_id: eventId,
    plan,
    unmet_demand: unmetDemand,
    persisted,
    meta: {
      resources_scanned: resources.length,
      demands_scanned: demands.length,
      allocations_proposed: plan.length,
      locked_allocations: locked.length,
      fleet_availability: Math.round(fleetAvailability * 100),
      demand_surge: Math.round(demandSurge * 100),
    },
  });
}

/**
 * Persist a proposed allocation plan into the resource_allocations table.
 * Only persists against an existing disaster event. Re-running the optimizer
 * updates allocations by resource and event rather than duplicating them.
 */
async function persistAllocations(
  plan: ProposedAllocation[],
  eventId: string,
): Promise<boolean> {
  if (!plan.length) return false;

  const event = await prisma.disasterEvent.findUnique({ where: { id: eventId } });
  if (!event) return false;

  for (const allocation of plan) {
    const data = {
      resourceId: allocation.resourceId,
      disasterEventId: event.id,
      destinationLat: allocation.destinationLat,
      destinationLng: allocation.destinationLng,
      quantityAllocated: allocation.quantityAllocated,
      status: allocation.status,
      priorityScore: allocation.priorityScore,
      estimatedArrival: allocation.estimatedArrival ?? null,
      isLocked: false,
    };

    const existing = await prisma.resourceAllocation
      .findFirst({
        where: {
          resourceId: allocation.resourceId,
          disasterEventId: event.id,
        },
      })
      .catch(() => null);

    if (existing) {
      await prisma.resourceAllocation.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.resourceAllocation.create({ data });
    }
  }
  return true;
}
