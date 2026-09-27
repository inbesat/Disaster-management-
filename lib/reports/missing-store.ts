import { sanitizeInput } from "@/lib/security/sanitize";

// ---------------------------------------------------------------------
// lib/reports/missing-store.ts — shared state for the Missing Person &
// Casualty reporting workflow.
//
// Demo-first design: reports live in a module-level in-memory store that
// survives hot-reload (cached on globalThis) and is seeded with realistic
// records so the government verification queue is never empty — even with
// the database asleep. Prisma persistence can be layered in later without
// touching the API contract.
//
// Status lifecycle:
//   PENDING_REVIEW  → citizen just submitted
//   VERIFIED_ACTIVE → gov approved & broadcast (active search)
//   RESOLVED_FOUND  → person located / casualty processed
//   REJECTED        → duplicate / spam / dismissed
// ---------------------------------------------------------------------

export type MissingReportType = "MISSING_PERSON" | "CASUALTY";

export type MissingReportStatus =
  | "PENDING_REVIEW"
  | "VERIFIED_ACTIVE"
  | "RESOLVED_FOUND"
  | "REJECTED";

export type MissingReport = {
  id: string;
  type: MissingReportType;
  fullName: string;
  age: number | string;
  gender: string;
  lastSeenLocation: string;
  /** Data URL (client-side preview) or https URL. Capped at the API layer. */
  photoUrl: string;
  reporterName: string;
  reporterPhone: string;
  medicalNotes: string;
  status: MissingReportStatus;
  createdAt: string;
};

export const MISSING_REPORT_STATUSES: readonly MissingReportStatus[] = [
  "PENDING_REVIEW",
  "VERIFIED_ACTIVE",
  "RESOLVED_FOUND",
  "REJECTED",
] as const;

/** Compact offline-safe placeholder portrait (SVG data URI, ~300 chars). */
function seedPhoto(initials: string, hue: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'>` +
    `<rect width='100%' height='100%' fill='hsl(${hue},45%,26%)'/>` +
    `<circle cx='160' cy='118' r='58' fill='hsl(${hue},55%,42%)'/>` +
    `<text x='160' y='138' font-family='sans-serif' font-size='52' font-weight='bold' fill='#fff' text-anchor='middle'>${initials}</text>` +
    `<rect y='196' width='100%' height='124' fill='hsl(${hue},50%,34%)'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Seed records so both portals demo instantly on a cold boot. */
function seedReports(): Map<string, MissingReport> {
  const now = Date.now();
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
  const rows: MissingReport[] = [
    {
      id: "mp-seed-001",
      type: "MISSING_PERSON",
      fullName: "Ramesh Kumar Yadav",
      age: 64,
      gender: "Male",
      lastSeenLocation: "Gandhi Maidan shelter queue, Patna",
      photoUrl: seedPhoto("RY", 210),
      reporterName: "Sunita Devi",
      reporterPhone: "+91 98765 43210",
      medicalNotes: "Diabetic — needs insulin within 12h. Walks with a limp.",
      status: "PENDING_REVIEW",
      createdAt: iso(38),
    },
    {
      id: "mp-seed-002",
      type: "MISSING_PERSON",
      fullName: "Baby Aisha Khan",
      age: 6,
      gender: "Female",
      lastSeenLocation: "Riverside High School evacuation point",
      photoUrl: seedPhoto("AK", 340),
      reporterName: "Imran Khan",
      reporterPhone: "+91 91234 56780",
      medicalNotes: "Asthmatic — carries a blue inhaler.",
      status: "VERIFIED_ACTIVE",
      createdAt: iso(190),
    },
    {
      id: "mp-seed-003",
      type: "CASUALTY",
      fullName: "Unidentified male, ~40s",
      age: "Unknown",
      gender: "Male",
      lastSeenLocation: "Recovered near Daulatpur bridge crossing",
      photoUrl: seedPhoto("UD", 20),
      reporterName: "NDRF Team Delta",
      reporterPhone: "+91 90000 11223",
      medicalNotes: "Deceased. Held at Patna Medical College mortuary, bay 3.",
      status: "PENDING_REVIEW",
      createdAt: iso(75),
    },
    {
      id: "mp-seed-004",
      type: "MISSING_PERSON",
      fullName: "Priya Sharma",
      age: 22,
      gender: "Female",
      lastSeenLocation: "Kankarbagh community hall",
      photoUrl: seedPhoto("PS", 120),
      reporterName: "Vikas Sharma",
      reporterPhone: "+91 99887 76655",
      medicalNotes: "",
      status: "RESOLVED_FOUND",
      createdAt: iso(520),
    },
  ];
  return new Map(rows.map((r) => [r.id, r]));
}

// globalThis cache — survives Next.js dev HMR reloads.
const globalStore = globalThis as unknown as {
  __missingReportsStore?: Map<string, MissingReport>;
};

const store: Map<string, MissingReport> =
  globalStore.__missingReportsStore ?? seedReports();
globalStore.__missingReportsStore = store;

export function listMissingReports(filters?: {
  status?: string | null;
  type?: string | null;
}): MissingReport[] {
  let rows = Array.from(store.values()).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  if (filters?.status && filters.status !== "all") {
    rows = rows.filter((r) => r.status === filters.status);
  }
  if (filters?.type && filters.type !== "all") {
    rows = rows.filter((r) => r.type === filters.type);
  }
  return rows;
}

export function getMissingReport(id: string): MissingReport | undefined {
  return store.get(id);
}

export type CreateMissingReportInput = Record<string, unknown>;

/** Server-side field validation/caps. Returns [report, error]. */
export function createMissingReport(
  body: CreateMissingReportInput,
): [MissingReport, null] | [null, string] {
  const text = (v: unknown, max: number): string =>
    typeof v === "string" ? sanitizeInput(v).slice(0, max) : "";

  const fullName = text(body.fullName, 200);
  const lastSeenLocation = text(body.lastSeenLocation, 500);
  const reporterName = text(body.reporterName, 200);
  const reporterPhone = typeof body.reporterPhone === "string"
    ? sanitizeInput(body.reporterPhone).slice(0, 30)
    : "";

  if (!fullName || !lastSeenLocation || !reporterName || !reporterPhone) {
    return [null, "fullName, lastSeenLocation, reporterName and reporterPhone are required."];
  }

  const type: MissingReportType =
    body.type === "CASUALTY" ? "CASUALTY" : "MISSING_PERSON";

  const rawPhoto = typeof body.photoUrl === "string" ? body.photoUrl : "";
  // ~2 MB binary cap once base64-encoded (~2.67M chars).
  if (rawPhoto.length > 2_600_000) {
    return [null, "Photo too large — please attach an image under 2 MB."];
  }

  const report: MissingReport = {
    id: `mp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    fullName,
    age:
      typeof body.age === "number" && Number.isFinite(body.age)
        ? Math.max(0, Math.min(130, Math.round(body.age)))
        : text(body.age, 20) || "Unknown",
    gender: text(body.gender, 50) || "Unspecified",
    lastSeenLocation,
    photoUrl: /^(data:image\/|https:\/\/)/i.test(rawPhoto) ? rawPhoto : "",
    reporterName,
    reporterPhone,
    medicalNotes: text(body.medicalNotes, 2000),
    status: "PENDING_REVIEW",
    createdAt: new Date().toISOString(),
  };

  store.set(report.id, report);
  return [report, null];
}

export function updateMissingReportStatus(
  id: string,
  status: string,
): MissingReport | null {
  if (!MISSING_REPORT_STATUSES.includes(status as MissingReportStatus)) {
    return null;
  }
  const existing = store.get(id);
  if (!existing) return null;
  const updated: MissingReport = { ...existing, status: status as MissingReportStatus };
  store.set(id, updated);
  return updated;
}
