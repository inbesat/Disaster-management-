import { prisma } from "@/server/prisma";
import { loadPublicForecast } from "./forecast";
import { coordinates, type PublicLocation } from "./location";
import { haversineKm } from "@/lib/mock-data/hazard-zones";

async function bounded<T>(promise: PromiseLike<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 3000);
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Only public, non-demo records enter a citizen's plan. No caller-supplied weather. */
export async function loadSafetyContext(location: PublicLocation) {
  const { lat, lng } = coordinates(location);
  const [forecast, shelters, reports] = await Promise.all([
    loadPublicForecast(location).catch(() => null),
    bounded(
      prisma.shelter.findMany({
        where: {
          isDemo: false,
          district: { equals: location.district, mode: "insensitive" },
          status: "open",
        },
        select: {
          id: true,
          name: true,
          lat: true,
          lng: true,
          capacity: true,
          currentOccupancy: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ),
    bounded(
      prisma.crowdsourcedReport.findMany({
        where: {
          isDemo: false,
          verificationStatus: "verified",
          completedAt: { gte: new Date(Date.now() - 86400000) },
          lat: { gte: lat - 0.1, lte: lat + 0.1 },
          lng: { gte: lng - 0.1, lte: lng + 0.1 },
        },
        select: { reportType: true, priority: true, completedAt: true },
        take: 30,
      }),
    ),
  ]);
  const highest = forecast?.days.reduce((a, b) => (a.score > b.score ? a : b));
  const risk =
    reports?.some((report) => report.priority === "critical") ||
    highest?.risk === "severe"
      ? "CRITICAL"
      : reports?.some((report) => ["flooding", "rescue"].includes(report.reportType)) ||
          highest?.risk === "high"
        ? "HIGH"
        : highest?.risk === "watch"
          ? "WATCH"
          : highest
            ? "LOW"
            : "UNKNOWN";
  return {
    location,
    generatedAt: new Date().toISOString(),
    risk,
    forecast,
    shelters: (shelters ?? [])
      .filter((shelter) => haversineKm(lat, lng, shelter.lat, shelter.lng) <= 30)
      .map((shelter) => ({
        ...shelter,
        updatedAt: shelter.updatedAt.toISOString(),
        availableBeds: Math.max(0, shelter.capacity - shelter.currentOccupancy),
      })),
    reports: reports ?? [],
    availability: {
      weather: forecast !== null,
      shelters: shelters !== null,
      verifiedReports: reports !== null,
    },
    limitations: [
      "Weather and river models estimate conditions; they do not confirm an area or road is safe.",
      "Verified reports cover nearby locations in the last 24 hours; an empty feed does not establish safety.",
      ...(forecast?.riverSource === "unavailable"
        ? ["River discharge is unavailable."]
        : []),
      ...(!shelters
        ? [
            "Shelter capacity feed is unavailable. Confirm a destination with local authorities.",
          ]
        : []),
      ...(!reports ? ["Verified local hazard reports are unavailable."] : []),
    ],
  };
}
export type SafetyContext = Awaited<ReturnType<typeof loadSafetyContext>>;
