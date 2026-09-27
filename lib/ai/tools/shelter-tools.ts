import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/server/prisma";

export type ShelterSnapshot = {
  id: string;
  name: string;
  district: string;
  capacity: number;
  currentOccupancy: number;
  status: string;
  facilities: Record<string, boolean> | null;
};

export const getShelterStatus = tool({
  description:
    "Fetches current occupancy and capacity of shelters in a specific district.",
  inputSchema: z.object({
    district: z.string().describe("The district to look up shelter availability in."),
  }),
  execute: async ({ district }) => {
    try {
      const rows = await prisma.shelter.findMany({
        where: { district, isDemo: false },
        orderBy: { currentOccupancy: "asc" },
        select: {
          id: true,
          name: true,
          district: true,
          capacity: true,
          currentOccupancy: true,
          status: true,
          facilities: true,
        },
      });

      if (!rows.length)
        return {
          district,
          shelters: [],
          source: "database",
          message: "No verified shelters found.",
        };

      return {
        district,
        shelters: rows.map((row) => ({
          ...row,
          facilities: (row.facilities as Record<string, boolean> | null) ?? null,
        })),
      };
    } catch {
      // DB not reachable (or empty) -> return realistic demo data so the
      // planner can keep reasoning about evacuation options.
      return {
        district,
        shelters: [],
        source: "unavailable",
        error:
          "Shelter database unavailable. Do not invent shelter locations or capacity.",
      };
    }
  },
});

export const emergencyPlanTools = {
  getShelterStatus,
};
