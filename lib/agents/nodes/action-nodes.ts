import type { EmergencyState } from "@/lib/agents/graph-state";

export async function allocatorNode(
  state: EmergencyState,
): Promise<Partial<EmergencyState>> {
  if (state.conflict) return {};
  const inventory = state.availableInventory ?? {};
  const limit = Math.max(0, Math.min(100, state.hoardingLimitPercent ?? 100));
  const remaining = Object.fromEntries(
    Object.entries(inventory).map(([key, value]) => [
      key,
      Math.max(0, Math.floor((value * limit) / 100)),
    ]),
  );
  const problems: string[] = [];
  const resourceAllocations = (state.proposedAllocations ?? []).map((item) => {
    const available = remaining[item.resourceType];
    const allowance = Number.isFinite(available) ? Math.max(0, available) : 0;
    if (item.quantity > allowance)
      problems.push(
        `${item.resourceType}: requested ${item.quantity}, verified allowance ${allowance}`,
      );
    const quantity = Math.min(item.quantity, allowance);
    remaining[item.resourceType] = Math.max(0, (available || 0) - quantity);
    return { ...item, quantity };
  });
  if (!Object.keys(inventory).length)
    problems.push("No inventory snapshot supplied; availability is unverified");
  return {
    resourceAllocations,
    status: problems.length ? "conflict" : "pending_approval",
    conflict: problems.length ? problems.join("; ") : null,
    logs: [
      problems.length
        ? `Allocator: review required. ${problems.join("; ")}`
        : "Allocator: proposed quantities checked against supplied inventory; nothing dispatched.",
    ],
  };
}
export async function validatorNode(
  state: EmergencyState,
): Promise<Partial<EmergencyState>> {
  if (state.conflict)
    return { logs: ["Validator: holding for human review of the reported conflict."] };
  if (/full shelter|at capacity|over capacity|no space left/i.test(state.incidentDetails))
    return {
      status: "conflict",
      conflict: "Reported shelter capacity conflict requires review.",
      logs: [
        "Validator: reported capacity problem; confirm an alternative before approval.",
      ],
    };
  return {
    status: "pending_approval",
    logs: [
      "Validator: quantity checks complete. Route safety and shelter capacity require verification by a commander.",
    ],
  };
}
/** This stage does not claim delivery without receipts from a broadcast service. */
export async function communicatorNode(
  _state: EmergencyState,
): Promise<Partial<EmergencyState>> {
  return {
    status: "pending_approval",
    logs: [
      "Communicator: draft ready. Use the approved broadcast flow to send and track delivery.",
    ],
  };
}
export const ALLOCATOR_DELAY_MS = 0;
export const VALIDATOR_DELAY_MS = 0;
export const COMMUNICATOR_DELAY_MS = 0;
