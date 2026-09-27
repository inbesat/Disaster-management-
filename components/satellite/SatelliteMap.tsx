"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Map, Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import type { SatelliteEvent } from "@/lib/satellite/events";

type Props = {
  date: string;
  events: SatelliteEvent[];
  selected: SatelliteEvent | null;
  onSelect: (event: SatelliteEvent) => void;
};

export default function SatelliteMap({ date, events, selected, onSelect }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const style = useMemo<StyleSpecification>(() => {
    const tilePath = `wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
    return {
      version: 8,
      sources: { nasa: {
        type: "raster",
        tiles: ["a", "b", "c"].map((host) => `https://gibs-${host}.earthdata.nasa.gov/${tilePath}`),
        tileSize: 256,
        attribution: "NASA ESDIS GIBS",
      } },
      layers: [{ id: "nasa-imagery", type: "raster", source: "nasa", minzoom: 0, maxzoom: 8 }],
    };
  }, [date]);

  useEffect(() => {
    if (!selected || !mapRef.current) return;
    mapRef.current.flyTo({ center: [selected.lng, selected.lat], zoom: 5, duration: 1200, essential: true });
  }, [selected]);

  return (
    <Map
      ref={mapRef}
      mapLib={maplibregl}
      mapStyle={style}
      initialViewState={{ longitude: 50, latitude: 20, zoom: 2.3 }}
      minZoom={1}
      maxZoom={8}
      style={{ width: "100%", height: "100%" }}
      attributionControl
    >
      <NavigationControl position="top-right" />
      {events.map((event) => (
        <Marker key={event.id} longitude={event.lng} latitude={event.lat} anchor="center">
          <button
            type="button"
            title={event.title}
            aria-label={`Show ${event.title}`}
            onClick={() => onSelect(event)}
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg ${selected?.id === event.id ? "bg-amber-500" : "bg-red-600"}`}
          >
            !
          </button>
        </Marker>
      ))}
    </Map>
  );
}
