"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/prisma";
import { requireSession } from "@/lib/security/require-role";
import { sanitizeInput } from "@/lib/security/sanitize";
import {
  resourceInputError as validateResourceInput,
  movementInputError,
} from "@/lib/inventory/model";

// ---------------------------------------------------------------------
// Security: every mutating server action below is gated by requireSession().
// Server actions are directly invokable via a forged Next-Action POST, so the
// middleware alone cannot protect them. requireSession admits the demo cookie
// sessions (guest_mode / role cookie / Supabase user) that the UI relies on
// while rejecting fully anonymous callers. Swap to requireRole(GOV_ROLES)
// when real auth is wired up.
// ---------------------------------------------------------------------
async function assertWriteAccess(): Promise<string | null> {
  const auth = await requireSession();
  return auth.ok ? null : auth.error;
}

// ---------------------------------------------------------------------
// Types (mirror the Prisma models so the UI can use one shape everywhere).
// ---------------------------------------------------------------------
export type InventoryResource = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string | null;
  lat: number;
  lng: number;
  status: string;
  depotName: string | null;
  createdAt?: string;
};

export type ResourceRequest = {
  id: string;
  requestedBy: string;
  category: string;
  quantityNeeded: number;
  urgency: string;
  lat: number;
  lng: number;
  status: string;
  createdAt?: string;
};

// ---------------------------------------------------------------------
/**
 * Fetch only stored resource inventory. Database failure is surfaced to callers.
 */
export async function getInventory(): Promise<InventoryResource[]> {
  try {
    const rows = await prisma.resource.findMany({ orderBy: { createdAt: "desc" } });
    if (!rows.length) return [];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      quantity: r.quantity,
      unit: r.unit,
      lat: r.lat,
      lng: r.lng,
      status: r.status,
      depotName: r.depotName,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (error: unknown) {
    console.error("[resources] inventory unavailable", error);
    throw new Error("Resource inventory is unavailable");
  }
}

/**
 * Fetch only stored pending field resource requests.
 */
export async function getPendingRequests(): Promise<ResourceRequest[]> {
  try {
    const rows = await prisma.resourceRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    if (!rows.length) return [];
    return rows.map((r) => ({
      id: r.id,
      requestedBy: r.requestedBy,
      category: r.category,
      quantityNeeded: r.quantityNeeded,
      urgency: r.urgency,
      lat: r.lat,
      lng: r.lng,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (error: unknown) {
    console.error("[resources] pending requests unavailable", error);
    throw new Error("Resource requests are unavailable");
  }
}

export type NewResourceRequest = {
  category: string;
  quantity: number;
  urgency: string;
  lat: number;
  lng: number;
  notes?: string;
};

/**
 * Create a field resource request and report whether it was saved.
 */
export async function submitResourceRequest(
  input: NewResourceRequest,
): Promise<{ ok: boolean; id: string; error?: string }> {
  const authError = await assertWriteAccess();
  if (authError) return { ok: false, id: "", error: authError };

  // Validate input
  if (!input.category || typeof input.category !== "string") {
    return { ok: false, id: "", error: "Category is required." };
  }
  if (
    typeof input.quantity !== "number" ||
    !Number.isFinite(input.quantity) ||
    input.quantity < 0
  ) {
    return { ok: false, id: "", error: "Invalid quantity." };
  }
  if (!input.urgency || !["low", "medium", "high", "critical"].includes(input.urgency)) {
    return { ok: false, id: "", error: "Invalid urgency level." };
  }
  if (
    typeof input.lat !== "number" ||
    !Number.isFinite(input.lat) ||
    input.lat < -90 ||
    input.lat > 90
  ) {
    return { ok: false, id: "", error: "Invalid latitude." };
  }
  if (
    typeof input.lng !== "number" ||
    !Number.isFinite(input.lng) ||
    input.lng < -180 ||
    input.lng > 180
  ) {
    return { ok: false, id: "", error: "Invalid longitude." };
  }

  try {
    const created = await prisma.resourceRequest.create({
      data: {
        requestedBy: "Field Responder",
        category: input.category,
        quantityNeeded: Math.floor(input.quantity),
        urgency: input.urgency,
        lat: input.lat,
        lng: input.lng,
        status: "pending",
        notes: input.notes ? sanitizeInput(String(input.notes)).slice(0, 2000) : "",
      },
    });
    revalidatePath("/dispatch");
    return { ok: true, id: created.id };
  } catch (error: unknown) {
    console.error("[resources] request could not be saved", error);
    return { ok: false, id: "", error: "Resource request could not be saved" };
  }
}

export type CsvResourceRow = {
  name: string;
  category: string;
  quantity: number;
  lat: number;
  lng: number;
  unit?: string | null;
  status?: string;
  depotName?: string | null;
};

/**
 * Bulk-import resources from a parsed CSV. Database failures return ok=false.
 */
export async function bulkImportResources(
  rows: CsvResourceRow[],
): Promise<{ ok: boolean; count: number }> {
  const authError = await assertWriteAccess();
  if (authError) return { ok: false, count: 0 };
  if (!rows.length || rows.some((row) => validateResourceInput(row)))
    return { ok: false, count: 0 };
  try {
    await prisma.resource.createMany({
      data: rows.map((r) => ({
        name: sanitizeInput(String(r.name ?? "")).slice(0, 200) || "Imported resource",
        category: sanitizeInput(String(r.category ?? "other")).slice(0, 100),
        quantity: r.quantity,
        unit: r.unit ? sanitizeInput(r.unit).slice(0, 100) : null,
        lat: r.lat,
        lng: r.lng,
        status: r.status || "available",
        depotName: r.depotName ? sanitizeInput(r.depotName).slice(0, 200) : null,
      })),
    });
    revalidatePath("/inventory");
    return { ok: true, count: rows.length };
  } catch (error: unknown) {
    console.error("[resources] bulk import failed", error);
    return { ok: false, count: 0 };
  }
}

/**
 * Approve a field request and (optionally) mark the sourcing resource as
 * deployed. Appends a movement-trail entry (Phase 12: depot → disaster site)
 * when both rows exist. Returns true only after the approval is saved.
 */
export async function approveRequest(
  requestId: string,
  resourceId: string,
): Promise<boolean> {
  const authError = await assertWriteAccess();
  if (authError) return false;
  try {
    const [req, source] = await Promise.all([
      prisma.resourceRequest.findUnique({ where: { id: requestId } }).catch(() => null),
      prisma.resource.findUnique({ where: { id: resourceId } }).catch(() => null),
    ]);

    await prisma.resourceRequest.update({
      where: { id: requestId },
      data: { status: "approved" },
    });

    if (source) {
      await prisma.resource.update({
        where: { id: resourceId },
        data: { status: "deployed" },
      });
    }

    // Phase 12 · movement trail: depot → disaster site, timestamped.
    if (req && source) {
      await prisma.resourceMovement
        .create({
          data: {
            resourceId: source.id,
            resourceName: source.name,
            action: "dispatched",
            fromLabel: source.depotName ?? "Central Depot",
            toLabel: req.requestedBy,
            toLat: req.lat,
            toLng: req.lng,
            quantity: req.quantityNeeded,
            note: `Fulfils field request ${req.id.slice(0, 8)}`,
          },
        })
        .catch(() => {
          // best-effort: a failed movement row never blocks the dispatch.
        });
    }

    revalidatePath("/resources");
    revalidatePath("/inventory");
    revalidatePath("/dispatch");
    return true;
  } catch (error: unknown) {
    console.error("[resources] approval failed", error);
    return false;
  }
}

// ---------------------------------------------------------------------
// Phase 12 · Full CRUD: create / update / delete a resource item so the
// inventory is editable beyond CSV bulk import.
// ---------------------------------------------------------------------

export type NewResourceInput = {
  name: string;
  category: string;
  quantity: number;
  unit?: string | null;
  status?: string;
  lat?: number;
  lng?: number;
  depotName?: string | null;
};

export type UpdateResourceInput = NewResourceInput & { id: string };

const MOCK_COORDINATES = { lat: 25.61, lng: 85.14 }; // Patna centre fallback.

const MAX_NAME_LENGTH = 200;

/**
 * Create a resource and return its saved ID.
 */
export async function addResource(
  input: NewResourceInput,
): Promise<{ ok: boolean; id: string; error?: string }> {
  const authError = await assertWriteAccess();
  if (authError) return { ok: false, id: "", error: authError };

  const validationError = validateResourceInput(input);
  if (validationError) {
    return { ok: false, id: "", error: validationError };
  }

  try {
    const created = await prisma.resource.create({
      data: {
        name: sanitizeInput(input.name.trim()).slice(0, MAX_NAME_LENGTH),
        category: input.category,
        quantity: Math.max(0, Math.floor(input.quantity)),
        unit: input.unit ? sanitizeInput(input.unit).slice(0, 100) : null,
        status: input.status || "available",
        lat: input.lat ?? MOCK_COORDINATES.lat,
        lng: input.lng ?? MOCK_COORDINATES.lng,
        depotName: input.depotName ? sanitizeInput(input.depotName).slice(0, 200) : null,
      },
    });
    revalidatePath("/inventory");
    return { ok: true, id: created.id };
  } catch (error: unknown) {
    console.error("[resources] resource could not be saved", error);
    return { ok: false, id: "", error: "Resource could not be saved" };
  }
}

/**
 * Update a single resource. Returns false on failure (DB unavailable) so the
 * UI can surface the failure.
 */
export async function updateResource(input: UpdateResourceInput): Promise<boolean> {
  const authError = await assertWriteAccess();
  if (authError) return false;

  const validationError = validateResourceInput(input);
  if (validationError) {
    console.warn("[resources] updateResource validation failed:", validationError);
    return false;
  }

  try {
    await prisma.resource.update({
      where: { id: input.id },
      data: {
        name: sanitizeInput(input.name.trim()).slice(0, MAX_NAME_LENGTH),
        category: input.category,
        quantity: Math.max(0, Math.floor(input.quantity)),
        unit: input.unit ? sanitizeInput(input.unit).slice(0, 100) : null,
        status: input.status || undefined,
        lat: input.lat ?? MOCK_COORDINATES.lat,
        lng: input.lng ?? MOCK_COORDINATES.lng,
        depotName: input.depotName ? sanitizeInput(input.depotName).slice(0, 200) : null,
      },
    });
    revalidatePath("/inventory");
    return true;
  } catch (error: unknown) {
    console.warn("[resources] updateResource failed.", error);
    return false;
  }
}

/**
 * Delete a stored resource. Returns false if it cannot be removed.
 */
export async function deleteResource(id: string): Promise<boolean> {
  const authError = await assertWriteAccess();
  if (authError) return false;
  try {
    await prisma.resource.delete({ where: { id } });
    revalidatePath("/inventory");
    return true;
  } catch (error: unknown) {
    console.warn("[resources] deleteResource failed.", error);
    return false;
  }
}

// ---------------------------------------------------------------------
// Phase 12 · Resource Movement Tracking — immutable trail of where
// resources went (depot → disaster site) with timestamps. Written on
// dispatch (approveRequest above) and by admins via the Record Movement
// form on the inventory page.
// ---------------------------------------------------------------------

export type ResourceMovement = {
  id: string;
  resourceId: string | null;
  resourceName: string;
  action: string; // dispatched | delivered | returned | adjusted
  fromLabel: string | null;
  toLabel: string;
  toLat: number;
  toLng: number;
  quantity: number;
  note: string | null;
  createdAt: string;
};

export type NewMovementInput = {
  resourceName: string;
  action: string;
  fromLabel?: string | null;
  toLabel: string;
  toLat: number;
  toLng: number;
  quantity?: number;
  note?: string | null;
};

/**
 * Fetch the most recent stored resource movements.
 */
export async function getResourceMovements(limit = 15): Promise<ResourceMovement[]> {
  try {
    const rows = await prisma.resourceMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    if (!rows.length) return [];
    return rows.map((m) => ({
      id: m.id,
      resourceId: m.resourceId,
      resourceName: m.resourceName,
      action: m.action,
      fromLabel: m.fromLabel,
      toLabel: m.toLabel,
      toLat: m.toLat,
      toLng: m.toLng,
      quantity: m.quantity,
      note: m.note,
      createdAt: m.createdAt.toISOString(),
    }));
  } catch (error: unknown) {
    console.error("[resources] movements unavailable", error);
    throw new Error("Resource movements are unavailable");
  }
}

/**
 * Record a resource movement (manual log / dispatch trail).
 */

/**
 * Record a resource movement (manual log / dispatch trail).
 */
export async function logResourceMovement(
  input: NewMovementInput,
): Promise<{ ok: boolean; id: string }> {
  const authError = await assertWriteAccess();
  if (authError) return { ok: false, id: "" };
  if (movementInputError(input)) return { ok: false, id: "" };
  try {
    const created = await prisma.resourceMovement.create({
      data: {
        resourceId: null,
        resourceName: sanitizeInput(input.resourceName).slice(0, 200),
        action: input.action,
        fromLabel: input.fromLabel ? sanitizeInput(input.fromLabel).slice(0, 200) : null,
        toLabel: sanitizeInput(input.toLabel).slice(0, 200),
        toLat: input.toLat,
        toLng: input.toLng,
        quantity: input.quantity!,
        note: input.note ? sanitizeInput(input.note).slice(0, 2000) : null,
      },
    });
    revalidatePath("/inventory");
    revalidatePath("/dispatch");
    return { ok: true, id: created.id };
  } catch (error: unknown) {
    console.error("[resources] movement could not be saved", error);
    return { ok: false, id: "" };
  }
}
