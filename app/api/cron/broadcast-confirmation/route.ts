import { NextRequest, NextResponse } from "next/server";
import {
  sweepUnconfirmedBroadcasts,
  CONFIRMATION_WINDOW_MINUTES,
} from "@/lib/broadcast/confirmation-sweep";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/broadcast-confirmation
 * Background sweep for the dispatcher's fourth trigger: stations that
 * accepted (CAP API 202) but never confirmed on-air within 3 minutes are
 * marked retrying and escalated to IVR. Guarded by CRON_SECRET, same as
 * /api/cron/audio-retention. ?dryRun=true reports without writing…
 * (dry-run still reads candidates; writes are skipped).
 * ?windowMinutes= overrides the 3-minute window (tests / rehearsal).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.startsWith("<")) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured — confirmation sweep disabled." },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const windowMinutes = Math.min(
    Math.max(Number(searchParams.get("windowMinutes")) || CONFIRMATION_WINDOW_MINUTES, 1),
    1440,
  );

  try {
    const result = await sweepUnconfirmedBroadcasts({ windowMinutes });
    return NextResponse.json({ ok: true, windowMinutes, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
