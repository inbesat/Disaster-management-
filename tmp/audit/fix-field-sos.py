from pathlib import Path
p=Path('app/api/field/sos/route.ts')
p.write_text('''import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { sanitizeInput } from "@/lib/security/sanitize";
import { requireRole } from "@/lib/security/require-role";
import { GOV_ROLES } from "@/lib/validations/user";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireRole(GOV_ROLES);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  let body: { type?: string; responder?: string; lat?: number; lng?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  if (body.type !== "SOS_EMERGENCY" || typeof body.lat !== "number" || typeof body.lng !== "number" || !Number.isFinite(body.lat) || !Number.isFinite(body.lng) || Math.abs(body.lat) > 90 || Math.abs(body.lng) > 180) {
    return NextResponse.json({ ok: false, error: "A valid SOS type and GPS location are required" }, { status: 422 });
  }

  try {
    const responder = typeof body.responder === "string" ? sanitizeInput(body.responder).slice(0, 120) : "Field responder";
    const report = await prisma.crowdsourcedReport.create({
      data: {
        lat: body.lat,
        lng: body.lng,
        reportType: "rescue",
        source: "field-sos",
        rawText: `Field responder SOS from ${responder}`,
        confidenceScore: 1,
        verificationStatus: "unverified",
        isDemo: false,
        sessionId: null,
      },
    });
    return NextResponse.json({ ok: true, sosId: report.id, recorded: true, dispatched: false, message: "SOS recorded; responder notification is unconfirmed" });
  } catch (error) {
    console.error("Field SOS could not be recorded:", error);
    return NextResponse.json({ ok: false, recorded: false, dispatched: false, error: "SOS could not be recorded. Contact the control room directly." }, { status: 503 });
  }
}
''',encoding='utf-8')
p=Path('components/field/ResponderSOS.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('OfflineSyncQueue, PATNA_CENTER','OfflineSyncQueue')
s=s.replace('setCoords(PATNA_CENTER);','setCoords(null);')
s=s.replace('lat: coords?.lat ?? PATNA_CENTER.lat,\n      lng: coords?.lng ?? PATNA_CENTER.lng,','lat: coords?.lat,\n      lng: coords?.lng,')
a=s.index('  async function fire() {')
b=s.index('\n  function close()',a)
s=s[:a]+'''  async function fire() {
    triggerCriticalHaptic();
    if (!coords) {
      toast.error("GPS is unavailable. Contact the control room directly and share your location.");
      return;
    }
    const payload = {
      type: "SOS_EMERGENCY" as const,
      responder: RESPONDER,
      lat: coords.lat,
      lng: coords.lng,
      at: new Date().toISOString(),
    };
    try {
      const res = await fetch("/api/field/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error("SOS was not recorded. Contact the control room directly.");
        return;
      }
      setSent(true);
      toast("SOS recorded. Responder notification is unconfirmed.", { icon: "🚨" });
    } catch {
      if (!navigator.onLine) {
        OfflineSyncQueue.enqueue({ url: "/api/field/sos", method: "POST", body: payload });
        toast("SOS queued on this device, not delivered. Contact the control room directly.", { icon: "⚠️" });
      } else {
        toast.error("SOS could not be sent. Contact the control room directly.");
      }
    }
  }
'''+s[b:]
p.write_text(s,encoding='utf-8')
