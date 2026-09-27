from pathlib import Path
p=Path('scripts/smoke-agents.ts');s=p.read_text().replace('    resourceAllocations: s.resourceAllocations as never,','    proposedAllocations: [],\n    resourceAllocations: s.resourceAllocations as never,');p.write_text(s)
p=Path('hooks/useDisasterChat.ts');s=p.read_text().replace('.filter((m) => m.role === "user" || m.role === "assistant")','.filter((m) => m.role === "user" || m.role === "assistant").slice(-20)');p.write_text(s)
Path('lib/agents/nodes/action-nodes.test.ts').write_text('''import { describe, it, expect } from "vitest";
import { allocatorNode } from "./action-nodes";
import type { EmergencyState } from "../graph-state";
const base: EmergencyState = { incidentDetails:"Flood", riskLevel:"HIGH", evacuationPlan:"Draft", proposedAllocations:[], resourceAllocations:[], status:"allocating", logs:[], conflict:null, availableInventory:{boats:10}, hoardingLimitPercent:50, predictorSensitivity:75 };
describe("inventory allocation limits", () => {
  it("applies the percentage cap across repeated resource entries", async () => {
    const result=await allocatorNode({...base,proposedAllocations:[{resourceType:"boats",quantity:4,targetZone:"A"},{resourceType:"boats",quantity:4,targetZone:"B"}]});
    expect(result.resourceAllocations?.map(item=>item.quantity)).toEqual([4,1]);
    expect(result.status).toBe("conflict");
  });
  it("honors zero allocation and requires verified inventory", async () => {
    expect((await allocatorNode({...base,hoardingLimitPercent:0,proposedAllocations:[{resourceType:"boats",quantity:1,targetZone:"A"}]})).resourceAllocations?.[0].quantity).toBe(0);
    expect((await allocatorNode({...base,availableInventory:{}})).status).toBe("conflict");
  });
});
''')
print('Updated graph fixture and added cumulative allocation tests.')
