import type {
  InventoryResource,
  ResourceMovement,
  NewResourceInput,
  UpdateResourceInput,
  CsvResourceRow,
  NewMovementInput,
} from "@/app/actions/resources";
import { resourceInputError, movementInputError } from "./model";

type Snapshot = {
  version: 1;
  resources: InventoryResource[];
  movements: ResourceMovement[];
};
type StorageLike = Pick<Storage, "getItem" | "setItem">;

function initialInventory(): Snapshot {
  const stock: [string, string, number, string, string][] = [
    ["Rescue boats", "boat", 30, "boats", "available"],
    ["Dispatched rescue boats", "boat", 15, "boats", "deployed"],
    ["Medical kits", "medical", 78, "kits", "available"],
    ["Food supplies", "food", 120, "packs", "available"],
    ["Dispatched food supplies", "food", 80, "packs", "deployed"],
    ["Drinking water", "water", 150, "containers", "available"],
    ["Shelter tents", "shelter", 95, "tents", "available"],
    ["Response vehicles", "vehicle", 42, "vehicles", "available"],
    ["Vehicles under repair", "vehicle", 20, "vehicles", "maintenance"],
    ["Field radios", "communication", 32, "radios", "available"],
    ["Generators", "power", 12, "generators", "available"],
    ["Rescue personnel", "personnel", 45, "people", "deployed"],
  ];
  return {
    version: 1,
    movements: [],
    resources: stock.map(([name, category, quantity, unit, status], i) => ({
      id: `sample-${i}`,
      name,
      category,
      quantity,
      unit,
      status,
      lat: 25.61,
      lng: 85.14,
      depotName: "Patna sample depot",
    })),
  };
}

/** Browser-only demo inventory. Storage errors propagate so no unsaved success is shown. */
export function demoInventoryStore(storage: StorageLike, key: string) {
  function read(): Snapshot {
    const raw = storage.getItem(key);
    if (!raw) {
      const data = initialInventory();
      write(data);
      return data;
    }
    const data = JSON.parse(raw) as Snapshot;
    if (
      data.version !== 1 ||
      !Array.isArray(data.resources) ||
      !Array.isArray(data.movements)
    )
      throw new Error(
        "Saved inventory could not be read. Export a backup before clearing site data.",
      );
    return data;
  }
  function write(data: Snapshot) {
    storage.setItem(key, JSON.stringify(data));
  }
  function row(input: NewResourceInput, id = crypto.randomUUID()): InventoryResource {
    const error = resourceInputError(input);
    if (error) throw new Error(error);
    return {
      id,
      name: input.name.trim(),
      category: input.category,
      quantity: input.quantity,
      unit: input.unit?.trim() || null,
      status: input.status || "available",
      lat: input.lat ?? 25.61,
      lng: input.lng ?? 85.14,
      depotName: input.depotName?.trim() || null,
      createdAt: new Date().toISOString(),
    };
  }
  return {
    getInventory: async () => read().resources,
    addResource: async (input: NewResourceInput) => {
      const data = read(),
        added = row(input);
      write({ ...data, resources: [added, ...data.resources] });
      return { ok: true, id: added.id };
    },
    updateResource: async (input: UpdateResourceInput) => {
      const data = read();
      if (!data.resources.some((r) => r.id === input.id)) return false;
      const updated = row(input, input.id);
      write({
        ...data,
        resources: data.resources.map((r) => (r.id === input.id ? updated : r)),
      });
      return true;
    },
    deleteResource: async (id: string) => {
      const data = read();
      if (!data.resources.some((r) => r.id === id)) return false;
      write({ ...data, resources: data.resources.filter((r) => r.id !== id) });
      return true;
    },
    bulkImportResources: async (rows: CsvResourceRow[]) => {
      if (!rows.length) return { ok: false, count: 0 };
      const additions = rows.map((r) => row(r));
      const data = read();
      write({ ...data, resources: [...additions, ...data.resources] });
      return { ok: true, count: additions.length };
    },
    getResourceMovements: async (limit = 15) => read().movements.slice(0, limit),
    logResourceMovement: async (input: NewMovementInput) => {
      const error = movementInputError(input);
      if (error) throw new Error(error);
      const data = read();
      const movement: ResourceMovement = {
        ...input,
        id: crypto.randomUUID(),
        resourceId: null,
        fromLabel: input.fromLabel || null,
        note: input.note || null,
        quantity: input.quantity!,
        createdAt: new Date().toISOString(),
      };
      write({ ...data, movements: [movement, ...data.movements] });
      return { ok: true, id: movement.id };
    },
  };
}
