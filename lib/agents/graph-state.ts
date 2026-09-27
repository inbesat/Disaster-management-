import { Annotation } from "@langchain/langgraph";

// ---------------------------------------------------------------------
// lib/agents/graph-state.ts
// Strongly-typed LangGraph state for the emergency-response multi-agent
// graph. State flows predict → plan → allocate → approve → communicate →
// resolved, accumulating a chain-of-reasoning `logs` array and a set of
// resource allocations along the way.
//
// Fields:
//   incidentDetails     raw incident description from the requesting officer
//   riskLevel           SAFE | WATCH | HIGH | CRITICAL (after predictor)
//   evacuationPlan      drafted 48h evacuation route/plan (after planner)
//   resourceAllocations ordered deployments proposed by the allocator
//   status              lifecycle stage (predicting, planning, allocating,
//                       pending_approval, communicating, resolved)
//   logs                chain-of-reasoning audit trail (append-only)
// ---------------------------------------------------------------------

export const STATUS_VALUES = [
  "predicting",
  "planning",
  "allocating",
  "pending_approval",
  "communicating",
  "resolved",
  "conflict",
] as const;
export type IncidentStatus = (typeof STATUS_VALUES)[number];

export const RISK_LEVELS = ["SAFE", "WATCH", "HIGH", "CRITICAL"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export type ResourceAllocation = {
  resourceType: string;
  quantity: number;
  targetZone: string;
  eta?: string;
};

// Reducer for scalar fields — the last writer wins.
const overwrite = <T>(left: T, right: T): T => right ?? left;

/** Reducer for the append-only `logs` array. */
function appendLogs(left: string[], right: string[]): string[] {
  return left.concat(right);
}

/** Reducer for `availableInventory` — shallow merge per resource type. */
function mergeInventory(
  left: Record<string, number>,
  right: Record<string, number>,
): Record<string, number> {
  return { ...left, ...right };
}

export const EmergencyStateAnnotation = Annotation.Root({
  incidentDetails: Annotation<string>({
    reducer: overwrite,
    default: () => "",
  }),

  riskLevel: Annotation<string>({
    reducer: overwrite,
    default: () => "WATCH",
  }),

  evacuationPlan: Annotation<string>({
    reducer: overwrite,
    default: () => "",
  }),

  proposedAllocations: Annotation<ResourceAllocation[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  resourceAllocations: Annotation<ResourceAllocation[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),

  status: Annotation<string>({
    reducer: overwrite,
    default: () => "predicting" as IncidentStatus,
  }),

  logs: Annotation<string[]>({
    reducer: appendLogs,
    default: () => [],
  }),

  // --- Phase 16 · Step 10 conflict handling ---------------------------
  // Set by the Allocator when demand exceeds available inventory; non-null
  // means the graph stopped and manual command override is required.
  conflict: Annotation<string | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),

  // --- Agent configuration/tuning (Step 9) ---------------------------
  // Inventory snapshot the Allocator may draw from (resourceType -> count).
  availableInventory: Annotation<Record<string, number>>({
    reducer: mergeInventory,
    default: () => ({}),
  }),
  // Max % of that inventory the Allocator may use without approval.
  hoardingLimitPercent: Annotation<number>({
    reducer: overwrite,
    default: () => 100,
  }),
  // Bias toward escalating ambiguous data to a higher risk tier.
  predictorSensitivity: Annotation<number>({
    reducer: overwrite,
    default: () => 75,
  }),
});

// The inferred state shape used by every node.
export type EmergencyState = typeof EmergencyStateAnnotation.State;

export type EmergencyGraphInput = { incidentDetails: string } & Partial<EmergencyState>;

/** Convenience factory for starting a new emergency resolution run. */
export function createInitialState(
  incidentDetails: string,
  partial: Partial<EmergencyState> = {},
): EmergencyGraphInput {
  return { incidentDetails, ...partial };
}
