"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  getInventory,
  addResource,
  updateResource,
  deleteResource,
  bulkImportResources,
  getResourceMovements,
  logResourceMovement,
} from "@/app/actions/resources";
import { demoInventoryStore } from "@/lib/inventory/demo-store";

const serverActions = {
  getInventory,
  addResource,
  updateResource,
  deleteResource,
  bulkImportResources,
  getResourceMovements,
  logResourceMovement,
};
const InventoryContext = createContext(serverActions);
export const useInventoryActions = () => useContext(InventoryContext);

export default function InventoryProvider({
  storageKey,
  children,
}: {
  storageKey: string | null;
  children: ReactNode;
}) {
  const actions = useMemo(
    () =>
      storageKey
        ? demoInventoryStore(
            {
              getItem: (key) => window.localStorage.getItem(key),
              setItem: (key, value) => window.localStorage.setItem(key, value),
            },
            storageKey,
          )
        : serverActions,
    [storageKey],
  );
  return (
    <InventoryContext.Provider value={actions}>{children}</InventoryContext.Provider>
  );
}
