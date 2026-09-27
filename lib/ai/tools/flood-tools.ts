import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/server/prisma";
export const getFloodPrediction = tool({
  description:
    "Reads recent experimental flood model estimates tagged with this district; reports unavailable when no recent local prediction exists.",
  inputSchema: z.object({ district: z.string().min(1).max(80) }),
  execute: async ({ district }) => {
    try {
      const latest = await prisma.floodPrediction.findFirst({
        where: {
          isDemo: false,
          rawModelOutput: { path: ["metadata", "district"], equals: district },
          predictionTimestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { predictionTimestamp: "desc" },
        select: { riskLevel: true, confidenceScore: true, predictionTimestamp: true },
      });
      return {
        district,
        source: latest ? "database" : "unavailable",
        prediction: latest,
        message: latest
          ? "Model estimate; verify with local authorities."
          : "No current verified prediction for this district. Do not invent rainfall or risk.",
      };
    } catch {
      return { district, prediction: null, source: "unavailable" };
    }
  },
});
export const floodTools = { getFloodPrediction };
