import type { Metadata } from "next";
import SatelliteWorkspace from "@/components/satellite/SatelliteWorkspace";

export const metadata: Metadata = { title: "Satellite & Ground Truth | SafeSphere" };

export default function SatellitePage() {
  return <SatelliteWorkspace />;
}
