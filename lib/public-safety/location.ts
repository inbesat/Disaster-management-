import { z } from "zod";

export const PUBLIC_DISTRICTS = {
  Patna: { lat: 25.5941, lng: 85.1376 },
  Bhagalpur: { lat: 25.2425, lng: 86.9842 },
  Gaya: { lat: 24.7914, lng: 85.0002 },
  Muzaffarpur: { lat: 26.1209, lng: 85.3647 },
  Darbhanga: { lat: 26.1542, lng: 85.8918 },
  Purnia: { lat: 25.7767, lng: 87.4755 },
} as const;

export const locationSchema = z
  .object({
    district: z.enum([
      "Patna",
      "Bhagalpur",
      "Gaya",
      "Muzaffarpur",
      "Darbhanga",
      "Purnia",
    ]),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine((value) => (value.lat === undefined) === (value.lng === undefined), {
    message: "Provide both latitude and longitude.",
  });
export type PublicLocation = z.infer<typeof locationSchema>;

export function coordinates(location: PublicLocation) {
  return location.lat !== undefined && location.lng !== undefined
    ? { lat: location.lat, lng: location.lng }
    : PUBLIC_DISTRICTS[location.district];
}

/** Only supported manual locations are reused; never silently label GPS as Patna. */
export function savedPublicLocation(): PublicLocation | null {
  try {
    const saved = JSON.parse(localStorage.getItem("citizen_location") ?? "null");
    if (saved?.type === "manual") {
      const result = locationSchema.safeParse({ district: saved.district });
      return result.success ? result.data : null;
    }
    if (
      saved?.type === "gps" &&
      typeof saved.lat === "number" &&
      typeof saved.lng === "number"
    ) {
      const nearest = Object.entries(PUBLIC_DISTRICTS).sort(
        (a, b) =>
          Math.hypot(a[1].lat - saved.lat, a[1].lng - saved.lng) -
          Math.hypot(b[1].lat - saved.lat, b[1].lng - saved.lng),
      )[0];
      const result = locationSchema.safeParse({
        district: nearest[0],
        lat: saved.lat,
        lng: saved.lng,
      });
      return result.success ? result.data : null;
    }
  } catch {
    /* A blocked or malformed saved location leaves the explicit selector usable. */
  }
  return null;
}

export function locationQuery(location: PublicLocation) {
  const query = new URLSearchParams({ district: location.district });
  if (location.lat !== undefined && location.lng !== undefined) {
    query.set("lat", String(location.lat));
    query.set("lng", String(location.lng));
  }
  return query.toString();
}
