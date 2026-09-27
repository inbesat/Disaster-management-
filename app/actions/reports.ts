"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/prisma";
import { detectSpam } from "@/lib/data-ingestion/spam-filter";
import { anonymizePII, sanitizeInput } from "@/lib/security/sanitize";
import { checkSpamPatrol } from "@/lib/security/spam-check";
import { rateLimit } from "@/lib/security/rate-limit";
import { randomUUID, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { demoWhere, resolveDemoScope } from "@/lib/demo/scope";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

// ---------------------------------------------------------------------
// app/actions/reports.ts
// Phase 17 — Crowdsourced Ground Truth ingestion.
// A citizen submits a ground-truth report (GPS + type + description + photo).
// The action runs the spam/duplicate filter (Phase 17 Step 7) and, only if
// the report is clean, inserts a new `unverified` CrowdsourcedReport row.
// Database failures are reported honestly so citizens never receive a false receipt.
// ---------------------------------------------------------------------

export type CitizenReportInput = {
  lat: number;
  lng: number;
  reportType: "flooding" | "road_blocked" | "shelter_needed" | "rescue";
  rawText: string;
  source?: "social" | "app" | "sms";
  imageUrl?: string | null;
};

export type SubmitReportResult = {
  ok: boolean;
  id: string;
  message?: string;
};

const REPORT_TYPES = ["flooding", "road_blocked", "shelter_needed", "rescue"] as const;
const MAX_IMAGE_URL_LENGTH = 1000;

/**
 * Persist a citizen ground-truth report. Sanitises inputs, defaults source to
 * "app", leaves verification_status "unverified" for the response team. Runs
 * the Phase 17 spam filter against recent DB reports first so trolls/bots are
 * rejected — duplicate text or >5 reports from one location within a minute.
 */
export async function submitCitizenReport(
  input: CitizenReportInput,
  photoData?: FormData,
): Promise<SubmitReportResult> {
  // Rate limit: max 5 reports per IP per 10 minutes. The key must be derived
  // from the caller (IP header when available) — never from lat/lng, which an
  // attacker can trivially vary to burn a fresh budget every request.
  const forwarded = headers().get("x-forwarded-for");
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : "";
  const clientKey = clientIp
    ? `report:${clientIp}`
    : `report:${Math.round(input.lat * 100)}:${Math.round(input.lng * 100)}`;
  const budget = rateLimit(clientKey, 5, 10 * 60 * 1000);
  if (!budget.success) {
    return {
      ok: false,
      id: "",
      message:
        "Too many reports from your location. Please wait before submitting again.",
    };
  }

  const reportType = REPORT_TYPES.includes(input.reportType as never)
    ? input.reportType
    : "flooding";
  // Phase 21 · strip XSS vectors before anything touches the database. PII is
  // redacted at display time (triage/map) so response teams keep operational
  // contact details while public surfaces never surface them.
  const rawText = sanitizeInput(String(input.rawText ?? "").trim()).slice(0, 2000);
  const source =
    input.source === "social" || input.source === "sms" ? input.source : "app";
  // imageUrl: only plain http(s) URLs are accepted (data:/javascript: and SVG
  // payloads are rejected as XSS defense-in-depth).
  const imageUrl =
    input.imageUrl && /^https?:\/\//i.test(String(input.imageUrl))
      ? sanitizeInput(String(input.imageUrl)).slice(0, MAX_IMAGE_URL_LENGTH)
      : null;

  if (
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    Math.abs(input.lat) > 90 ||
    Math.abs(input.lng) > 180
  ) {
    return {
      ok: false,
      id: "",
      message: "Location is required. Use the GPS button to set your position.",
    };
  }
  if (!rawText) {
    return { ok: false, id: "", message: "Please describe the situation." };
  }
  if (input.imageUrl && !imageUrl) {
    return {
      ok: false,
      id: "",
      message:
        "The photo could not be attached. Please submit without it or upload it to a supported storage service.",
    };
  }
  const photo = photoData?.get("photo");
  if (
    photo instanceof File &&
    photo.size > 0 &&
    (photo.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(photo.type))
  ) {
    return {
      ok: false,
      id: "",
      message: "Photo must be a JPG, PNG or WebP image under 5 MB.",
    };
  }

  // Enterprise Security — SpamPatrol external spam check on the report
  // text. Fail-open: without SPAMPATROL_API_KEY (or on any API error) the
  // check returns isSpam: false so the demo keeps working. When it flags a
  // report we THROW (outside the DB try/catch below, so the mock-success
  // fallback never swallows the rejection) and the client shows the message.
  //
  // Privacy: only the PII-redacted text (phones/emails → [REDACTED]) leaves
  // the server to the third party, keeping the platform's redaction posture.
  const external = await checkSpamPatrol({
    text: anonymizePII(rawText),
    reportType,
    lat: input.lat,
    lng: input.lng,
  });
  if (external.isSpam) {
    console.warn(`[reports] SpamPatrol rejected report: "${rawText.slice(0, 80)}"`);
    throw new Error("Spam detected. Report rejected.");
  }

  try {
    const scope = resolveDemoScope();
    if (process.env.DEMO_AUTH_ENABLED === "true" && !scope.demo)
      return {
        ok: false,
        id: "",
        message: "Sign in to a SafeSphere demo session before reporting.",
      };
    if (scope.demo && !scope.sessionId)
      return { ok: false, id: "", message: "Your demo session expired. Sign in again." };
    let token = cookies().get("safesphere_reporter")?.value;
    if (!token) {
      token = randomUUID();
      cookies().set("safesphere_reporter", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 90,
      });
    }
    const reporterTokenHash = createHash("sha256").update(token).digest("hex");
    // Phase 17 Step 7 — pull recent reports and run the spam filter.
    const recent = await prisma.crowdsourcedReport.findMany({
      where: demoWhere(scope),
      select: { lat: true, lng: true, rawText: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const spam = detectSpam(
      { lat: input.lat, lng: input.lng, rawText, createdAt: new Date() },
      recent.map((r) => ({
        lat: r.lat,
        lng: r.lng,
        rawText: r.rawText,
        createdAt: r.createdAt,
      })),
    );

    if (spam.isSpam) {
      console.warn(`[reports] Spam rejected (${spam.reason}): "${rawText}"`);
      return {
        ok: false,
        id: "",
        message:
          spam.reason === "duplicate_text"
            ? "This report looks like a duplicate already received. Stay safe."
            : "Too many reports from your location in a short time. Please wait and try again.",
      };
    }

    const report = await prisma.$transaction(async (tx) => {
      const saved = await tx.crowdsourcedReport.create({
        data: {
          lat: input.lat,
          lng: input.lng,
          reportType,
          source,
          rawText,
          confidenceScore: 0.5,
          verificationStatus: "unverified",
          imageUrl,
          reporterTokenHash,
          isDemo: scope.demo,
          sessionId: scope.sessionId,
          priority:
            reportType === "rescue"
              ? "critical"
              : reportType === "shelter_needed"
                ? "high"
                : "normal",
        },
      });
      await tx.reportVerificationEvent.create({
        data: {
          reportId: saved.id,
          actorId: `citizen:${reporterTokenHash.slice(0, 12)}`,
          action: "submitted",
        },
      });
      return saved;
    });

    let photoWarning: string | undefined;
    if (photo instanceof File && photo.size > 0) {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) throw new Error("Storage unavailable");
        const bytes = new Uint8Array(await photo.arrayBuffer());
        const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
        const png =
          bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47;
        const webp =
          String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
        if (!jpeg && !png && !webp) throw new Error("Invalid image");
        const path = `${report.id}/${randomUUID()}.${jpeg ? "jpg" : png ? "png" : "webp"}`;
        const client = createSupabaseAdmin(url, key, { auth: { persistSession: false } });
        const { error } = await client.storage
          .from("citizen-reports")
          .upload(path, bytes, {
            contentType: jpeg ? "image/jpeg" : png ? "image/png" : "image/webp",
            upsert: false,
          });
        if (error) throw error;
        await prisma.crowdsourcedReport.update({
          where: { id: report.id },
          data: { imageUrl: `citizen-reports:${path}` },
        });
      } catch {
        photoWarning =
          "Report saved, but the photo could not be attached. You can still track the report by its ID.";
      }
    }

    revalidatePath("/report");
    revalidatePath("/portal");
    revalidatePath("/gov/dashboard");
    revalidatePath("/public/reports");
    return { ok: true, id: report.id, message: photoWarning };
  } catch (error: unknown) {
    console.error("[reports] submitCitizenReport failed.", error);
    return {
      ok: false,
      id: "",
      message:
        "Report was not saved. Please try again later or call 1070 if you need urgent help.",
    };
  }
}

export async function disputeCitizenVerdict(
  reportId: string,
): Promise<{ ok: boolean; message: string }> {
  const token = cookies().get("safesphere_reporter")?.value;
  if (!token) return { ok: false, message: "No report receipt found on this browser." };
  const hash = createHash("sha256").update(token).digest("hex");
  const scope = resolveDemoScope();
  try {
    const changed = await prisma.$transaction(async (tx) => {
      const report = await tx.crowdsourcedReport.findFirst({
        where: {
          id: reportId,
          reporterTokenHash: hash,
          ...demoWhere(scope),
          verificationStatus: "rejected",
          disputeCount: 0,
        },
      });
      if (!report) return false;
      const result = await tx.crowdsourcedReport.updateMany({
        where: {
          id: reportId,
          reporterTokenHash: hash,
          ...demoWhere(scope),
          verificationStatus: "rejected",
          disputeCount: 0,
        },
        data: {
          disputeCount: { increment: 1 },
          priorResponderId: report.assignedResponderId,
          assignedResponderId: null,
          workflowStatus: "queued",
          verificationStatus: "unverified",
          claimedAt: null,
          checkedInAt: null,
          completedAt: null,
          verdictNote: null,
          evidenceUrl: null,
          priority: "high",
        },
      });
      if (result.count !== 1) return false;
      await tx.reportVerificationEvent.create({
        data: {
          reportId,
          actorId: `citizen:${hash.slice(0, 12)}`,
          action: "disputed",
          note: "Citizen requested a second field review.",
        },
      });
      return true;
    });
    if (!changed)
      return {
        ok: false,
        message: "This report is not eligible for dispute or was already disputed.",
      };
    revalidatePath("/public/reports");
    revalidatePath("/portal");
    revalidatePath("/gov/dashboard");
    return {
      ok: true,
      message: "Dispute submitted. A different responder must review the report.",
    };
  } catch {
    return { ok: false, message: "Dispute could not be saved. Try again later." };
  }
}
