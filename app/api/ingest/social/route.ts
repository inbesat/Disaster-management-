import { NextResponse } from "next/server";
import {
  parseCitizenReport,
  issueLabel,
  type ParsedCitizenReport,
} from "@/lib/ai/groq-parser";
import { sanitizeInput } from "@/lib/security/sanitize";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------
// app/api/ingest/social/route.ts
// Phase 17 Step 4 — Social Media / Twitter mock ingestion.
// GET endpoint that simulates a flood of social data: generates 5 fake
// "tweets" around Patna coordinates, runs each through the fast NLP parser,
// and maps them to mock CrowdsourcedReport-shaped objects (source = "social").
// ---------------------------------------------------------------------

// Patna demo region: small jitter around the city centre.
const PATNA = { lat: 25.5941, lng: 85.1376 };

// Pool of realistic (Hinglish) social posts to rotate through.
const TWEET_POOL = [
  "Water entering ground floor in Kankarbagh #PatnaFlood",
  "Bailey Road blocked, bus stuck in water, 12 people trapped #PatnaFlood",
  "Pani ghar me aa raha hai Rajendra Nagar, family stuck on terrace pls help",
  "Rescue needed near Danapur bridge, 5 logon ko bachao jaldi",
  "Boring Road pe pani bahut high hai, shelter chahiye for 20 people",
  "Flood water rising near Patliputra, need boat rescue #BiharFlood",
  "Mokama side road washed out, no vehicles can pass #Patna",
];

function jitter(base: number, spread = 0.04): number {
  return +(base + (Math.random() - 0.5) * spread).toFixed(6);
}

function pickTweet(): string {
  return TWEET_POOL[Math.floor(Math.random() * TWEET_POOL.length)];
}

// ---------------------------------------------------------------------
// GET /api/ingest/social
// Returns `{ ok, count, reports }` where each report is a parsed,
// CrowdsourcedReport-shaped object with source = "social".
// ---------------------------------------------------------------------
// CrowdsourcedReport.report_type allowed values.
type ReportType = "flooding" | "road_blocked" | "shelter_needed" | "rescue";

// Map NLP issue → CrowdsourcedReport.report_type (only the 4 DB values).
function toReportType(issue: ParsedCitizenReport["issue"]): ReportType {
  switch (issue) {
    case "flood":
      return "flooding";
    case "road_block":
      return "road_blocked";
    case "rescue":
      return "rescue";
    case "shelter_needed":
      return "shelter_needed";
    default:
      return "flooding"; // "other" → default to flooding for the demo
  }
}

export async function GET(): Promise<NextResponse> {
  if (process.env.DEMO_DATA_ENABLED !== "true")
    return NextResponse.json(
      { ok: false, error: "Social-media demo simulation is disabled." },
      { status: 404 },
    );
  const reports: Array<{
    lat: number;
    lng: number;
    report_type: ReportType;
    issue_label: string;
    source: "demo-social";
    raw_text: string;
    confidence_score: number;
    verification_status: "unverified";
    severity: number;
    people_trapped: boolean;
    people_count: number;
    locations: string[];
    summary: string;
  }> = [];

  for (let i = 0; i < 5; i++) {
    const rawText = pickTweet();
    const parsed = await parseCitizenReport(rawText);

    // Map NLP issue → CrowdsourcedReport.report_type (only the 4 DB values).
    const reportType = toReportType(parsed.issue);

    reports.push({
      lat: jitter(PATNA.lat),
      lng: jitter(PATNA.lng),
      report_type: reportType,
      issue_label: sanitizeInput(issueLabel(parsed.issue)),
      source: "demo-social",
      raw_text: sanitizeInput(rawText),
      confidence_score: +(parsed.severity / 100).toFixed(2),
      verification_status: "unverified",
      severity: parsed.severity,
      people_trapped: parsed.people_trapped,
      people_count: parsed.people_count,
      locations: parsed.locations.map(sanitizeInput),
      summary: sanitizeInput(parsed.summary),
    });
  }

  return NextResponse.json({ ok: true, count: reports.length, reports });
}
