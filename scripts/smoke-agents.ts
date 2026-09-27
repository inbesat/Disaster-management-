import { createInitialState } from "../lib/agents/graph-state";
import { getEmergencyGraph, foldFinalState } from "../lib/agents/graph";
import { communicatorNode } from "../lib/agents/nodes/action-nodes";

async function main() {
  const graph = getEmergencyGraph();

  console.log("Running multi-agent graph...");
  const worker = await graph.stream(
    createInitialState("Heavy rainfall, river overflowing near KatQ ward", {
      status: "predicting",
    }),
    { recursionLimit: 10 },
  );

  const steps: Array<{ node: string; update: Record<string, unknown> }> = [];
  for await (const update of worker) {
    for (const [node, value] of Object.entries(update)) {
      const v = value as { status?: string; riskLevel?: string };
      steps.push({ node, update: (value ?? {}) as Record<string, unknown> });
      console.log(`  → ${node}  status=${v.status ?? "-"} risk=${v.riskLevel ?? "-"}`);
    }
  }

  const s = foldFinalState(steps, "Heavy rainfall, river overflowing near KatQ ward");

  console.log("\n=== FINAL STATE (paused for approval) ===");
  console.log("riskLevel:", s.riskLevel);
  console.log("status:", s.status);
  console.log("logs:");
  s.logs.forEach((l) => console.log("  -", l));
  console.log("allocations:", s.resourceAllocations.length);
  console.log("plan preview:", s.evacuationPlan.slice(0, 60) + "…");

  console.log("\n=== Running communicator (after approval) ===");
  const comm = await communicatorNode({
    incidentDetails: "river breach",
    riskLevel: s.riskLevel,
    evacuationPlan: s.evacuationPlan,
    proposedAllocations: [],
    resourceAllocations: s.resourceAllocations as never,
    status: s.status,
    logs: s.logs,
    conflict: s.conflict,
    availableInventory: {},
    hoardingLimitPercent: 100,
    predictorSensitivity: 75,
  });
  console.log("communicator status:", comm.status);
  console.log("communicator log:", comm.logs?.[0]);
  console.log("\nSMOKE PASS ✓");
}

main().catch((e) => {
  console.error("SMOKE FAIL", e);
  process.exit(1);
});
