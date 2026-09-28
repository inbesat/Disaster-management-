import { describe, expect, it } from "vitest";
import { demoInventoryStore } from "./demo-store";
import { inventoryChartData, resourceInputError, movementInputError } from "./model";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
const stock = {
  name: "Response truck",
  category: "vehicle",
  quantity: 4,
  lat: 0,
  lng: 0,
  unit: "vehicles",
  depotName: "Depot A",
  status: "maintenance",
};

describe("editable inventory", () => {
  it("persists additions, edits, deletion and zero coordinates across store instances", async () => {
    const storage = memoryStorage();
    const first = demoInventoryStore(storage, "one");
    const initial = await first.getInventory();
    const added = await first.addResource(stock);
    const reopened = demoInventoryStore(storage, "one");
    expect(await reopened.getInventory()).toHaveLength(initial.length + 1);
    expect((await reopened.getInventory())[0]).toMatchObject(stock);
    await reopened.updateResource({
      ...stock,
      id: added.id,
      status: "retired",
      unit: "",
      depotName: "",
    });
    expect((await first.getInventory())[0]).toMatchObject({
      status: "retired",
      unit: null,
      depotName: null,
    });
    expect(await reopened.deleteResource(added.id)).toBe(true);
    expect(await first.getInventory()).toHaveLength(initial.length);
  });
  it("isolates sessions and does not restore samples after all rows are removed", async () => {
    const storage = memoryStorage(),
      first = demoInventoryStore(storage, "one");
    for (const row of await first.getInventory()) await first.deleteResource(row.id);
    expect(await demoInventoryStore(storage, "one").getInventory()).toEqual([]);
    expect(
      (await demoInventoryStore(storage, "two").getInventory()).length,
    ).toBeGreaterThan(0);
  });
  it("imports all fields atomically and rejects invalid quantities", async () => {
    const store = demoInventoryStore(memoryStorage(), "test");
    const initial = await store.getInventory();
    await expect(
      store.bulkImportResources([stock, { ...stock, quantity: -1 }]),
    ).rejects.toThrow();
    expect(await store.getInventory()).toEqual(initial);
    await store.bulkImportResources([stock]);
    expect((await store.getInventory())[0]).toMatchObject(stock);
    expect(resourceInputError({ ...stock, quantity: 1.5 })).toBeTruthy();
    expect(resourceInputError({ ...stock, lat: 91 })).toBeTruthy();
  });
  it("does not report success when browser storage fails", async () => {
    const storage = memoryStorage(),
      store = demoInventoryStore(storage, "test");
    await store.getInventory();
    storage.setItem = () => {
      throw new Error("Quota exceeded");
    };
    await expect(store.addResource(stock)).rejects.toThrow("Quota exceeded");
  });
  it("records movements with valid zero coordinates and validates actions", async () => {
    const storage = memoryStorage(),
      store = demoInventoryStore(storage, "test");
    const input = {
      resourceName: "Water",
      action: "delivered",
      toLabel: "Equator depot",
      toLat: 0,
      toLng: 0,
      quantity: 5,
    };
    await store.logResourceMovement(input);
    expect(
      (await demoInventoryStore(storage, "test").getResourceMovements())[0],
    ).toMatchObject(input);
    expect(movementInputError({ ...input, quantity: 0 })).toBeTruthy();
    expect(movementInputError({ ...input, action: "unknown" })).toBeTruthy();
    expect(movementInputError({ ...input, toLng: Infinity })).toBeTruthy();
  });
  it("keeps chart totals consistent across availability states", () => {
    const { pie, bars } = inventoryChartData([
      { category: "vehicle", quantity: 5, status: "available" },
      { category: "vehicle", quantity: 3, status: "deployed" },
      { category: "vehicle", quantity: 2, status: "retired" },
      { category: "water", quantity: 0, status: "available" },
    ]);
    expect(pie).toEqual([{ name: "Vehicle", value: 10 }]);
    expect(bars[0]).toMatchObject({ available: 5, deployed: 3, retired: 2 });
  });
});
