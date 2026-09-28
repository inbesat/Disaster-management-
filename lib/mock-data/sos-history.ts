// ---------------------------------------------------------------------
// lib/mock-data/sos-history.ts — Phase 5 · Step 7 · SOS History &
// Resolution Log.
//
// Documentation of past emergencies for insurance or relief claims. The
// /public/settings/sos-history page renders this timeline; swap in real
// alert_log / sos tables later by replacing SOS_HISTORY with a fetch,
// keeping the typed shape and formatSosDate unchanged.
//
// Entries are newest-first with deterministic past dates (the demo
// district's flood season) so the page always reads the same.
// ---------------------------------------------------------------------

export type SosHistoryEntry = {
  /** Stable id — key for the timeline rows. */
  id: string;
  /** ISO timestamp of when the incident was filed. */
  date: string;
  /** Incident type, e.g. "Flood Rescue". */
  incidentType: string;
  /** Resolution status, e.g. "Resolved by NDRF Unit 4". */
  status: string;
  /** Where it happened. */
  location: string;
  /** One-line outcome for the log. */
  summary: string;
};

export const SOS_HISTORY: SosHistoryEntry[] = [
  {
    id: "sos-2026-08-02",
    date: "2026-08-02T09:15:00.000Z",
    incidentType: "Flood Rescue",
    status: "Resolved by NDRF Unit 4",
    location: "Kankarbagh, Patna",
    summary:
      "12 residents evacuated by boat from a rooftop after river water entered the lane.",
  },
  {
    id: "sos-2026-07-19",
    date: "2026-07-19T16:40:00.000Z",
    incidentType: "Medical Emergency",
    status: "Resolved by 108 Ambulance",
    location: "Digha, Patna",
    summary: "Patient with breathing difficulty reached by ambulance in 9 minutes.",
  },
  {
    id: "sos-2026-07-05",
    date: "2026-07-05T11:05:00.000Z",
    incidentType: "Road Blocked",
    status: "Resolved by Civil Defence",
    location: "Bailey Road, Patna",
    summary: "Flood debris cleared and the road reopened to two-way traffic.",
  },
  {
    id: "sos-2026-06-21",
    date: "2026-06-21T07:30:00.000Z",
    incidentType: "Food & Water Request",
    status: "Resolved by Relief Camp 2",
    location: "Danapur, Patna",
    summary: "Packaged meals and drinking water delivered to the household.",
  },
  {
    id: "sos-2026-06-08",
    date: "2026-06-08T18:55:00.000Z",
    incidentType: "Family Check-In",
    status: "Resolved — Marked Safe",
    location: "Frazer Road, Patna",
    summary: "Citizen confirmed safe after the evening flood advisory.",
  },
];

/** ISO → "2 Aug 2026" (fallback to the raw string when unparseable). */
export function formatSosDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}
