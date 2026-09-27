// ---------------------------------------------------------------------
// components/public/NearbySheltersList.tsx — Phase 2 · Step 7 · Nearby
// Shelters Quick-List.
//
// A vertical list of exactly 3 mock shelters with the facts a fleeing
// citizen needs at a glance: name, distance, walking time and occupancy.
// Facility chips (Medical / Food) use the severity-token treatment; a
// slim occupancy bar gives the fullness a visual readout. "View All on
// Map" links to the future citizen map page (/public/map — same
// convention as the ActionCard PREPARE action).
//
// Server-safe pure component (static mock data, no state/hooks) — it
// renders with the page and never flashes.
// ---------------------------------------------------------------------

import Link from "next/link";
import {
  Footprints,
  Map,
  MapPin,
  Stethoscope,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

type Shelter = {
  name: string;
  distanceKm: number;
  walkMins: number;
  beds: number;
  occupied: number;
  medical: boolean;
  food: boolean;
};

// Mock shelters around the demo district — single edit point.
const SHELTERS: Shelter[] = [
  {
    name: "Patna Central Community Hall",
    distanceKm: 1.2,
    walkMins: 15,
    beds: 100,
    occupied: 45,
    medical: true,
    food: true,
  },
  {
    name: "Riverside High School",
    distanceKm: 2.4,
    walkMins: 30,
    beds: 150,
    occupied: 128,
    medical: true,
    food: false,
  },
  {
    name: "Kankarbagh Stadium Shelter",
    distanceKm: 3.1,
    walkMins: 38,
    beds: 250,
    occupied: 92,
    medical: false,
    food: true,
  },
];

export function NearbySheltersList() {
  return (
    <section aria-label="Illustrative demo shelters" className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="eoc-label text-[var(--dl-text-muted)]">DEMO SHELTERS · UNVERIFIED</p>
        <Link
          href="/public/map"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--dl-orange-light)] transition hover:text-[var(--dl-orange)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-orange)]"
        >
          <Map className="h-3.5 w-3.5" aria-hidden />
          View All on Map
        </Link>
      </div>

      <p className="text-xs font-medium text-amber-200">Names, distances and bed counts are sample data. Check official local sources before travelling.</p>

      <ul className="space-y-2.5">
        {SHELTERS.map((shelter) => {
          const pct = Math.round((shelter.occupied / shelter.beds) * 100);
          return (
            <li
              key={shelter.name}
              className="rounded-[var(--dl-radius-sm)] border border-white/10 bg-white/5 p-4 backdrop-blur"
            >
              {/* Name + pin */}
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-1.5 text-sm font-bold text-white">
                  <MapPin
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[var(--dl-orange-light)]"
                  />
                  {shelter.name}
                </p>
                <p className="shrink-0 text-xs font-semibold text-[var(--dl-orange-light)]">
                  {shelter.distanceKm.toFixed(1)} km
                </p>
              </div>

              {/* Distance / walk / occupancy readout */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] text-[var(--dl-text-muted)]">
                <span className="flex items-center gap-1">
                  <Footprints aria-hidden="true" className="h-3.5 w-3.5" />
                  {shelter.walkMins} mins walk
                </span>
                <span className="tabular-nums">
                  {shelter.occupied}/{shelter.beds} beds
                </span>
              </div>

              {/* Occupancy bar */}
              <div
                className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                role="img"
                aria-label={`${shelter.occupied} of ${shelter.beds} beds occupied`}
              >
                <div
                  className={`h-full rounded-full ${
                    pct >= 80
                      ? "bg-severity-red-500"
                      : pct >= 50
                        ? "bg-severity-amber-500"
                        : "bg-severity-green-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Facility chips */}
              <div className="mt-2.5 flex gap-2">
                {shelter.medical && (
                  <FacilityChip icon={Stethoscope} label="Medical" />
                )}
                {shelter.food && <FacilityChip icon={UtensilsCrossed} label="Food" />}
                {!shelter.medical && !shelter.food && (
                  <span className="text-[0.6875rem] text-[var(--dl-text-muted)]">
                    Basic shelter only
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FacilityChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-[var(--dl-text-on-navy)]">
      <Icon aria-hidden="true" className="h-3 w-3 text-[var(--dl-orange-light)]" />
      {label}
    </span>
  );
}

export default NearbySheltersList;
