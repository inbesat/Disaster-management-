import { StateGraph, START, END } from "@langchain/langgraph";
import { EmergencyStateAnnotation } from "@/lib/agents/graph-state";
import { predictorNode, plannerNode } from "@/lib/agents/nodes/intelligence-nodes";
import { allocatorNode, validatorNode } from "@/lib/agents/nodes/action-nodes";

// ---------------------------------------------------------------------
// lib/agents/graph.ts
// Compiled multi-agent graph:
//
//   START → predictorNode → plannerNode → allocatorNode → validatorNode → END
//
// Stops at `pending_approval` (Human-in-the-Loop). The `communicatorNode` is
// run externally after a commander approves. We avoid a checkpointer here and
// fold the authoritative final state from the streamed per-node updates (see
// foldFinalState), keeping the orchestration endpoint lightweight.
// ---------------------------------------------------------------------

export function buildGraph() {
  const builder = new StateGraph(EmergencyStateAnnotation)
    .addNode("predictor", predictorNode)
    .addNode("planner", plannerNode)
    .addNode("allocator", allocatorNode)
    .addNode("validator", validatorNode)
    .addEdge(START, "predictor")
    .addEdge("predictor", "planner")
    .addEdge("planner", "allocator")
    .addEdge("allocator", "validator")
    .addEdge("validator", END);
  return builder.compile();
}

export type CompiledEmergencyGraph = Awaited<ReturnType<typeof buildGraph>>;

let shared: CompiledEmergencyGraph | null = null;

export function getEmergencyGraph(): CompiledEmergencyGraph {
  if (!shared) shared = buildGraph();
  return shared;
}

export type FinalStateShape = {
  incidentDetails: string;
  riskLevel: string;
  evacuationPlan: string;
  resourceAllocations: unknown[];
  status: string;
  logs: string[];
  conflict: string | null;
};

/**
 * Fold the per-node update stream back into a single authoritative state,
 * mirroring the graph's reducers: scalars are last-writer-wins, `logs` and
 * `resourceAllocations` arrays are appended in node order.
 */
export function foldFinalState(
  steps: Array<{ node: string; update: Record<string, unknown> }>,
  incidentDetails: string,
): FinalStateShape {
  const final: FinalStateShape = {
    incidentDetails,
    riskLevel: "WATCH",
    evacuationPlan: "",
    resourceAllocations: [],
    status: "predicting",
    logs: [],
    conflict: null,
  };

  for (const { update } of steps) {
    const partial = update as Partial<FinalStateShape>;
    if (typeof partial.incidentDetails === "string")
      final.incidentDetails = partial.incidentDetails;
    if (typeof partial.riskLevel === "string") final.riskLevel = partial.riskLevel;
    if (typeof partial.evacuationPlan === "string")
      final.evacuationPlan = partial.evacuationPlan;
    if (typeof partial.status === "string") final.status = partial.status;
    if (partial.conflict !== undefined) final.conflict = partial.conflict;
    if (Array.isArray(partial.logs)) final.logs.push(...partial.logs);
    if (Array.isArray(partial.resourceAllocations)) {
      final.resourceAllocations = partial.resourceAllocations;
    }
  }

  return final;
}
