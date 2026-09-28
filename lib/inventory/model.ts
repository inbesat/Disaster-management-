import type { NewResourceInput, NewMovementInput } from "@/app/actions/resources";

export const RESOURCE_CATEGORIES = [
  "boat",
  "food",
  "medical",
  "water",
  "personnel",
  "vehicle",
  "shelter",
  "communication",
  "power",
  "other",
];
export const RESOURCE_STATUSES = ["available", "deployed", "maintenance", "retired"];
export const MOVEMENT_ACTIONS = ["dispatched", "delivered", "returned", "adjusted"];

export function movementInputError(input: NewMovementInput): string | null {
  if (
    typeof input.resourceName !== "string" ||
    !input.resourceName.trim() ||
    typeof input.toLabel !== "string" ||
    !input.toLabel.trim()
  )
    return "Resource and destination are required.";
  if (!MOVEMENT_ACTIONS.includes(input.action)) return "Choose a valid movement action.";
  if (
    !Number.isFinite(input.toLat) ||
    Math.abs(input.toLat) > 90 ||
    !Number.isFinite(input.toLng) ||
    Math.abs(input.toLng) > 180
  )
    return "Enter valid destination coordinates.";
  if (
    !Number.isInteger(input.quantity) ||
    (input.quantity ?? 0) < 1 ||
    (input.quantity ?? 0) > 1_000_000
  )
    return "Quantity must be a whole number between 1 and 1,000,000.";
  return null;
}

export function resourceInputError(input: NewResourceInput): string | null {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 200)
    return "Enter a resource name of 1–200 characters.";
  if (!RESOURCE_CATEGORIES.includes(input.category))
    return "Choose a valid resource category.";
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 0 ||
    input.quantity > 1_000_000
  )
    return "Quantity must be a whole number between 0 and 1,000,000.";
  if (input.status && !RESOURCE_STATUSES.includes(input.status))
    return "Choose a valid resource status.";
  if (
    input.lat !== undefined &&
    (!Number.isFinite(input.lat) || Math.abs(input.lat) > 90)
  )
    return "Latitude must be between -90 and 90.";
  if (
    input.lng !== undefined &&
    (!Number.isFinite(input.lng) || Math.abs(input.lng) > 180)
  )
    return "Longitude must be between -180 and 180.";
  return null;
}

export function inventoryChartData(
  resources: { category: string; quantity: number; status: string }[],
) {
  const buckets = new Map<
    string,
    {
      category: string;
      available: number;
      deployed: number;
      maintenance: number;
      retired: number;
    }
  >();
  for (const r of resources) {
    if (!Number.isFinite(r.quantity) || r.quantity <= 0) continue;
    const bucket = buckets.get(r.category) ?? {
      category: r.category,
      available: 0,
      deployed: 0,
      maintenance: 0,
      retired: 0,
    };
    const status = RESOURCE_STATUSES.includes(r.status)
      ? (r.status as "available" | "deployed" | "maintenance" | "retired")
      : "available";
    bucket[status] += r.quantity;
    buckets.set(r.category, bucket);
  }
  const bars = [...buckets.values()].map((b) => ({
    ...b,
    category: b.category.charAt(0).toUpperCase() + b.category.slice(1),
  }));
  const pie = bars.map((b) => ({
    name: b.category,
    value: b.available + b.deployed + b.maintenance + b.retired,
  }));
  return { bars, pie };
}
