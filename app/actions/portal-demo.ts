"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/prisma";
import { approvedResponderIdentity, responderIdentity } from "@/lib/portal/identity";
import { demoWhere } from "@/lib/demo/scope";
import { CLAIM_LEASE_MS } from "@/lib/portal/workflow";

const WAVE = [
  {
    lat: 25.615,
    lng: 85.143,
    reportType: "flooding",
    rawText: "[Demo wave] Water rising on Station Road; cars turning back.",
  },
  {
    lat: 25.607,
    lng: 85.135,
    reportType: "road_blocked",
    rawText: "[Demo wave] Road blocked by debris near Gandhi Maidan.",
  },
  {
    lat: 25.625,
    lng: 85.152,
    reportType: "rescue",
    rawText: "[Demo wave] Two people need rescue near the river bank.",
  },
  {
    lat: 25.598,
    lng: 85.125,
    reportType: "shelter_needed",
    rawText: "[Demo wave] Families requesting shelter near Patna Junction.",
  },
  {
    lat: 25.632,
    lng: 85.165,
    reportType: "flooding",
    rawText: "[Demo wave] Water entering ground-floor homes in Rajendra Nagar.",
  },
  {
    lat: 25.603,
    lng: 85.158,
    reportType: "road_blocked",
    rawText: "[Demo wave] Underpass appears impassable to vehicles.",
  },
  {
    lat: 25.618,
    lng: 85.125,
    reportType: "rescue",
    rawText: "[Demo wave] Elderly resident asking for evacuation help.",
  },
  {
    lat: 25.592,
    lng: 85.144,
    reportType: "flooding",
    rawText: "[Demo wave] Rapid waterlogging reported around the market.",
  },
] as const;

export async function seedReportWave(): Promise<{ ok: boolean; message: string }> {
  const actor = await responderIdentity();
  if (
    !actor ||
    !actor.scope.demo ||
    !actor.scope.sessionId ||
    !["district_admin", "super_admin"].includes(actor.role)
  )
    return { ok: false, message: "Government demo session required." };
  try {
    const existing = await prisma.crowdsourcedReport.count({
      where: { ...demoWhere(actor.scope), rawText: { startsWith: "[Demo wave]" } },
    });
    if (existing > 0)
      return {
        ok: false,
        message:
          "This demo wave already exists. Use the existing reports or reset the scenario.",
      };
    await prisma.$transaction(async (tx) => {
      await tx.crowdsourcedReport.createMany({
        data: WAVE.map((r, i) => ({
          ...r,
          source: "social",
          isDemo: true,
          sessionId: actor.scope.sessionId,
          confidenceScore: 0.5,
          verificationStatus: "unverified",
          priority:
            r.reportType === "rescue" ? "critical" : i % 3 === 0 ? "high" : "normal",
        })),
      });
      const saved = await tx.crowdsourcedReport.findMany({
        where: { ...demoWhere(actor.scope), rawText: { startsWith: "[Demo wave]" } },
        select: { id: true },
      });
      await tx.reportVerificationEvent.createMany({
        data: saved.map((r) => ({
          reportId: r.id,
          actorId: actor.id,
          action: "submitted",
          note: "Labeled demo scenario report.",
        })),
      });
    });
    revalidatePath("/portal");
    revalidatePath("/portal/admin");
    revalidatePath("/gov/dashboard");
    return {
      ok: true,
      message: "Eight labeled demo reports were added to this isolated session.",
    };
  } catch {
    return {
      ok: false,
      message: "Demo wave could not be saved. Check the database and migration.",
    };
  }
}

export async function resetReportWave(): Promise<{ ok: boolean; message: string }> {
  const actor = await responderIdentity();
  if (
    !actor ||
    !actor.scope.demo ||
    !["district_admin", "super_admin"].includes(actor.role)
  )
    return { ok: false, message: "Government demo session required." };
  try {
    const removed = await prisma.crowdsourcedReport.deleteMany({
      where: {
        ...demoWhere(actor.scope),
        rawText: { startsWith: "[Demo wave]" },
        source: "social",
      },
    });
    revalidatePath("/portal");
    revalidatePath("/portal/admin");
    revalidatePath("/gov/dashboard");
    return {
      ok: true,
      message: `${removed.count} labeled demo reports removed from this session.`,
    };
  } catch {
    return { ok: false, message: "Demo wave could not be reset." };
  }
}

export async function demoCheckInReport(
  reportId: string,
): Promise<{ ok: boolean; message: string }> {
  const actor = await approvedResponderIdentity();
  if (!actor || !actor.scope.demo)
    return { ok: false, message: "A demo responder session is required." };
  try {
    const changed = await prisma.$transaction(async (tx) => {
      const result = await tx.crowdsourcedReport.updateMany({
        where: {
          id: reportId,
          ...demoWhere(actor.scope),
          assignedResponderId: actor.id,
          workflowStatus: "claimed",
          claimedAt: { gt: new Date(Date.now() - CLAIM_LEASE_MS) },
        },
        data: { workflowStatus: "checked_in", checkedInAt: new Date() },
      });
      if (result.count !== 1) return false;
      await tx.reportVerificationEvent.create({
        data: {
          reportId,
          actorId: actor.id,
          action: "checked_in",
          note: "Demo simulated arrival; no device GPS was verified.",
        },
      });
      return true;
    });
    if (!changed) return { ok: false, message: "Claim this demo report first." };
    revalidatePath(`/portal/reports/${reportId}`);
    revalidatePath("/portal");
    return {
      ok: true,
      message: "Demo arrival simulated. No real GPS check was performed.",
    };
  } catch {
    return { ok: false, message: "Demo arrival could not be saved." };
  }
}
