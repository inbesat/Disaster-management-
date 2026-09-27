from pathlib import Path
p=Path('components/map/DisasterMap.tsx')
s=p.read_text(encoding='utf-8')
s=s.replace('  const lastFetchedCoords = useRef<{ lat: number; lng: number } | null>(null);','  const lastFetchedCoords = useRef<{ lat: number; lng: number } | null>(null);\n  const liveFetchId = useRef(0);')
old='''  async function fetchLiveData(lat: number, lng: number) {
    setLiveConditions((prev) => ({
      lat,
      lng,
      loading: true,
      district: prev?.district ?? null,
      source: prev?.source ?? null,
      rainfall_mm: prev?.rainfall_mm ?? null,
      river_level_m: prev?.river_level_m ?? null,
      river_discharge_m3s: prev?.river_discharge_m3s ?? null,
    }));'''
new='''  async function fetchLiveData(lat: number, lng: number) {
    const requestId = ++liveFetchId.current;
    setLiveConditions({ lat, lng, loading: true, district: null, source: null, rainfall_mm: null, river_level_m: null, river_discharge_m3s: null });'''
assert old in s
s=s.replace(old,new)
old='''      const data = (await response.json()) as {
        district?: string;
        source?: "live" | "synthetic";
        rainfall_mm?: number;
        cumulative_rainfall_72h?: number;
        river_level_m?: number;
        river_discharge_m3s?: number;
      };

      setLiveConditions({'''
new='''      const data = (await response.json()) as {
        district?: string;
        source?: "live" | "synthetic";
        rainfall_mm?: number;
        cumulative_rainfall_72h?: number;
        river_level_m?: number;
        river_discharge_m3s?: number;
      };
      if (requestId !== liveFetchId.current) return;

      setLiveConditions({'''
assert old in s
s=s.replace(old,new)
s=s.replace('''    } catch (error: unknown) {
      console.error("Live conditions fetch failed:", error);
      setLiveConditions({ lat, lng, loading: false, district: null, source: null, rainfall_mm: null, river_level_m: null, river_discharge_m3s: null });''','''    } catch (error: unknown) {
      if (requestId !== liveFetchId.current) return;
      console.error("Live conditions fetch failed:", error);
      setLiveConditions({ lat, lng, loading: false, district: null, source: null, rainfall_mm: null, river_level_m: null, river_discharge_m3s: null });''')
p.write_text(s,encoding='utf-8')
