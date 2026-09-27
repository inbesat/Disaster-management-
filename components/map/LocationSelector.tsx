"use client";

import { useMap } from "react-map-gl/maplibre";

// A curated set of flood-prone cities around the world. The map is fully
// location-agnostic; this just lets operators jump straight to a hotspot.
const LOCATIONS = [
  { label: "Patna, India", latitude: 25.5941, longitude: 85.1376, zoom: 10 },
  { label: "Mumbai, India", latitude: 19.076, longitude: 72.8777, zoom: 10 },
  { label: "Kolkata, India", latitude: 22.5726, longitude: 88.3639, zoom: 10 },
  { label: "Delhi, India", latitude: 28.6139, longitude: 77.209, zoom: 10 },
  { label: "Dhaka, Bangladesh", latitude: 23.8103, longitude: 90.4125, zoom: 10 },
  { label: "Jakarta, Indonesia", latitude: -6.2088, longitude: 106.8456, zoom: 10 },
  { label: "Tokyo, Japan", latitude: 35.6762, longitude: 139.6503, zoom: 10 },
  {
    label: "Ho Chi Minh City, Vietnam",
    latitude: 10.8231,
    longitude: 106.6297,
    zoom: 10,
  },
  { label: "New York, USA", latitude: 40.7128, longitude: -74.006, zoom: 10 },
  { label: "Houston, USA", latitude: 29.7604, longitude: -95.3698, zoom: 10 },
  { label: "London, UK", latitude: 51.5074, longitude: -0.1278, zoom: 10 },
  { label: "Amsterdam, NL", latitude: 52.3676, longitude: 4.9041, zoom: 10 },
  { label: "Lagos, Nigeria", latitude: 6.5244, longitude: 3.3792, zoom: 10 },
  { label: "São Paulo, Brazil", latitude: -23.5505, longitude: -46.6333, zoom: 10 },
  { label: "Sydney, Australia", latitude: -33.8688, longitude: 151.2093, zoom: 10 },
] as const;

export default function LocationSelector() {
  const map = useMap().default;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const location = LOCATIONS.find((l) => l.label === e.target.value);
    if (!location || !map) return;

    map.flyTo({
      center: [location.longitude, location.latitude],
      zoom: location.zoom,
      duration: 2500,
      essential: true,
    });
  }

  return (
    <select
      aria-label="Select a location"
      onChange={handleChange}
      defaultValue=""
      className="rounded-md border border-border bg-surface-elevated/95 px-3 py-2 text-sm font-medium text-foreground shadow-glow-accent backdrop-blur focus:border-accent focus:outline-none"
    >
      <option value="" disabled>
        Select a hotspot…
      </option>
      {LOCATIONS.map((location) => (
        <option key={location.label} value={location.label}>
          {location.label}
        </option>
      ))}
    </select>
  );
}
