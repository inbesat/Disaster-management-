"use server";

import { randomUUID, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/prisma";
import { approvedResponderIdentity, responderIdentity } from "@/lib/portal/identity";
import { demoWhere } from "@/lib/demo/scope";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { CHECK_IN_RADIUS_KM, CLAIM_LEASE_MS, distanceKm } from "@/lib/portal/workflow";

type Result = { ok: boolean; message: string };
const fail = (message: string): Result => ({ ok: false, message });
const clean = (value: FormDataEntryValue | null, max: number) =>
  String(value ?? "")
    .trim()
    .slice(0, max);

export async function saveResponderProfile(form: FormData): Promise<Result> {
  const actor = await responderIdentity();
  if (!actor) return fail("Sign in as a field responder first.");
  const name = clean(form.get("name"), 100);
  const organization = clean(form.get("organization"), 120);
  const district = clean(form.get("district"), 100);
  const organizationType = clean(form.get("organizationType"), 30);
  const phone = clean(form.get("phone"), 25);
  const designation = clean(form.get("designation"), 100);
  const badgeId = clean(form.get("badgeId"), 100);
  const serviceRadiusKm = Math.min(
    200,
    Math.max(1, Math.trunc(Number(form.get("serviceRadiusKm")) || 20)),
  );
  if (
    !name ||
    !organization ||
    !district ||
    ![
      "ngo",
      "police",
      "ndrf",
      "sdrf",
      "medical",
      "civil_defence",
      "volunteer",
      "other",
    ].includes(organizationType)
  )
    return fail("Complete your name, organization, type, and district.");
  try {
    await prisma.responderProfile.upsert({
      where: { id: actor.id },
      create: {
        id: actor.id,
        name,
        organization,
        organizationType,
        district,
        phone,
        designation,
        badgeId,
        serviceRadiusKm,
        approvalStatus: "pending",
      },
      update: {
        name,
        organization,
        organizationType,
        district,
        phone,
        designation,
        badgeId,
        serviceRadiusKm,
      },
    });
    revalidatePath("/portal");
    return {
      ok: true,
      message:
        "Profile submitted. A government admin must approve it before you can claim reports.",
    };
  } catch {
    return fail(
      "Profile could not be saved. Check the database connection and migration.",
    );
  }
}

export async function setResponderApproval(
  id: string,
  decision: "approved" | "rejected",
): Promise<Result> {
  const actor = await responderIdentity();
  if (!actor || !["district_admin", "super_admin"].includes(actor.role))
    return fail("Government admin access required.");
  try {
    const changed = await prisma.responderProfile.updateMany({
      where: actor.scope.demo
        ? { id: id === `demo:${actor.scope.sessionId}` ? id : "" }
        : { id, NOT: { id: { startsWith: "demo:" } } },
      data: { approvalStatus: decision },
    });
    if (changed.count !== 1) return fail("Responder profile not found in this session.");
    revalidatePath("/portal/admin");
    revalidatePath("/portal");
    return { ok: true, message: `Responder ${decision}.` };
  } catch {
    return fail("Could not update responder approval.");
  }
}

export async function setResponderAvailability(
  availability: "available" | "unavailable",
): Promise<Result> {
  const actor = await responderIdentity();
  if (!actor) return fail("Responder sign-in required.");
  try {
    if (availability === "available") {
      const active = await prisma.crowdsourcedReport.count({
        where: {
          ...demoWhere(actor.scope),
          assignedResponderId: actor.id,
          OR: [
            { workflowStatus: "checked_in" },
            {
              workflowStatus: "claimed",
              claimedAt: { gt: new Date(Date.now() - CLAIM_LEASE_MS) },
            },
          ],
        },
      });
      if (active > 0)
        return fail("Finish your active verification before marking yourself available.");
    }
    await prisma.responderProfile.update({
      where: { id: actor.id },
      data: { availability },
    });
    revalidatePath("/portal");
    return { ok: true, message: `Marked ${availability}.` };
  } catch {
    return fail("Could not update availability.");
  }
}

export async function completeResponderTraining(): Promise<Result> {
  const actor = await responderIdentity();
  if (!actor) return fail("Responder sign-in required.");
  try {
    await prisma.responderProfile.update({
      where: { id: actor.id },
      data: { trainingCompletedAt: new Date() },
    });
    revalidatePath("/portal");
    revalidatePath("/portal/profile");
    return {
      ok: true,
      message: "Training acknowledged. Approval is still required before field work.",
    };
  } catch {
    return fail("Training acknowledgement could not be saved.");
  }
}

export async function setResponderTier(
  id: string,
  tier: "probation" | "approved" | "trusted",
): Promise<Result> {
  const actor = await responderIdentity();
  if (!actor || !["district_admin", "super_admin"].includes(actor.role))
    return fail("Government admin access required.");
  try {
    const changed = await prisma.responderProfile.updateMany({
      where: actor.scope.demo
        ? { id: id === `demo:${actor.scope.sessionId}` ? id : "" }
        : { id, NOT: { id: { startsWith: "demo:" } } },
      data: { tier },
    });
    if (changed.count !== 1) return fail("Responder profile not found in this session.");
    revalidatePath("/portal/admin");
    revalidatePath("/portal/profile");
    return {
      ok: true,
      message: `Tier set to ${tier}. Verify organization credentials before granting higher trust.`,
    };
  } catch {
    return fail("Tier could not be updated.");
  }
}

export async function claimReport(reportId: string): Promise<Result> {
  const actor = await responderIdentity();
  if (!actor) return fail("Responder sign-in required.");
  try {
    const profile = await prisma.responderProfile.findUnique({ where: { id: actor.id } });
    if (
      actor.role === "field_responder" &&
      (profile?.approvalStatus !== "approved" ||
        profile.availability !== "available" ||
        !profile.trainingCompletedAt)
    )
      return fail(
        "Approval, training, and available status are required before claiming reports.",
      );
    const scope = demoWhere(actor.scope);
    const active = await prisma.crowdsourcedReport.count({
      where: {
        ...scope,
        assignedResponderId: actor.id,
        workflowStatus: { in: ["claimed", "checked_in"] },
        OR: [
          { workflowStatus: "checked_in" },
          { claimedAt: { gt: new Date(Date.now() - CLAIM_LEASE_MS) } },
        ],
      },
    });
    if (active > 0)
      return fail("Finish your current verification before claiming another report.");
    const expiredBefore = new Date(Date.now() - CLAIM_LEASE_MS);
    const claimable = {
      OR: [
        { workflowStatus: "queued" },
        { workflowStatus: "claimed", claimedAt: { lte: expiredBefore } },
      ],
    };
    const target = await prisma.crowdsourcedReport.findFirst({
      where: { id: reportId, ...scope, ...claimable },
      select: {
        reportType: true,
        priorResponderId: true,
        assignedResponderId: true,
        workflowStatus: true,
      },
    });
    if (!target) return fail("Report is no longer in the queue.");
    if (target.priorResponderId === actor.id)
      return fail("A disputed report must be reviewed by a different responder.");
    if (
      actor.role === "field_responder" &&
      profile?.tier === "probation" &&
      target.reportType === "rescue"
    )
      return fail("Probation responders cannot claim critical rescue reports.");
    const updated = await prisma.$transaction(async (tx) => {
      const count = await tx.crowdsourcedReport.updateMany({
        where: {
          id: reportId,
          ...scope,
          ...claimable,
          verificationStatus: "unverified",
        },
        data: {
          workflowStatus: "claimed",
          assignedResponderId: actor.id,
          claimedAt: new Date(),
        },
      });
      if (count.count !== 1) return false;
      if (target.workflowStatus === "claimed" && target.assignedResponderId) {
        await tx.reportVerificationEvent.create({
          data: {
            reportId,
            actorId: "system",
            action: "released",
            note: "Claim expired after 45 minutes.",
          },
        });
        await tx.responderProfile.updateMany({
          where: { id: target.assignedResponderId },
          data: { availability: "available" },
        });
      }
      await tx.responderProfile.updateMany({
        where: { id: actor.id },
        data: { availability: "unavailable" },
      });
      await tx.reportVerificationEvent.create({
        data: { reportId, actorId: actor.id, action: "claimed" },
      });
      return true;
    });
    if (!updated) return fail("This report is no longer available to claim.");
    revalidatePath("/portal");
    revalidatePath(`/portal/reports/${reportId}`);
    revalidatePath("/gov/dashboard");
    return {
      ok: true,
      message: "Report claimed. Travel safely and check in at the scene.",
    };
  } catch {
    return fail("Claim failed. Check the database connection.");
  }
}

export async function checkInReport(
  reportId: string,
  lat: number,
  lng: number,
): Promise<Result> {
  const actor = await approvedResponderIdentity();
  if (!actor) return fail("Responder sign-in required.");
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return fail("A valid GPS position is required.");
  try {
    const report = await prisma.crowdsourcedReport.findFirst({
      where: {
        id: reportId,
        ...demoWhere(actor.scope),
        assignedResponderId: actor.id,
        workflowStatus: "claimed",
        claimedAt: { gt: new Date(Date.now() - CLAIM_LEASE_MS) },
      },
    });
    if (!report)
      return fail("This report is not assigned to you or has already moved on.");
    const distance = distanceKm(report.lat, report.lng, lat, lng);
    if (distance > CHECK_IN_RADIUS_KM)
      return fail(
        `You are about ${Math.round(distance * 1000)} m from the report. On-site check-in requires being within 100 m.`,
      );
    await prisma.$transaction(async (tx) => {
      const changed = await tx.crowdsourcedReport.updateMany({
        where: { id: reportId, assignedResponderId: actor.id, workflowStatus: "claimed" },
        data: { workflowStatus: "checked_in", checkedInAt: new Date() },
      });
      if (changed.count !== 1) throw new Error("Already checked in");
      await tx.reportVerificationEvent.create({
        data: { reportId, actorId: actor.id, action: "checked_in", lat, lng },
      });
    });
    revalidatePath(`/portal/reports/${reportId}`);
    revalidatePath("/portal");
    return {
      ok: true,
      message: "GPS check-in recorded. Add your observation and verdict.",
    };
  } catch {
    return fail("Check-in failed. Please refresh and try again.");
  }
}

async function uploadEvidence(
  file: File,
  reportId: string,
  actorId: string,
): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Evidence storage is not configured.");
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/svg+xml" ||
    file.size > 5 * 1024 * 1024 ||
    file.size === 0
  )
    throw new Error("Attach a JPG, PNG, or WebP image under 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(jpeg || png || webp)) throw new Error("The attachment is not a supported image.");
  const ext = jpeg ? "jpg" : png ? "png" : "webp";
  const path = `${reportId}/${createHash("sha256").update(actorId).digest("hex").slice(0, 16)}-${randomUUID()}.${ext}`;
  const client = createSupabaseAdmin(url, key, { auth: { persistSession: false } });
  const { error } = await client.storage.from("field-reports").upload(path, bytes, {
    contentType: jpeg ? "image/jpeg" : png ? "image/png" : "image/webp",
    upsert: false,
  });
  if (error)
    throw new Error("Evidence upload failed. Check the private field-reports bucket.");
  return path;
}

export async function submitFieldVerdict(
  reportId: string,
  form: FormData,
): Promise<Result> {
  const actor = await approvedResponderIdentity();
  if (!actor) return fail("Responder sign-in required.");
  const verdict = clean(form.get("verdict"), 20);
  const note = clean(form.get("note"), 2000);
  if (
    !["verified", "partially_true", "rejected", "escalated"].includes(verdict) ||
    note.length < 15
  )
    return fail(
      "Choose a verdict and describe your observation (at least 15 characters).",
    );
  const file = form.get("evidence");
  if (
    ["verified", "rejected"].includes(verdict) &&
    (!(file instanceof File) || file.size === 0)
  )
    return fail("An evidence photo is required to verify or reject a report.");
  const escalationReason = clean(form.get("escalationReason"), 80);
  if (
    verdict === "escalated" &&
    ![
      "people_trapped",
      "rescue_equipment",
      "medical_emergency",
      "road_impassable",
      "shelter_capacity",
    ].includes(escalationReason)
  )
    return fail("Choose an escalation reason.");
  const finalNote =
    verdict === "escalated" ? `${escalationReason.replaceAll("_", " ")}: ${note}` : note;
  try {
    const report = await prisma.crowdsourcedReport.findFirst({
      where: {
        id: reportId,
        ...demoWhere(actor.scope),
        assignedResponderId: actor.id,
        workflowStatus: "checked_in",
      },
    });
    if (!report)
      return fail("Check in to your assigned report before submitting a verdict.");
    const evidenceUrl =
      file instanceof File && file.size > 0
        ? await uploadEvidence(file, reportId, actor.id)
        : null;
    await prisma.$transaction(async (tx) => {
      const changed = await tx.crowdsourcedReport.updateMany({
        where: {
          id: reportId,
          assignedResponderId: actor.id,
          workflowStatus: "checked_in",
        },
        data: {
          workflowStatus: verdict === "escalated" ? "escalated" : "completed",
          verificationStatus:
            verdict === "escalated"
              ? "unverified"
              : verdict === "partially_true"
                ? "partial"
                : verdict,
          priority: verdict === "escalated" ? "critical" : report.priority,
          verdictNote: finalNote,
          evidenceUrl,
          completedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new Error("Report changed");
      await tx.reportVerificationEvent.create({
        data: {
          reportId,
          actorId: actor.id,
          action: verdict,
          note: finalNote,
          evidenceUrl,
        },
      });
      if (verdict !== "escalated")
        await tx.responderProfile.updateMany({
          where: { id: actor.id },
          data: { totalVerifications: { increment: 1 } },
        });
      await tx.responderProfile.updateMany({
        where: { id: actor.id },
        data: { availability: "available" },
      });
    });
    revalidatePath("/portal");
    revalidatePath(`/portal/reports/${reportId}`);
    revalidatePath("/gov/dashboard");
    revalidatePath("/public/reports");
    revalidatePath("/public/map");
    return {
      ok: true,
      message:
        verdict === "escalated"
          ? "Escalated to government review."
          : `Report ${verdict}. Citizen status is updated.`,
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Verdict could not be saved.");
  }
}

export async function setReportPriority(
  reportId: string,
  priority: "normal" | "high" | "critical",
): Promise<Result> {
  const actor = await responderIdentity();
  if (!actor || !["district_admin", "super_admin"].includes(actor.role))
    return fail("Government admin access required.");
  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.crowdsourcedReport.updateMany({
        where: { id: reportId, ...demoWhere(actor.scope) },
        data: { priority },
      });
      if (changed.count !== 1) throw new Error("Report unavailable");
      await tx.reportVerificationEvent.create({
        data: { reportId, actorId: actor.id, action: "priority_changed", note: priority },
      });
    });
    revalidatePath("/portal");
    revalidatePath("/portal/admin");
    return { ok: true, message: `Priority set to ${priority}.` };
  } catch {
    return fail("Could not update report priority.");
  }
}

export async function assignReport(
  reportId: string,
  responderId: string,
): Promise<Result> {
  const actor = await responderIdentity();
  if (!actor || !["district_admin", "super_admin"].includes(actor.role))
    return fail("Government admin access required.");
  try {
    const profile = await prisma.responderProfile.findUnique({
      where: { id: responderId },
    });
    if (
      !profile ||
      profile.approvalStatus !== "approved" ||
      profile.availability !== "available" ||
      !profile.trainingCompletedAt
    )
      return fail("Choose an approved, available responder.");
    const active = await prisma.crowdsourcedReport.count({
      where: {
        ...demoWhere(actor.scope),
        assignedResponderId: responderId,
        OR: [
          { workflowStatus: "checked_in" },
          {
            workflowStatus: "claimed",
            claimedAt: { gt: new Date(Date.now() - CLAIM_LEASE_MS) },
          },
        ],
      },
    });
    if (active > 0) return fail("Responder already has an active verification.");
    if (
      actor.scope.demo
        ? responderId !== `demo:${actor.scope.sessionId}`
        : responderId.startsWith("demo:")
    )
      return fail("Responder is outside this session.");
    const expiredBefore = new Date(Date.now() - CLAIM_LEASE_MS);
    const claimable = {
      OR: [
        { workflowStatus: "queued" },
        { workflowStatus: "claimed", claimedAt: { lte: expiredBefore } },
      ],
    };
    const target = await prisma.crowdsourcedReport.findFirst({
      where: { id: reportId, ...demoWhere(actor.scope), ...claimable },
      select: {
        reportType: true,
        priorResponderId: true,
        assignedResponderId: true,
        workflowStatus: true,
      },
    });
    if (!target) return fail("Report is no longer in the queue.");
    if (target.priorResponderId === responderId)
      return fail("A disputed report needs a different responder.");
    if (profile.tier === "probation" && target.reportType === "rescue")
      return fail("Probation responders cannot be assigned critical rescue reports.");
    const changed = await prisma.$transaction(async (tx) => {
      const result = await tx.crowdsourcedReport.updateMany({
        where: {
          id: reportId,
          ...demoWhere(actor.scope),
          ...claimable,
          verificationStatus: "unverified",
        },
        data: {
          workflowStatus: "claimed",
          assignedResponderId: responderId,
          claimedAt: new Date(),
        },
      });
      if (result.count !== 1) return false;
      if (target.workflowStatus === "claimed" && target.assignedResponderId) {
        await tx.reportVerificationEvent.create({
          data: {
            reportId,
            actorId: "system",
            action: "released",
            note: "Claim expired after 45 minutes.",
          },
        });
        await tx.responderProfile.updateMany({
          where: { id: target.assignedResponderId },
          data: { availability: "available" },
        });
      }
      await tx.responderProfile.updateMany({
        where: { id: responderId },
        data: { availability: "unavailable" },
      });
      await tx.reportVerificationEvent.create({
        data: {
          reportId,
          actorId: actor.id,
          action: "assigned",
          note: `Assigned to ${profile.name} (${profile.organization})`,
        },
      });
      return true;
    });
    if (!changed) return fail("Report has already been claimed or is unavailable.");
    revalidatePath("/portal");
    revalidatePath("/portal/admin");
    revalidatePath(`/portal/reports/${reportId}`);
    return { ok: true, message: `Assigned to ${profile.name}.` };
  } catch {
    return fail("Assignment could not be saved.");
  }
}
