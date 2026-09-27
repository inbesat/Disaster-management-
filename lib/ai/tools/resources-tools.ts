import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/server/prisma";

export type ResourceSnapshot = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string | null;
  status: string;
  depotName: string | null;
};

export const getResourceInventory = tool({
  description:
    "Fetches the current inventory of response resources (boats, food, medical, personnel, water, vehicles) and their availability status for a district.",
  inputSchema: z.object({
    district: z.string().describe("The district to look up resource inventory for."),
    category: z
      .enum([
        "boat",
        "food",
        "medical",
        "water",
        "personnel",
        "vehicle",
        "communication",
        "power",
        "other",
      ])
      .optional()
      .describe("Optionally restrict the inventory to a single resource category."),
  }),
  execute: async ({ district, category }) => {
    try {
      // Resources have coordinates rather than a district column. Restrict to
      // verified depots whose labels explicitly identify the requested district.
      const rows = await prisma.resource.findMany({
        where: {
          isDemo: false,
          depotName: { contains: district, mode: "insensitive" },
          ...(category ? { category } : {}),
        },
        select: {
          id: true,
          name: true,
          category: true,
          quantity: true,
          unit: true,
          status: true,
          depotName: true,
        },
        take: 50,
      });
      return {
        district,
        resources: rows,
        source: "database",
        coverage:
          "District-labelled depots only; unassigned depots require operator review.",
      };
    } catch {
      return {
        district,
        resources: [],
        source: "unavailable",
        error: "Inventory unavailable. Do not assume stock is available.",
      };
    }
  },
});
export const resourceInventoryTools = { getResourceInventory };
