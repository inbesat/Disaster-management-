export const CLAIM_LEASE_MS = 45 * 60 * 1000;
export const CHECK_IN_RADIUS_KM = 0.1;

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(radians(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function isClaimExpired(status: string, claimedAt: Date | null, now = new Date()) {
  return (
    status === "claimed" &&
    claimedAt !== null &&
    now.getTime() - claimedAt.getTime() >= CLAIM_LEASE_MS
  );
}

const SLA_MS: Record<string, number> = {
  rescue: 15 * 60 * 1000,
  flooding: 45 * 60 * 1000,
  road_blocked: 2 * 60 * 60 * 1000,
  shelter_needed: 4 * 60 * 60 * 1000,
};

export function reportDueAt(reportType: string, createdAt: Date) {
  return new Date(createdAt.getTime() + (SLA_MS[reportType] ?? SLA_MS.flooding));
}

export function isReportOverdue(
  reportType: string,
  createdAt: Date,
  status: string,
  now = new Date(),
) {
  return (
    !["completed", "escalated"].includes(status) &&
    reportDueAt(reportType, createdAt).getTime() <= now.getTime()
  );
}
