import InventoryProvider from "@/components/dashboard/InventoryProvider";
import InventoryWorkspace from "@/components/dashboard/InventoryWorkspace";
import { resolveDemoScope } from "@/lib/demo/scope";

export default function InventoryPage() {
  const scope = resolveDemoScope();
  const storageKey =
    scope.demo && scope.sessionId ? `safesphere:inventory:v1:${scope.sessionId}` : null;
  return (
    <InventoryProvider storageKey={storageKey}>
      <InventoryWorkspace demo={Boolean(storageKey)} />
    </InventoryProvider>
  );
}
